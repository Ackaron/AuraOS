use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolCall {
    pub name: String,
    pub path: Option<String>,
    pub pattern: Option<String>,
    pub content: Option<String>,
    pub target: Option<String>,
    pub replacement: Option<String>,
    pub command: Option<String>,
    pub replace_all: Option<bool>,
    pub message: Option<String>,
    pub todos: Option<Vec<serde_json::Value>>,
    pub question: Option<String>,
    pub directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub tool: String,
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ToolPermission {
    Auto,
    Confirm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingToolConfirmation {
    pub tool_call: ToolCall,
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
}

pub struct ToolExecutor {
    permission_map: HashMap<String, ToolPermission>,
    exclude_dirs: Vec<String>,
}

impl ToolExecutor {
    pub fn new() -> Self {
        let mut permission_map = HashMap::new();
        permission_map.insert("ls".to_string(), ToolPermission::Auto);
        permission_map.insert("read".to_string(), ToolPermission::Auto);
        permission_map.insert("grep".to_string(), ToolPermission::Auto);
        permission_map.insert("write_file".to_string(), ToolPermission::Auto); // Auto inside project
        permission_map.insert("patch_file".to_string(), ToolPermission::Auto); // NEW: Surgical edit
        permission_map.insert("mkdir".to_string(), ToolPermission::Auto);      // Auto inside project
        permission_map.insert("rm".to_string(), ToolPermission::Confirm);
        permission_map.insert("mv".to_string(), ToolPermission::Confirm);
        permission_map.insert("terminal_cmd".to_string(), ToolPermission::Confirm);

        Self {
            permission_map,
            exclude_dirs: vec![
                "node_modules".to_string(),
                "target".to_string(),
                "dist".to_string(),
                "build".to_string(),
                ".git".to_string(),
                "__pycache__".to_string(),
                ".venv".to_string(),
                "venv".to_string(),
            ],
        }
    }
    
    fn normalize_win_path(path: &std::path::Path) -> String {
        let mut p = path.to_string_lossy().to_string();
        if p.starts_with(r"\\?\") {
            p = p[4..].to_string();
        }
        // Normalize slashes
        p.replace("/", "\\")
    }

    fn is_path_safe(&self, path_str: &str, project_root: &Option<String>) -> bool {
        let root_canon = if let Some(root) = project_root {
            let root_path = Path::new(root);
            match root_path.canonicalize() {
                Ok(p) => p,
                Err(_) => root_path.to_path_buf(),
            }
        } else {
            // Fallback to current directory if no root is explicitly defined
            std::env::current_dir().unwrap_or_else(|_| Path::new(".").to_path_buf())
        };

        let target_path = if Path::new(path_str).is_absolute() {
            Path::new(path_str).to_path_buf()
        } else {
            root_canon.join(path_str)
        };

        // Canonicalizing to handle ".." and symbolic links
        let target_canon = match target_path.canonicalize() {
            Ok(p) => p,
            Err(_) => target_path.to_path_buf(), // If it doesn't exist yet, we trust the join
        };
        
        let root_norm = Self::normalize_win_path(&root_canon);
        let target_norm = Self::normalize_win_path(&target_canon);

        target_norm.to_lowercase().starts_with(&root_norm.to_lowercase())
    }

    pub fn get_permission(&self, tool_name: &str) -> ToolPermission {
        self.permission_map
            .get(tool_name)
            .copied()
            .unwrap_or(ToolPermission::Confirm)
    }

    pub fn execute(&self, call: &ToolCall, project_root: &Option<String>) -> ToolResult {
        log::info!("[TOOL] Executing {} with path: {:?}", call.name, call.path);
        
        // Special case: directory tool allows ANY path (for initialization context)
        if call.name == "directory" {
            let dir_path = call.directory.as_ref().or(call.path.as_ref());
            if let Some(path) = dir_path {
                return self.list_directory(path);
            }
            return ToolResult {
                tool: call.name.clone(),
                success: false,
                output: String::new(),
                error: Some("directory requires path".to_string()),
            };
        }

        // Root Enforcement: Do not allow tool execution if no project is active
        // and the tool expects to work with files.
        if project_root.is_none() && (call.name == "write_file" || call.name == "mkdir" || call.name == "rm" || call.name == "ls" || call.name == "read" || call.name == "grep") {
            return ToolResult {
                tool: call.name.clone(),
                success: false,
                output: String::new(),
                error: Some("Project context is missing. Please select a project in Workspace panel before performing file operations.".to_string()),
            };
        }

        // Safety First
        if let Some(ref path) = call.path {
            if !self.is_path_safe(path, project_root) {
                return ToolResult {
                    tool: call.name.clone(),
                    success: false,
                    output: String::new(),
                    error: Some(format!("Security Violation: Path '{}' is outside project root.", path)),
                };
            }
        }

        // Security & Path Resolution: Force all paths to be inside project_root if it exists.
        // If an absolute path is provided by the agent (e.g., G:\Project\VladTea_Analytics\inventory),
        // we extract only the relative components and join it to the known project_root to prevent escapes
        // and ensure the files actually go to the active project context.
        let resolved_path = if let Some(ref root) = project_root {
            let root_path = Path::new(root);
            if let Some(ref p) = call.path {
                let agent_path = Path::new(p);
                // Strip absolute prefixes to force it to be relative to our root
                let relative_part = if agent_path.is_absolute() {
                    // Try to strip the root if the agent somehow guessed it perfectly
                    if let Ok(stripped) = agent_path.strip_prefix(root_path) {
                        stripped.to_path_buf()
                    } else {
                        // If it's a completely different absolute root (e.g. C:\Windows), we just take the filename/last parts
                        Path::new(agent_path.file_name().unwrap_or_else(|| std::ffi::OsStr::new(""))).to_path_buf()
                    }
                } else {
                    agent_path.to_path_buf()
                };
                root_path.join(relative_part).to_string_lossy().to_string()
            } else {
                root_path.to_string_lossy().to_string()
            }
        } else {
            // Fallback if no project is active
            if let Some(ref p) = call.path {
                p.clone()
            } else {
                ".".to_string()
            }
        };

        match call.name.as_str() {
            "ls" => self.list_directory(&resolved_path),
            "read" | "read_file" => self.read_file(Some(&resolved_path)),
            "grep" | "grep_search" => self.search_in_files(call.pattern.as_ref(), Some(&resolved_path)),
            "write_file" => self.write_file(&resolved_path, call.content.as_deref().unwrap_or("")),
            "patch_file" => self.patch_file(&resolved_path, call.target.as_deref().unwrap_or(""), call.replacement.as_deref().unwrap_or("")),
            "edit_file" => self.edit_file(&resolved_path, call.target.as_deref().unwrap_or(""), call.replacement.as_deref().unwrap_or(""), call.replace_all.unwrap_or(false)),
            "glob_search" => self.glob_search(call.pattern.as_deref().unwrap_or("*"), &project_root),
            "mkdir" => self.create_dir(&resolved_path),
            "rm" => self.remove_item(&resolved_path),
            "terminal_cmd" | "bash" => self.run_terminal_cmd(call.command.as_deref().unwrap_or(""), &resolved_path),
            "send_user_message" | "report" => self.send_user_message(call.message.as_deref().or(call.content.as_deref()).unwrap_or("")),
            "directory" => {
                let dir_path = call.directory.as_ref().or(call.path.as_ref());
                if let Some(path) = dir_path {
                    self.list_directory(path)
                } else {
                    ToolResult {
                        tool: call.name.clone(),
                        success: false,
                        output: String::new(),
                        error: Some("directory requires path".to_string()),
                    }
                }
            },
            "todo_write" => self.todo_write(call.todos.as_deref(), &project_root),
            "todo_read" => self.todo_read(&project_root),
            "finish" => self.finish(call.content.as_deref().unwrap_or("Задача выполнена.")),
            _ => ToolResult {
                tool: call.name.clone(),
                success: false,
                output: String::new(),
                error: Some(format!("Неизвестный инструмент: {}. Доступные: ls, read, grep, write_file, edit_file, patch_file, glob_search, mkdir, rm, terminal_cmd, send_user_message, todo_write, todo_read, finish", call.name)),
            },
        }

    }

    fn list_directory(&self, path: &str) -> ToolResult {
        let dir_path = Path::new(path);

        if !dir_path.exists() {
            return ToolResult {
                tool: "ls".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Path does not exist: {}", path)),
            };
        }

        if !dir_path.is_dir() {
            return ToolResult {
                tool: "ls".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Path is not a directory: {}", path)),
            };
        }

        let entries = match std::fs::read_dir(dir_path) {
            Ok(e) => e,
            Err(e) => {
                return ToolResult {
                    tool: "ls".to_string(),
                    success: false,
                    output: String::new(),
                    error: Some(format!("Failed to read directory: {}", e)),
                };
            }
        };

        let mut result = String::new();
        let mut dirs = Vec::new();
        let mut files = Vec::new();

        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }

            if self.exclude_dirs.iter().any(|d| d == &name) {
                continue;
            }

            if entry.path().is_dir() {
                dirs.push(format!("{}/", name));
            } else {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                files.push(format!("{} ({} bytes)", name, size));
            }
        }

        dirs.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));
        files.sort_by(|a, b| a.to_lowercase().cmp(&b.to_lowercase()));

        result.push_str(&format!("=== Directory: {} ===\n\n", path));
        result.push_str("📁 Directories:\n");
        for dir in dirs {
            result.push_str(&format!("  {}\n", dir));
        }
        result.push_str("\n📄 Files:\n");
        for file in files {
            result.push_str(&format!("  {}\n", file));
        }

        ToolResult {
            tool: "ls".to_string(),
            success: true,
            output: result,
            error: None,
        }
    }

    fn read_file(&self, path: Option<&String>) -> ToolResult {
        let file_path = match path {
            Some(p) => Path::new(p),
            None => {
                return ToolResult {
                    tool: "read".to_string(),
                    success: false,
                    output: String::new(),
                    error: Some("No path provided".to_string()),
                };
            }
        };

        if !file_path.exists() {
            return ToolResult {
                tool: "read".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("File does not exist: {}", path.unwrap())),
            };
        }

        if !file_path.is_file() {
            return ToolResult {
                tool: "read".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Path is not a file: {}", path.unwrap())),
            };
        }

        match std::fs::read_to_string(file_path) {
            Ok(content) => {
                let preview = if content.len() > 8000 {
                    format!(
                        "{}...\n\n[File truncated: {} bytes total]",
                        &content[..8000],
                        content.len()
                    )
                } else {
                    content
                };

                ToolResult {
                    tool: "read".to_string(),
                    success: true,
                    output: preview,
                    error: None,
                }
            }
            Err(e) => ToolResult {
                tool: "read".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Failed to read file: {}", e)),
            },
        }
    }

    fn search_in_files(&self, pattern: Option<&String>, path: Option<&str>) -> ToolResult {
        let search_pattern = match pattern {
            Some(p) => p,
            None => {
                return ToolResult {
                    tool: "grep".to_string(),
                    success: false,
                    output: String::new(),
                    error: Some("No pattern provided".to_string()),
                };
            }
        };

        let search_path = Path::new(path.unwrap_or("."));

        if !search_path.exists() {
            return ToolResult {
                tool: "grep".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!(
                    "Search path does not exist: {}",
                    path.unwrap_or(".")
                )),
            };
        }

        let pattern_lower = search_pattern.to_lowercase();
        let mut results = Vec::new();

        self.search_recursive(search_path, &pattern_lower, &mut results, 0);

        let output = if results.is_empty() {
            format!("No matches found for: {}", search_pattern)
        } else {
            let mut output = format!("=== Search results for: {} ===\n\n", search_pattern);
            for (file, line_num, line) in results.iter().take(50) {
                output.push_str(&format!("{}:{}: {}\n", file, line_num, line));
            }
            if results.len() > 50 {
                output.push_str(&format!("\n... and {} more matches", results.len() - 50));
            }
            output
        };

        ToolResult {
            tool: "grep".to_string(),
            success: true,
            output,
            error: None,
        }
    }

    fn search_recursive(
        &self,
        dir: &Path,
        pattern: &str,
        results: &mut Vec<(String, usize, String)>,
        depth: usize,
    ) {
        if depth > 5 {
            return;
        }

        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }

            if self.exclude_dirs.iter().any(|d| d == &name) {
                continue;
            }

            if path.is_dir() {
                self.search_recursive(&path, pattern, results, depth + 1);
            } else if path.is_file() {
                let extensions = [
                    "rs", "ts", "tsx", "js", "jsx", "py", "md", "txt", "json", "toml",
                ];
                if let Some(ext) = path.extension() {
                    let ext_str = ext.to_string_lossy().to_lowercase();
                    if extensions.iter().any(|e| e == &ext_str) {
                        if let Ok(content) = std::fs::read_to_string(&path) {
                            for (line_num, line) in content.lines().enumerate() {
                                if line.to_lowercase().contains(pattern) {
                                    results.push((
                                        path.to_string_lossy().to_string(),
                                        line_num + 1,
                                        line.to_string(),
                                    ));
                                    if results.len() >= 100 {
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    fn write_file(&self, path: &str, content: &str) -> ToolResult {
        let file_path = Path::new(path);
        
        // Auto-create parent directories
        if let Some(parent) = file_path.parent() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                return ToolResult {
                    tool: "write_file".to_string(),
                    success: false,
                    output: String::new(),
                    error: Some(format!("Failed to create parent directories: {}", e)),
                };
            }
        }

        match std::fs::write(file_path, content) {
            Ok(_) => ToolResult {
                tool: "write_file".to_string(),
                success: true,
                output: format!("Successfully wrote to: {}", path),
                error: None,
            },
            Err(e) => ToolResult {
                tool: "write_file".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Failed to write file: {}", e)),
            },
        }
    }

    fn create_dir(&self, path: &str) -> ToolResult {
        match std::fs::create_dir_all(Path::new(path)) {
            Ok(_) => ToolResult {
                tool: "mkdir".to_string(),
                success: true,
                output: format!("Successfully created directory: {}", path),
                error: None,
            },
            Err(e) => ToolResult {
                tool: "mkdir".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Failed to create directory: {}", e)),
            },
        }
    }

    fn remove_item(&self, path: &str) -> ToolResult {
        let p = Path::new(path);
        let res = if p.is_dir() {
            std::fs::remove_dir_all(p)
        } else {
            std::fs::remove_file(p)
        };
        
        match res {
            Ok(_) => ToolResult {
                tool: "rm".to_string(),
                success: true,
                output: format!("Successfully removed: {}", path),
                error: None,
            },
            Err(e) => ToolResult {
                tool: "rm".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Failed to remove: {}", e)),
            },
        }
    }

    fn patch_file(&self, path: &str, target: &str, replacement: &str) -> ToolResult {
        if target.is_empty() {
            return ToolResult {
                tool: "patch_file".to_string(),
                success: false,
                output: String::new(),
                error: Some("Target string cannot be empty".to_string()),
            };
        }

        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(e) => return ToolResult {
                tool: "patch_file".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Could not read file for patching: {}", e)),
            },
        };

        if !content.contains(target) {
            return ToolResult {
                tool: "patch_file".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Target string not found in file. Ensure exact match including whitespace.")),
            };
        }

        // Only replace first occurrence for safety, unless it's a very specific common pattern?
        // Let's do all occurrences for now as it's common in these types of agents.
        let new_content = content.replace(target, replacement);

        match std::fs::write(path, new_content) {
            Ok(_) => ToolResult {
                tool: "patch_file".to_string(),
                success: true,
                output: format!("Successfully patched file: {}. Replaced occurrences of target.", path),
                error: None,
            },
            Err(e) => ToolResult {
                tool: "patch_file".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Failed to write patched file: {}", e)),
            },
        }
    }

    fn finish(&self, message: &str) -> ToolResult {
        ToolResult {
            tool: "finish".to_string(),
            success: true,
            output: format!("Task completed: {}", message),
            error: None,
        }
    }

    fn edit_file(&self, path: &str, old_string: &str, new_string: &str, replace_all: bool) -> ToolResult {
        match std::fs::read_to_string(path) {
            Ok(content) => {
                if !content.contains(old_string) {
                    return ToolResult {
                        tool: "edit_file".to_string(),
                        success: false,
                        output: String::new(),
                        error: Some(format!("Строка '{}' не найдена в {}", old_string, path)),
                    };
                }
                let new_content = if replace_all {
                    content.replace(old_string, new_string)
                } else {
                    content.replacen(old_string, new_string, 1)
                };
                match std::fs::write(path, &new_content) {
                    Ok(_) => ToolResult {
                        tool: "edit_file".to_string(),
                        success: true,
                        output: format!("Файл {} успешно отредактированв", path),
                        error: None,
                    },
                    Err(e) => ToolResult {
                        tool: "edit_file".to_string(),
                        success: false,
                        output: String::new(),
                        error: Some(format!("Ошибка записи: {}", e)),
                    },
                }
            }
            Err(e) => ToolResult {
                tool: "edit_file".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Ошибка чтения {}: {}", path, e)),
            },
        }
    }

    fn glob_search(&self, pattern: &str, project_root: &Option<String>) -> ToolResult {
        let base = project_root.as_deref().unwrap_or(".");
        let base_path = std::path::Path::new(base);
        let mut results = Vec::new();

        // Walk the tree, collect matching paths
        fn walk(dir: &std::path::Path, pattern: &str, exclude: &[String], results: &mut Vec<String>, base: &std::path::Path) {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    let is_excluded = exclude.iter().any(|ex| name == *ex);
                    if is_excluded { continue; }
                    
                    let rel = path.strip_prefix(base).unwrap_or(&path);
                    let rel_str = rel.to_string_lossy().to_string().replace('\\', "/");
                    
                    // Simple glob: support *.ext and **/*.ext
                    let trimmed = pattern.trim_start_matches("**/");
                    let is_match = if let Some(ext) = trimmed.strip_prefix("*.") {
                        name.ends_with(&format!(".{}", ext))
                    } else if trimmed.starts_with('*') {
                        name.ends_with(&trimmed[1..])
                    } else {
                        name == trimmed
                    };
                    
                    if is_match {
                        results.push(rel_str);
                    }
                    
                    if path.is_dir() {
                        walk(&path, pattern, exclude, results, base);
                    }
                }
            }
        }

        let exclude = vec![
            "node_modules".to_string(), "target".to_string(), ".git".to_string(),
            "dist".to_string(), "build".to_string()
        ];
        walk(base_path, pattern, &exclude, &mut results, base_path);

        ToolResult {
            tool: "glob_search".to_string(),
            success: true,
            output: if results.is_empty() {
                format!("Файлы по шаблону '{}' не найдены", pattern)
            } else {
                format!("Найдено {} файлов:\n{}", results.len(), results.join("\n"))
            },
            error: None,
        }
    }

    fn send_user_message(&self, message: &str) -> ToolResult {
        // This tool allows the agent to report progress without finishing the loop.
        // The frontend listens for 'type: report' events.
        ToolResult {
            tool: "send_user_message".to_string(),
            success: true,
            output: message.to_string(),
            error: None,
        }
    }

    fn todo_write(&self, todos: Option<&[serde_json::Value]>, project_root: &Option<String>) -> ToolResult {
        let base = project_root.as_deref().unwrap_or(".");
        let todo_path = std::path::Path::new(base).join(".aura").join("session_todos.json");
        if let Some(parent) = todo_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let todo_list = todos.unwrap_or(&[]);
        let content = serde_json::to_string_pretty(todo_list).unwrap_or_default();
        match std::fs::write(&todo_path, &content) {
            Ok(_) => {
                ToolResult {
                    tool: "todo_write".to_string(),
                    success: true,
                    output: format!("Список задач обновлен.\n{}", content),
                    error: None,
                }
            },
            Err(e) => ToolResult {
                tool: "todo_write".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Ошибка сохранения TODO: {}", e)),
            },
        }
    }

    fn todo_read(&self, project_root: &Option<String>) -> ToolResult {
        let base = project_root.as_deref().unwrap_or(".");
        let todo_path = std::path::Path::new(base).join(".aura").join("session_todos.json");
        match std::fs::read_to_string(&todo_path) {
            Ok(content) => ToolResult {
                tool: "todo_read".to_string(),
                success: true,
                output: content,
                error: None,
            },
            Err(_) => ToolResult {
                tool: "todo_read".to_string(),
                success: true,
                output: "[]".to_string(),
                error: None,
            },
        }
    }

    fn run_terminal_cmd(&self, command: &str, cwd: &str) -> ToolResult {
        if command.is_empty() {
             return ToolResult {
                tool: "terminal_cmd".to_string(),
                success: false,
                output: String::new(),
                error: Some("Command is empty".to_string()),
            };
        }

        #[cfg(windows)]
        let shell = "powershell";
        #[cfg(not(windows))]
        let shell = "sh";

        let output = if cfg!(windows) {
            std::process::Command::new(shell)
                .args(["-NoProfile", "-Command", command])
                .current_dir(cwd)
                .output()
        } else {
            std::process::Command::new(shell)
                .arg("-c")
                .arg(command)
                .current_dir(cwd)
                .output()
        };

        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let success = output.status.success();
                
                ToolResult {
                    tool: "terminal_cmd".to_string(),
                    success,
                    output: if success { stdout } else { format!("Error: {}\n{}", stderr, stdout) },
                    error: if success { None } else { Some(format!("Exit code: {:?}", output.status.code())) },
                }
            }
            Err(e) => ToolResult {
                tool: "terminal_cmd".to_string(),
                success: false,
                output: String::new(),
                error: Some(format!("Failed to execute command: {}", e)),
            },
        }
    }
}

