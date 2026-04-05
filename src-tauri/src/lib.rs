mod modules;

use modules::{ollama::OllamaService, Monitor, SkillEngine, SystemStats};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

struct AppState {
    monitor: Mutex<Monitor>,
    skill_engine: Mutex<SkillEngine>,
}

#[tauri::command]
fn get_system_stats(state: State<AppState>) -> Result<SystemStats, String> {
    let monitor = state
        .monitor
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    Ok(monitor.get_current_stats())
}

#[tauri::command]
fn get_skills(state: State<AppState>) -> Result<Vec<modules::SkillMetadata>, String> {
    let engine = state
        .skill_engine
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    engine.get_skills()
}

#[tauri::command]
fn add_skill(
    state: State<AppState>,
    id: String,
    name: String,
    path: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let engine = state
        .skill_engine
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    let metadata = modules::SkillMetadata {
        id,
        name,
        path: std::path::PathBuf::from(path),
        tags,
        is_indexed: false,
    };
    engine.index_skill(metadata)
}

#[tauri::command]
fn remove_skill(state: State<AppState>, id: String) -> Result<bool, String> {
    let engine = state
        .skill_engine
        .lock()
        .map_err(|e: std::sync::PoisonError<_>| e.to_string())?;
    engine.remove_skill(&id)
}

#[tauri::command]
async fn check_ollama_status() -> Result<modules::ollama::OllamaStatus, String> {
    let ollama = OllamaService::new();
    Ok(ollama.check_status().await)
}

