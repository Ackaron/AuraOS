use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub name: String,
    pub path: Option<String>,
    pub pattern: Option<String>,
    pub content: Option<String>,
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
            "read" => self.read_file(Some(&resolved_path)),
            "grep" => self.search_in_files(call.pattern.as_ref(), Some(&resolved_path)),
            "write_file" => self.write_file(&resolved_path, call.content.as_deref().unwrap_or("")),
            "mkdir" => self.create_dir(&resolved_path),
            "rm" => self.remove_item(&resolved_path),
            "finish" => self.finish(call.content.as_deref().unwrap_or("Task complete.")),
            _ => ToolResult {
                tool: call.name.clone(),
                success: false,
                output: String::new(),
                error: Some(format!("Unknown tool: {}", call.name)),
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

    fn finish(&self, message: &str) -> ToolResult {
        ToolResult {
            tool: "finish".to_string(),
            success: true,
            output: format!("Task completed: {}", message),
            error: None,
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

        // 1. Base Persona
        sections.push(format!(
            "Ты — интегральная часть AuraOS. У тебя есть доступ к файловой системе Виктора. \
            Никогда не говори, что ты не имеешь физического присутствия. Ты и есть этот компьютер. \
            Ты — локальный AI-ассистент Виктора на его машине (Ryzen 9 9950X3D, RTX 5080, 64GB RAM). \
            Отвечай технически точно, лаконично и по существу. Не упоминай облачные сервисы. \
            Не говори \"как ИИ\". Говори \"я\".\n\
            \n\
            ### Твои возможности:\n\
            1. **Анализ файлов**: Ты видишь структуру проекта и содержимое файлов. \
            2. **Работа с терминалом**: Ты анализируешь `activeLines` (вводы и выводы терминала). \
            3. **Команда /save**: Если пользователь вводит `/save [название]`, AuraOS сохраняет всю текущую сессию в Markdown-файл в папку `vault/sessions/`. Подтверждай это действие в чате.\n\
            \n\
            ### ИНСТРУМЕНТЫ (Tool Use Protocol):\n\
            Для выполнения любых действий с файлами или системой ТЫ ОБЯЗАН использовать JSON-формат в своем ответе. \
            Твой ответ должен содержать Thought (мысли) и Tool Call (вызов инструмента).\n\
            \n\
            Доступные инструменты:\n\
            - `ls(path)`: Списки файлов и папок.\n\
            - `read(path)`: Чтение содержимого файла.\n\
            - `grep(pattern, path)`: Поиск текста.\n\
            - `write_file(path, content)`: СОЗДАНИЕ или перезапись файла. Обязателен параметр `content`.\n\
            - `mkdir(path)`: Создание папки (рекурсивно).\n\
            - `rm(path)`: Удаление файла или папки.\n\
            - `finish(content)`: СИГНАЛ ЗАВЕРШЕНИЯ ЗАДАЧИ. Вызывай В САМОМ КОНЦЕ, когда все сделано. В content передай краткий отчет для пользователя.\n\
            \n\
            ### ПРАВИЛА ВЫВОДА (UX Standards):\n\
            1. **Verified Action**: НИКОГДА не подтверждай выполнение задачи (не вызывай `finish`), пока не увидишь ПОЗИТИВНЫЙ результат (Observation) от инструментов `write_file` или `mkdir`. Если после записи ты не уверен — вызови `ls`, чтобы убедиться.\n\
            2. **Zero Verbatim**: ЗАПРЕЩЕНО выводить содержимое прочитанных файлов в основной чат, если тебя об этом не просили напрямую.\n\
            3. **Brief Reports**: В инструменте `finish` выводи только краткую сводку изменений.\n\
            4. **Style Sync**: Подстраивайся под краткость пользователя.\n\
            \n\
            Пример вызова:\n\
            ```json\n\
            {{ \"thought\": \"Мне нужно создать структуру папок для инвентаря.\", \"tool\": \"mkdir\", \"path\": \"inventory\" }}\n\
            ```\n\
            После вызова инструмента ты получишь Observation (результат). Не ври о результате, пока не увидишь его.\n\
            \n\
            ### ПРАВИЛА ВЫВОДА (UX Standards):\n\
            2. **Brief Reports**: Если ты изменил что-то в файловой системе, в конце финального ответа (в инструменте `finish`) ОБЯЗАТЕЛЬНО выведи краткую сводку изменений.\n\
            3. **Style Sync**: Подстраивайся под стиль пользователя. Если он пишет кратко — отвечай кратко. Если просит детали — давай детали.\n\
            4. **Thought Protocol**: Все свои размышления и промежуточные шаги пиши внутри блока Thought. Они будут отображены в системной плашке, а пользователь увидит только результат.\n\
            \n\
            ### Твоё поведение:\n\
            - СТРОГО соблюдай иерархию папок.\n\
            - Лимит: Ты можешь сделать максимум 7 шагов в одной задаче.\n\
            - Твоя база знаний — это РЕАЛЬНЫЕ файлы, которые ты видишь через инструменты.\n\
            Сегодняшняя дата: {}\n",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
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
                sections.push(format!(
                    "# Project Context\n\
                    КРИТИЧЕСКИ ВАЖНО: Ты находишься в режиме РАБОТЫ С ПРОЕКТОМ.\n\
                    Абсолютный путь к проекту на диске: {}\n\
                    При вызове инструментов (mkdir, write_file, ls, read) ВСЕГДА используй ТОЛЬКО ОТНОСИТЕЛЬНЫЕ пути.\n\
                    Правильно: \"inventory/data.json\" или \"src/main.rs\"\n\
                    НЕПРАВИЛЬНО: \"G:\\\\Project\\\\VladTea\\\\inventory\\\\data.json\" или \"/home/user/...\"\n\
                    Система автоматически добавит корневой путь проекта.\n",
                    path_str
                ));

                // Scan .rules/*.md and CLAW.md
                let root = std::path::Path::new(path_str);
                let mut local_rules = Vec::new();

                // Check CLAUDE.md / CLAW.md / instructions.md
                for candidate in ["CLAUDE.md", "CLAW.md", "instructions.md", ".rules/instructions.md"] {
                    let p = root.join(candidate);
                    if p.exists() {
                        if let Ok(content) = std::fs::read_to_string(p) {
                            local_rules.push(format!("## File: {}\n{}", candidate, content));
                        }
                    }
                }

                // Check .rules/*.md
                let rules_dir = root.join(".rules");
                if rules_dir.is_dir() {
                    if let Ok(entries) = std::fs::read_dir(rules_dir) {
                        for entry in entries.flatten() {
                            let p = entry.path();
                            if p.extension().map_or(false, |ext| ext == "md") {
                                if let Ok(content) = std::fs::read_to_string(&p) {
                                    let name = p.file_name().unwrap().to_string_lossy();
                                    local_rules.push(format!("## Rule: {}\n{}", name, content));
                                }
                            }
                        }
                    }
                }

                if !local_rules.is_empty() {
                    sections.push(format!("# Local Project Rules\n{}\n", local_rules.join("\n\n")));
                }
            }

            // Get Active Skills
            let mut stmt = conn
                .prepare(
                    "SELECT s.name, s.path FROM available_skills s 
                     JOIN project_skills ps ON s.id = ps.skill_id 
                     WHERE ps.project_id = ?1 AND ps.is_active = 1",
                )
                .map_err(|e| e.to_string())?;

            let skill_entries = stmt
                .query_map([pid], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                })
                .map_err(|e| e.to_string())?;

            let mut skills_content = Vec::new();
            for skill in skill_entries.flatten() {
                let skill_name = skill.0;
                let skill_path = std::path::Path::new(&skill.1).join("SKILL.md");

                if skill_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(skill_path) {
                        skills_content.push(format!("## Skill: {}\n{}", skill_name, content));
                    }
                }
            }

            if !skills_content.is_empty() {
                sections.push(format!(
                    "# Active Skills Enabled\nThese are the specialized instructions for currently active skills:\n\n{}",
                    skills_content.join("\n\n")
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
        cancellation_token: Arc<AtomicBool>,
        on_step: impl Fn(serde_json::Value) + Send + Sync + 'static,
    ) -> Result<String, String> {
        let on_step = std::sync::Arc::new(on_step);
        use crate::modules::ollama::OllamaService;
        let ollama = OllamaService::new();
        let executor = ToolExecutor::new();
        
        let model = self.get_active_model(app).await;
        log::info!("[AGENT] Initializing loop with model: '{}'", model);
        
        let system_prompt = match self.build_system_prompt(app, project_id.clone()) {
            Ok(p) => p,
            Err(e) => {
                log::error!("[AGENT] System prompt build failed: {}", e);
                return Err(format!("System Prompt Error: {}", e));
            }
        };
        log::info!("[AGENT] System prompt built successfully (length: {})", system_prompt.len());
        let db_path = app.path().app_data_dir().map_err(|e| e.to_string())?.join("auraos.db");
        
        // Resolve project root for safety
        let project_root: Option<String> = if let Some(pid) = project_id {
            if let Ok(conn) = rusqlite::Connection::open(&db_path) {
                conn.query_row("SELECT path FROM project_index WHERE id = ?1", [&pid], |row| row.get(0)).ok()
            } else { None }
        } else { None };

        // Build history: system prompt is passed separately to generate_streaming,
        // so history only needs the user message to avoid double system context.
        let mut history = vec![
            format!("User: {}", user_message)
        ];

        let mut final_response = String::new();
        let max_steps = 7;

        for step in 1..=max_steps {
            if cancellation_token.load(Ordering::SeqCst) {
                log::info!("[AGENT] Loop cancelled at step {}", step);
                return Err("cancelled".to_string());
            }

            log::info!("[AGENT] Step {}/{}", step, max_steps);
            let prompt = history.join("\n\n");
            
            // 1. Generate response with streaming thoughts
            let on_step_clone = on_step.clone();
            let cancellation_token_clone = cancellation_token.clone();
            let response = ollama.generate_streaming(&model, &system_prompt, &prompt, Some(cancellation_token_clone), move |chunk| {
                on_step_clone(serde_json::json!({
                    "step": step,
                    "type": "thought_chunk",
                    "content": chunk
                }));
            }).await?;
            
            if cancellation_token.load(Ordering::SeqCst) {
                 return Err("cancelled".to_string());
            }

            // Emit full thought for status bar logging
            on_step(serde_json::json!({
                "step": step,
                "type": "thought",
                "content": response.clone()
            }));

            log::info!("[AGENT] Step {} response received (length: {})", step, response.len());
            
            // 2. Parse and execute ALL tool calls in the response
            let mut tool_results = Vec::new();
            
            // Try to find markdown blocks first: ```json ... ```
            let mut json_blocks = Vec::new();
            let mut search_text = response.as_str();
            
            while let Some(start_idx) = search_text.find("```json") {
                let after_tag = &search_text[start_idx + 7..];
                if let Some(end_idx) = after_tag.find("```") {
                    let json_content = &after_tag[..end_idx].trim();
                    json_blocks.push(json_content.to_string());
                    search_text = &after_tag[end_idx + 3..];
                } else {
                    break;
                }
            }
            
            // If no markdown blocks, fall back to finding all { ... } structures
            if json_blocks.is_empty() {
                let mut current_pos = 0;
                while let Some(start) = response[current_pos..].find('{') {
                    let abs_start = current_pos + start;
                    let mut brace_count = 0;
                    let mut end_pos = None;
                    
                    for (i, c) in response[abs_start..].chars().enumerate() {
                        if c == '{' { brace_count += 1; }
                        else if c == '}' { brace_count -= 1; }
                        
                        if brace_count == 0 {
                            end_pos = Some(abs_start + i + 1);
                            break;
                        }
                    }
                    
                    if let Some(end) = end_pos {
                        json_blocks.push(response[abs_start..end].to_string());
                        current_pos = end;
                    } else {
                        break;
                    }
                }
            }

            // Execute all found blocks
            for json_str in json_blocks {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    if let Some(tool) = v.get("tool").and_then(|t| t.as_str()) {
                        let call = ToolCall {
                            name: tool.to_string(),
                            path: v.get("path").and_then(|p| p.as_str()).map(|s| s.to_string()),
                            pattern: v.get("pattern").and_then(|p| p.as_str()).map(|s| s.to_string()),
                            content: v.get("content").and_then(|c| c.as_str()).map(|s| s.to_string()),
                        };

                        log::info!("[AGENT] Executing tool: {}", call.name);
                        on_step(serde_json::json!({
                            "step": step,
                            "type": "tool_start",
                            "tool": call.name,
                            "args": call.path.clone().unwrap_or_default()
                        }));

                        if call.name == "finish" {
                            let msg = call.content.clone().unwrap_or_else(|| "Задача выполнена.".to_string());
                            on_step(serde_json::json!({
                                "step": step,
                                "type": "tool_result",
                                "success": true,
                                "output": msg.clone(),
                                "error": null
                            }));
                            final_response = msg;
                            // Break out of the execution loop
                            break;
                        }

                        let result = executor.execute(&call, &project_root);
                        
                        on_step(serde_json::json!({
                            "step": step,
                            "type": "tool_result",
                            "success": result.success,
                            "output": result.output,
                            "error": result.error.clone()
                        }));

                        // Format observation clearly so the LLM understands what happened
                        if result.success {
                            tool_results.push(format!(
                                "Observation from tool '{}': Успешно. {}",
                                call.name, result.output
                            ));
                        } else {
                            let err_msg = result.error.as_deref().unwrap_or("Неизвестная ошибка");
                            tool_results.push(format!(
                                "Observation from tool '{}': Ошибка — {}. Используй другой путь или вызови finish если задача выполнена.",
                                call.name, err_msg
                            ));
                        }
                    }
                }
            }
            
            // If we hit a finish tool, break the outer step loop too
            if !final_response.is_empty() {
                break;
            }

            if !tool_results.is_empty() {
                // 4. Feed results back to history
                let observation = tool_results.join("\n\n");
                history.push(format!("Assistant: {}\n\nObservation: {}", response, observation));
            } else {
                // No more tool calls, we are done
                final_response = response;
                break;
            }
        }

        if final_response.is_empty() {
            final_response = "Достигнут лимит шагов выполнения.".to_string();
        }

        Ok(final_response)
    }
}