impl Default for ToolExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct AgentEngine {
    current_model: String,
}


impl AgentEngine {
    pub fn new() -> Self {
        Self {
            current_model: "llama3.1:8b".to_string(),
        }
    }

    pub fn set_model(&mut self, model: String) {
        self.current_model = model;
    }

    pub fn build_system_prompt(
        &self,
        app: &tauri::AppHandle,
        project_id: Option<String>,
    ) -> Result<String, String> {
        let mut sections = Vec::new();

        // 1. Base Persona - STRICT EXECUTION MODE
        sections.push(format!(
            "### ТЫ — AuraOS AGENT\nТы — локальный AI-ассистент. Твоя работа — ВЫПОЛНЯТЬ задания.\n\n### ⚠️ ЗАПРЕЩЕНО!\n- НЕ описывай действие (не пиши \"прочитал...\", \"изучаю...\")\n- НЕ притворяйся что сделал, если НЕ сделал\n- НЕ выдумывай содержание файлов\n- НЕ пиши результат ДО выполнения инструмента\n\n### ✅ ОБЯЗАТЕЛЬНО:\n1. Вызови инструмент read/ls/grep ДЛЯ КАЖДОГО файла который нужно прочитать\n2. Получи РЕАЛЬНУЮ информацию из файла\n3. Только ПОТОМ отвечай пользователю на основе полученных данных\n4. Если задание = \"прочитай X\" → сначала read X → потом ответ\n\n### ШАБЛОН ОТВЕТА:\n```json\n{{\"tool\": \"read\", \"path\": \"CLAUDE.md\"}}\n```\n```json\n{{\"tool\": \"ls\", \"path\": \".claude/agents\"}}\n```\n```json\n{{\"tool\": \"send_user_message\", \"message\": \"[ЗДЕСЬ РЕАЛЬНЫЙ РЕЗУЛЬТАТ ИЗ ФАЙЛОВ]\"}}\n```\n```json\n{{\"tool\": \"finish\", \"content\": \"итог\"}}\n```\n\n### ЯЗЫК: Русский.\nСегодняшняя дата: {}",
            chrono::Local::now().format("%Y-%m-%d")
        ));

        // 2. Database Context (Active Skills)
        let db_path = app
            .path()
            .app_data_dir()
            .map_err(|e: tauri::Error| e.to_string())?
            .join("auraos.db");

        if let (Some(pid), Ok(conn)) = (project_id.clone(), rusqlite::Connection::open(&db_path)) {
            // Get project path
            let project_path: Option<String> = conn
                .query_row(
                    "SELECT path FROM project_index WHERE id = ?1",
                    [&pid],
                    |row| row.get(0),
                )
                .ok();

                if let Some(ref path_str) = project_path {
                    // START OF CONTEXT - только если нужен контекст проекта
                    // Убрано сканирование структуры файлов - добавляет тысячи токенов
                    // Можно включить позже если проект активный
                    sections.push(format!(
                        "# Project Context\n\
                        Ты работаешь с проектом: {}\n\
                        Для навигации используй ls, read, glob_search, grep.\n",
                        path_str
                    ));

                // Scan ONLY CLAUDE.md (not all .rules/*.md - слишком много токенов)
                let root = std::path::Path::new(path_str);
                let mut local_rules = Vec::new();

                for candidate in ["CLAUDE.md"] {
                    let p = root.join(candidate);
                    if p.exists() {
                        if let Ok(content) = std::fs::read_to_string(p) {
                            local_rules.push(format!("## File: {}\n{}", candidate, content));
                        }
                    }
                }

                if !local_rules.is_empty() {
                    sections.push(format!("# Project Rules (summary)\n{}\n", local_rules.join("\n\n")));
                }
            }

            // Get Active Skills - упрощенно
            let mut stmt = conn
                .prepare(
                    "SELECT s.name, s.path FROM available_skills s 
                     JOIN project_skills ps ON s.id = ps.skill_id 
                     WHERE ps.project_id = ?1 AND ps.is_active = 1",
                )
                .map_err(|e| e.to_string())?;

            let skill_names: Vec<String> = stmt
                .query_map([pid], |row| row.get::<_, String>(0))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();

            if !skill_names.is_empty() {
                sections.push(format!(
                    "# Активные скиллы: {}\n",
                    skill_names.join(", ")
                ));
            }
        }

        Ok(sections.join("\n\n---\n\n"))
    }