#[tauri::command]
async fn run_inference(model: String, prompt: String, active_project_path: Option<String>, project_context: Option<String>) -> Result<String, String> {
    let ollama = OllamaService::new();
    
    let mut system_prompt = String::from(
        "Ты — интегральная часть AuraOS. У тебя есть доступ к файловой системе Виктора. \
        Никогда не говори, что ты не имеешь физического присутствия. Ты и есть этот компьютер. \
        Ты — локальный AI-ассистент Виктора на его машине (Ryzen 9 9950X3D, RTX 5080, 64GB RAM). \
        Отвечай технически точно, лаконично и по существу. Не упоминай облачные сервисы. \
        Не говори \"как ИИ\". Говори \"я\".\n\n"
    );
    
    if let Some(path) = &active_project_path {
        system_prompt.push_str(&format!("Текущая рабочая директория: {}\n", path));
    }
    
    if let Some(context) = &project_context {
        if !context.is_empty() {
            system_prompt.push_str("\nКонтекст проекта:\n");
            system_prompt.push_str(context);
            system_prompt.push_str("\nИспользуй эту информацию о проекте для ответов. ");
        }
    }
    
    let full_prompt = format!("{}{}", system_prompt, prompt);
    ollama.generate(&model, &full_prompt).await
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn run_inference_streaming(
    model: String, 
    prompt: String, 
    active_project_path: Option<String>, 
    project_context: Option<String>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let ollama = OllamaService::new();
    
    let mut system_prompt = String::from(
        "Ты — интегральная часть AuraOS. У тебя есть доступ к файловой системе Виктора. \
        Никогда не говори, что ты не имеешь物理ческого присутствия. Ты и есть этот компьютер. \
        Ты — локальный AI-ассистент Виктора на его машине (Ryzen 9 9950X3D, RTX 5080, 64GB RAM). \
        Отвечай технически точно, лаконично и по существу. Не упоминай облачные сервисы. \
        Не говори \"как ИИ\". Говори \"я\".\n\n"
    );
    
    if let Some(path) = &active_project_path {
        system_prompt.push_str(&format!("Текущая рабочая директория: {}\n", path));
    }
    
    if let Some(context) = &project_context {
        if !context.is_empty() {
            system_prompt.push_str("\nКонтекст проекта:\n");
            system_prompt.push_str(context);
            system_prompt.push_str("\nИспользуй эту информацию о проекте для ответов. ");
        }
    }
    
    let full_prompt = format!("{}{}", system_prompt, prompt);
    
    let app_handle = app.clone();
    let _result = ollama.generate_streaming(&model, &full_prompt, move |chunk| {
        let _ = app_handle.emit("inference-chunk", chunk);
    }).await?;
    
    Ok(())
}

#[tauri::command]
fn run_shell_command(command: String, cwd: String) -> Result<String, String> {
    use std::process::Command;
    
    let output = Command::new("cmd")
        .args(["/c", &command])
        .current_dir(&cwd)
        .output()
        .map_err(|e| e.to_string())?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if output.status.success() {
        Ok(stdout.to_string())
    } else {
        Ok(format!("{}{}", stdout, stderr))
    }
}

#[tauri::command]
fn run_admin_command(command: String, cwd: String) -> Result<String, String> {
    use std::process::Command;
    use std::os::windows::process::CommandExt;
    
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const CREATE_NEW_CONSOLE: u32 = 0x00000010;
    
    log::info!("Admin command: {} in {}", command, cwd);
    
    let escaped_command = command.replace("\"", "\\\"");
    let escaped_cwd = cwd.replace("\"", "\\\"");
    
    let cmd = format!(
        "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Start-Process cmd.exe -ArgumentList '/c {}' -WorkingDirectory '{}' -Verb RunAs -Wait\"",
        escaped_command, escaped_cwd
    );
    
    let output = Command::new("cmd")
        .args(["/c", &cmd])
        .creation_flags(CREATE_NO_WINDOW | CREATE_NEW_CONSOLE)
        .current_dir(&cwd)
        .output()
        .map_err(|e| {
            log::error!("Failed to execute admin command: {}", e);
            e.to_string()
        })?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if !stderr.is_empty() {
        log::warn!("Admin command stderr: {}", stderr);
    }
    
    if output.status.success() {
        Ok(stdout.to_string())
    } else {
        Ok(format!("{}{}", stdout, stderr))
    }
}

#[tauri::command]
fn get_project_context(path: String) -> Result<String, String> {
    let key_files = vec![
        "README.md", "README.txt", "readme.md",
        "package.json", "Cargo.toml", "pyproject.toml",
        "main.rs", "main.ts", "main.js", "index.ts", "index.js",
        "App.tsx", "App.js", "app.ts",
        "tsconfig.json", "jsconfig.json",
        ".gitignore", "Makefile",
    ];
    
    let mut context = String::new();
    let project_path = std::path::Path::new(&path);
    
    for filename in key_files {
        let file_path = project_path.join(filename);
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                let truncated = if content.len() > 4000 {
                    format!("{}...\n[контент обрезан]", &content[..4000])
                } else {
                    content
                };
                context.push_str(&format!("\n=== {} ===\n{}\n", filename, truncated));
            }
        }
    }
    
    Ok(context)
}

use modules::ollama::ModelConfig;

#[tauri::command]
async fn get_model_for_task(task_type: String) -> Result<Option<ModelConfig>, String> {
    let ollama = OllamaService::new();
    let status = ollama.check_status().await;
    
    let default_model = match task_type.as_str() {
        "logic" => "deepseek-r1:8b",
        "code" => "qwen2.5:14b",
        "docs" => "phi4:latest",
        "fast" => "llama3.1:8b",
        _ => "llama3.1:8b",
    };
    
    let model_exists = status.models.iter().any(|m| m.name.starts_with(&default_model.replace(":latest", "").replace(":8b", "").replace(":14b", "")));
    
    Ok(Some(ModelConfig {
        id: 0,
        task_type,
        model_name: if model_exists { default_model.to_string() } else { status.models.first().map(|m| m.name.clone()).unwrap_or_else(|| "llama3.1:8b".to_string()) },
        provider: "ollama".to_string(),
        parameters: serde_json::json!({"temperature": 0.7}),
    }))
}