    pub async fn get_active_model(&self, app: &tauri::AppHandle) -> String {
        use crate::modules::ollama::OllamaService;
        let ollama = OllamaService::new();
        
        let db_path = match app.path().app_data_dir() {
            Ok(p) => {
                let path = p.join("auraos.db");
                log::info!("[AGENT] DB Path: {:?}", path);
                path
            },
            Err(e) => {
                log::error!("[AGENT] Could not get app_data_dir: {}", e);
                return "llama3.1:8b".to_string()
            },
        };

        let status = ollama.check_status().await;
        log::info!("[AGENT] Ollama available: {}, Models found: {}", status.available, status.models.len());
        
        if status.models.is_empty() {
            log::warn!("[AGENT] No models found in Ollama, using default fallback");
            return "llama3.1:8b".to_string();
        }

        // 1. Try to get preferred model for logic
        log::info!("[AGENT] Querying DB for preferred model...");
        let preferred: Option<String> = if let Ok(conn) = rusqlite::Connection::open(&db_path) {
            let res = conn.query_row(
                "SELECT model_name FROM ai_models_config WHERE task_type = 'logic' OR task_type = 'fast' LIMIT 1",
                [],
                |row| row.get(0)
            );
            match res {
                Ok(m) => {
                    log::info!("[AGENT] Found preferred model in DB: {}", m);
                    Some(m)
                },
                Err(e) => {
                    log::warn!("[AGENT] Preferred model query failed: {}", e);
                    None
                }
            }
        } else {
            log::error!("[AGENT] Could not open database at {:?}", db_path);
            None
        };

        // 2. Check if preferred exists in Ollama
        if let Some(ref model) = preferred {
            if status.models.iter().any(|m| m.name == *model || m.name.starts_with(model)) {
                return model.clone();
            }
        }

        // 3. Fallback: select first available model
        let first_model = status.models[0].name.clone();
        log::warn!("[AGENT] Preferred model {:?} not found, falling back to {}", preferred, first_model);
        first_model
    }

    pub async fn run_loop(
        &self,
        app: &tauri::AppHandle,
        project_id: Option<String>,
        user_message: String,
        history_input: Vec<Message>,
        cancellation_token: Arc<AtomicBool>,
        on_step: impl Fn(serde_json::Value) + Send + Sync + 'static,
    ) -> Result<String, String> {
        let on_step = std::sync::Arc::new(on_step);
        use crate::modules::ollama::OllamaService;
        let ollama = OllamaService::new();
        let executor = ToolExecutor::new();
        
        let model = self.get_active_model(app).await;
        let system_prompt = self.build_system_prompt(app, project_id.clone())?;
        
        let db_path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("auraos.db");
        
        let project_path: Option<String> = if let Some(pid) = project_id {
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                conn.query_row("SELECT path FROM project_index WHERE id = ?1", [&pid], |row| row.get(0)).ok()
            } else { None }
        } else { None };

        // 1. Initial messages array
        let mut messages = vec![
            serde_json::json!({ "role": "system", "content": system_prompt })
        ];
        
        for msg in history_input {
            messages.push(serde_json::json!({ "role": msg.role, "content": msg.content }));
        }
        
        messages.push(serde_json::json!({ "role": "user", "content": user_message }));

        let mut final_response = String::new();
        let max_steps = 5;