#[tauri::command]
async fn save_model_assignment(task_type: String, model_name: String) -> Result<(), String> {
    log::info!("Saving model assignment: {} -> {}", task_type, model_name);
    Ok(())
}

#[tauri::command]
async fn get_model_assignments() -> Result<Vec<ModelConfig>, String> {
    Ok(vec![
        ModelConfig { id: 1, task_type: "logic".to_string(), model_name: "deepseek-r1:8b".to_string(), provider: "ollama".to_string(), parameters: serde_json::json!({"temperature": 0.7}) },
        ModelConfig { id: 2, task_type: "code".to_string(), model_name: "qwen2.5:14b".to_string(), provider: "ollama".to_string(), parameters: serde_json::json!({"temperature": 0.3}) },
        ModelConfig { id: 3, task_type: "docs".to_string(), model_name: "phi4:latest".to_string(), provider: "ollama".to_string(), parameters: serde_json::json!({"temperature": 0.5}) },
        ModelConfig { id: 4, task_type: "fast".to_string(), model_name: "llama3.1:8b".to_string(), provider: "ollama".to_string(), parameters: serde_json::json!({"temperature": 0.2}) },
    ])
}

#[tauri::command]
fn get_available_skills() -> Result<Vec<modules::SkillMetadata>, String> {
    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| std::env::var("HOME").unwrap_or("".to_string()));
    let skills_path = std::path::Path::new(&home).join(".opencode/skills");
    let plugins_path = std::path::Path::new(&home).join(".claude/plugins");
    
    let mut skills = Vec::new();
    
    for dir in [&skills_path, &plugins_path] {
        if dir.exists() {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let name = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        
                        if !name.starts_with('.') {
                            skills.push(modules::SkillMetadata {
                                id: name.clone(),
                                name: name.clone(),
                                path,
                                tags: vec![],
                                is_indexed: false,
                            });
                        }
                    }
                }
            }
        }
    }
    
    Ok(skills)
}

#[tauri::command]
fn delete_skill_folder(path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&path);
    if path.exists() && path.is_dir() {
        std::fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

#[tauri::command]
fn get_directory_tree(path: String) -> Result<Vec<FileNode>, String> {
    fn read_dir_recursive(dir: &std::path::Path, depth: usize) -> Vec<FileNode> {
        if depth > 5 {
            return vec![];
        }
        
        let mut nodes = Vec::new();
        
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return vec![],
        };
        
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            
            if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" || name == "build" {
                continue;
            }
            
            let is_dir = path.is_dir();
            let children = if is_dir {
                Some(read_dir_recursive(&path, depth + 1))
            } else {
                None
            };
            
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir,
                children,
            });
        }
        
        nodes.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            }
        });
        
        nodes
    }
    
    let root = std::path::Path::new(&path);
    if !root.exists() {
        return Err("Path does not exist".to_string());
    }
    
    Ok(read_dir_recursive(root, 0))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let mut monitor = Monitor::new();
            monitor.set_app_handle(app.handle().clone());
            monitor.start_emitting();

            let skill_engine = SkillEngine::new();

            app.manage(AppState {
                monitor: Mutex::new(monitor),
                skill_engine: Mutex::new(skill_engine),
            });

            let handle = app.handle().clone();
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
            
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Backquote);
            let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                log::info!("Global shortcut Ctrl+` triggered");
                if let Err(e) = handle.emit("toggle-terminal", ()) {
                    log::error!("Failed to emit toggle-terminal event: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            get_skills,
            add_skill,
            remove_skill,
            check_ollama_status,
            run_inference,
            run_inference_streaming,
            get_model_for_task,
            save_model_assignment,
            get_model_assignments,
            get_available_skills,
            delete_skill_folder,
            get_directory_tree,
            read_file_content,
            get_project_context,
            run_shell_command,
            run_admin_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