        for step in 1..=max_steps {
            if cancellation_token.load(Ordering::SeqCst) {
                return Err("Task cancelled by user.".to_string());
            }

            let cancellation_token_clone = cancellation_token.clone();
            let on_step_callback = on_step.clone();
            let on_step_for_stream = on_step_callback.clone();

            let response = ollama.generate_streaming(
                &model, 
                messages.clone(), 
                Some(cancellation_token_clone), 
                move |chunk| {
                    on_step_for_stream(serde_json::json!({
                        "type": "chunk",
                        "content": chunk
                    }));
                }
            ).await;

            if let Err(e) = &response {
                if e == "cancelled" {
                     return Err("Task cancelled by user.".to_string());
                }
            }
            
            let response = response?;

            if cancellation_token.load(Ordering::SeqCst) {
                 return Err("Task cancelled by user.".to_string());
            }

            let current_turn_response = response.clone();
            
            // DEBUG: Audit the raw AI stream
            if let Some(path) = &project_path {
                let log_file = std::path::Path::new(path).join("agent_debug.log");
                let log_entry = format!("\n\n--- STEP {} ---\n{}\n", step, response);
                let _ = std::fs::OpenOptions::new().create(true).append(true).open(log_file).and_then(|mut f| {
                    use std::io::Write;
                    f.write_all(log_entry.as_bytes())
                });
            }

            // Extract thoughts to preserve them in history
            let mut extracted_thoughts = Vec::new();
            let mut pos = 0;
            while let Some(start) = response[pos..].find('{') {
                let abs_start = pos + start;
                let mut brace_count = 0;
                let mut end_pos = None;
                for (i, c) in response[abs_start..].chars().enumerate() {
                    if c == '{' { brace_count += 1; }
                    else if c == '}' {
                        brace_count -= 1;
                        if brace_count == 0 { end_pos = Some(abs_start + i + 1); break; }
                    }
                }
                if let Some(end) = end_pos {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&response[abs_start..end]) {
                        if let Some(t) = v.get("thought").and_then(|t| t.as_str()) {
                            extracted_thoughts.push(t.to_string());
                        }
                    }
                    pos = end;
                } else { break; }
            }

            // Clean response for history (remove JSON blocks)
            let mut history_text = response.clone();
            while let Some(start) = history_text.find("```json") {
                if let Some(end) = history_text[start..].find("```") {
                    history_text.replace_range(start..start+end+3, "");
                } else { history_text.replace_range(start.., ""); break; }
            }
            
            let mut p = 0;
            while let Some(start) = history_text[p..].find('{') {
                let abs_start = p + start;
                let mut bc = 0;
                let mut ep = None;
                for (i, c) in history_text[abs_start..].chars().enumerate() {
                    if c == '{' { bc += 1; }
                    else if c == '}' { bc -= 1; if bc == 0 { ep = Some(abs_start + i + 1); break; } }
                }
                if let Some(end) = ep {
                    let potential = &history_text[abs_start..end];
                    if potential.contains("\"thought\"") || potential.contains("\"tool\"") {
                        history_text.replace_range(abs_start..end, "");
                        p = abs_start;
                    } else { p = end; }
                } else { break; }
            }

            let final_history = format!("[внутренняя работа: {}]", extracted_thoughts.join(" | ")).trim().to_string();
            if !final_history.is_empty() {
                messages.push(serde_json::json!({ "role": "assistant", "content": final_history }));
            }

            // Calculate context usage (approx character count)
            let context_usage: usize = messages.iter().map(|m| m["content"].as_str().unwrap_or("").len()).sum();

            on_step_callback(serde_json::json!({
                "step": step,
                "type": "context_update",
                "content": context_usage,
                "model": model.clone()
            }));

            // 2. Parse tool calls (Ultra-Greedy mode)
            let mut json_blocks = Vec::new();
            let search_text = response.as_str();
            
            // First, try standard Markdown blocks
            let mut pos = 0;
            while let Some(start) = search_text[pos..].find("```json") {
                let abs_start = pos + start + 7;
                if let Some(end) = search_text[abs_start..].find("```") {
                    let block = search_text[abs_start..abs_start + end].trim().to_string();
                    if !block.is_empty() {
                        json_blocks.push(block);
                    }
                    pos = abs_start + end + 3;
                } else { break; }
            }

            // Fallback/Greedy check: Find everything that looks like a JSON object
            if json_blocks.is_empty() {
                let mut pos = 0;
                while let Some(start) = search_text[pos..].find('{') {
                    let abs_start = pos + start;
                    let mut brace_count = 0;
                    let mut end_pos = None;
                    
                    // Trace braces carefully to handle nested structures
                    for (i, c) in search_text[abs_start..].chars().enumerate() {
                        if c == '{' { brace_count += 1; }
                        else if c == '}' {
                            brace_count -= 1;
                            if brace_count == 0 {
                                end_pos = Some(abs_start + i + 1);
                                break;
                            }
                        }
                    }

                    if let Some(end) = end_pos {
                        let potential = search_text[abs_start..end].trim();
                        // Only add if it contains a tool or thought signature
                        if (potential.contains("\"tool\"") || potential.contains("\"thought\"")) && !potential.is_empty() {
                            json_blocks.push(potential.to_string());
                        }
                        pos = end;
                    } else {
                        pos = abs_start + 1; // Skip this brace and continue
                    }
                    
                    if pos >= search_text.len() { break; }
                }
            }

            // Remove duplicates (models sometimes repeat blocks)
            json_blocks.sort();
            json_blocks.dedup();

            // 3. Execute tools
            let mut tool_results = Vec::new();
            let mut finished = false;

            for json_str in &json_blocks {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    if let Some(tool_name) = v.get("tool").and_then(|t| t.as_str()) {
                        let call = ToolCall {
                            name: tool_name.to_string(),
                            path: v.get("path").and_then(|p| p.as_str()).map(|s| s.to_string()),
                            pattern: v.get("pattern").and_then(|p| p.as_str()).map(|s| s.to_string()),
                            content: v.get("content").and_then(|c| c.as_str()).map(|s| s.to_string()),
                            target: v.get("target").and_then(|t| t.as_str()).map(|s| s.to_string()),
                            replacement: v.get("replacement").and_then(|r| r.as_str()).map(|s| s.to_string()),
                            command: v.get("command").and_then(|c| c.as_str()).map(|s| s.to_string()),
                            replace_all: v.get("replace_all").and_then(|r| r.as_bool()),
                            message: v.get("message").and_then(|m| m.as_str()).map(|s| s.to_string()),
                            todos: v.get("todos").and_then(|t| t.as_array()).map(|a| a.clone()),
                            question: v.get("question").and_then(|q| q.as_str()).map(|s| s.to_string()),
                            directory: v.get("directory").and_then(|d| d.as_str()).map(|s| s.to_string()),
                        };

                        let _thought = v.get("thought").and_then(|t| t.as_str());
                        // Don't emit thoughts to UI - they're internal reasoning
                        // They are used for context only

                        log::info!("[AGENT] Executing tool: {}", call.name);
                        on_step(serde_json::json!({
                            "step": step,
                            "type": "tool_start",
                            "tool": call.name,
                            "args": call.path.clone().or(call.command.clone()).unwrap_or_default()
                        }));

                        let result = executor.execute(&call, &project_path);
                        
                        on_step(serde_json::json!({
                            "step": step,
                            "type": "tool_result",
                            "tool": call.name,
                            "success": result.success,
                            "output": result.output.clone(),
                            "error": result.error.clone()
                        }));

                        // Tool executed this turn

                        if call.name == "finish" {
                            final_response = result.output.clone();
                            finished = true;
                        } else if call.name == "todo_write" || call.name == "todo_read" {
                            // Emit special event for UI synchronization
                            if let Ok(todos) = serde_json::from_str::<serde_json::Value>(&result.output) {
                                on_step(serde_json::json!({
                                    "step": step,
                                    "type": "todo_update",
                                    "todos": todos
                                }));
                            }
                            tool_results.push(format!("План работ обновлен."));
                        } else {
                            let truncated_output = if result.output.len() > 2000 {
                                format!("{}... [контент обрезан, слишком много данных]", &result.output[..2000])
                            } else {
                                result.output.clone()
                            };
                            tool_results.push(format!("Tool '{}' output: {}", call.name, truncated_output));
                        }
                    }
                }
            }

            if finished {
                break;
            }

            if !tool_results.is_empty() {
                // Feed observations back as a user turn
                let observation = tool_results.join("\n\n");
                messages.push(serde_json::json!({ 
                    "role": "user", 
                    "content": format!("Observation from tools:\n\n{}", observation) 
                }));
            } else {
                // No tools called - text-only response. Accept as final answer.
                // Extract clean text (remove any JSON artifacts first)
                let clean_text = response.trim().to_string();
                
                // Remove any remaining JSON blocks
                let mut clean = clean_text.clone();
                let mut p = 0;
                while let Some(start) = clean[p..].find("```json") {
                    if let Some(end) = clean[start..].find("```") {
                        clean.replace_range(start..start+end+3, "");
                        p = start;
                    } else {
                        clean.replace_range(start.., "");
                        break;
                    }
                }
                
                // Remove leftover brace blocks
                let mut final_clean = clean.clone();
                let mut p = 0;
                while let Some(start) = final_clean[p..].find('{') {
                    let abs_start = p + start;
                    let mut bc = 0;
                    let mut ep = None;
                    for (i, c) in final_clean[abs_start..].chars().enumerate() {
                        if c == '{' { bc += 1; }
                        else if c == '}' { bc -= 1; if bc == 0 { ep = Some(abs_start + i + 1); break; } }
                    }
                    if let Some(end) = ep {
                        let potential = &final_clean[abs_start..end];
                        if potential.contains("\"thought\"") || potential.contains("\"tool\"") {
                            final_clean.replace_range(abs_start..end, "");
                            p = abs_start;
                        } else { p = end; }
                    } else { break; }
                }
                
                final_response = final_clean.trim().to_string();
                break;
            }

            // History Compaction: Prevent context overflow
            if messages.len() > 24 {
                log::info!("[AGENT] Compacting history ({} messages)", messages.len());
                let system_msg = messages[0].clone();
                let last_messages = messages[messages.len() - 12..].to_vec();
                messages = vec![system_msg];
                messages.extend(last_messages);
            }
        }

        // Final sanitation: ULTRA-GREEDY mode
        let mut sanitized = final_response.clone();
        
        // 1. Strip ```json blocks
        while let Some(start) = sanitized.find("```json") {
            if let Some(end) = sanitized[start..].find("```") {
                sanitized.replace_range(start..start + end + 3, "");
            } else { sanitized.replace_range(start.., ""); break; }
        }

        // 2. Strip ANY brace blocks that look like tools (thought/tool signature)
        let mut pos = 0;
        while let Some(start) = sanitized[pos..].find('{') {
            let abs_start = pos + start;
            let mut brace_count = 0;
            let mut end_pos = None;
            for (i, c) in sanitized[abs_start..].chars().enumerate() {
                if c == '{' { brace_count += 1; }
                else if c == '}' {
                    brace_count -= 1;
                    if brace_count == 0 {
                        end_pos = Some(abs_start + i + 1);
                        break;
                    }
                }
            }
            if let Some(end) = end_pos {
                let potential = &sanitized[abs_start..end];
                if potential.contains("\"thought\"") || potential.contains("\"tool\"") {
                    sanitized.replace_range(abs_start..end, "");
                    pos = abs_start; // Re-check from same position
                } else {
                    pos = end;
                }
            } else { break; }
            if pos >= sanitized.len() { break; }
        }

        let cleaned = sanitized.trim().to_string();

        // Extra cleanup: remove any trailing JSON remnants, normalize whitespace
        let super_clean = cleaned
            .lines()
            .filter(|line| !line.trim().starts_with('{') && !line.trim().starts_with('}'))
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string();

        Ok(if super_clean.is_empty() && !final_response.is_empty() {
            "Выполнено. Готов к следующей задаче.".to_string()
        } else {
            super_clean
        })
    }
}
