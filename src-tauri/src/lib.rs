mod modules;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::io::{Write, BufReader, BufRead};
use std::thread;
use tauri::{Emitter, Manager, State, AppHandle, Listener};
use crate::modules::{ollama::OllamaService, Monitor, SkillEngine, SystemStats, AgentEngine};
use notify::{Watcher, RecursiveMode, Config};

struct TerminalSession {
    child: Child,
    stdin: std::process::ChildStdin,
    cwd: String,
}

struct AppState {
    monitor: Mutex<Monitor>,
    skill_engine: Mutex<SkillEngine>,
    agent_engine: Mutex<AgentEngine>,
    terminal_sessions: Mutex<HashMap<String, Arc<Mutex<TerminalSession>>>>,
    agent_cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
    // New: Active file watcher
    file_watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

#[tauri::command]
async fn watch_project(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let mut watcher_guard = state.file_watcher.lock().map_err(|e| e.to_string())?;
    
    // Stop old watcher if exists
    *watcher_guard = None;

    let path_to_watch = std::path::PathBuf::from(&path);
    if !path_to_watch.exists() {
        return Err("Project path does not exist".to_string());
    }

    let (tx, rx) = std::sync::mpsc::channel();
    
    let mut watcher = notify::RecommendedWatcher::new(
        move |res| {
            let _ = tx.send(res);
        },
        Config::default(),
    ).map_err(|e| e.to_string())?;

    watcher
        .watch(&path_to_watch, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *watcher_guard = Some(watcher);

    // Spawn a thread to handle events and emit to frontend
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        while let Ok(res) = rx.recv() {
            match res {
                Ok(_) => {
                    // Debounce is ideal but for now we just emit
                    let _ = app_handle_clone.emit("file-tree-update", ());
                }
                Err(e) => println!("Watch error: {:?}", e),
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn get_system_stats(state: State<AppState>) -> Result<SystemStats, String> {
    let monitor = state
        .monitor
        .lock()
        .map_err(|e| e.to_string())?;
    Ok(monitor.get_current_stats())
}

#[tauri::command]
fn get_skills(state: State<AppState>) -> Result<Vec<modules::SkillMetadata>, String> {
    let engine = state
        .skill_engine
        .lock()
        .map_err(|e| e.to_string())?;
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
        .map_err(|e| e.to_string())?;
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
        .map_err(|e| e.to_string())?;
    engine.remove_skill(&id)
}

#[tauri::command]
async fn check_ollama_status() -> Result<modules::ollama::OllamaStatus, String> {
    let ollama = OllamaService::new();
    Ok(ollama.check_status().await)
}

#[tauri::command]
async fn run_inference(
    state: State<'_, AppState>,
    app: AppHandle,
    model: String, 
    prompt: String, 
    project_id: Option<String>
) -> Result<String, String> {
    let ollama = OllamaService::new();
    let system_prompt = {
        let agent = state.agent_engine.lock().unwrap();
        agent.build_system_prompt(&app, project_id)?
    };

    ollama.generate(&model, &system_prompt, &prompt).await
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn run_inference_streaming(
    state: State<'_, AppState>,
    app: AppHandle,
    model: String, 
    prompt: String, 
    project_id: Option<String>,
) -> Result<(), String> {
    let ollama = OllamaService::new();
    let system_prompt = {
        let agent = state.agent_engine.lock().unwrap();
        agent.build_system_prompt(&app, project_id)?
    };
    
    let app_handle = app.clone();
    let _result = ollama.generate_streaming(&model, &system_prompt, &prompt, None, move |chunk| {
        let _ = app_handle.emit("inference-chunk", chunk);
    }).await?;
    
    Ok(())
}

#[tauri::command]
async fn run_reactive_agent(
    state: State<'_, AppState>,
    app: AppHandle,
    prompt: String,
    project_id: Option<String>,
    session_id: String,
) -> Result<String, String> {
    let agent = state.agent_engine.lock().unwrap().clone();
    
    // Create and register cancellation token
    let cancel_token = Arc::new(AtomicBool::new(false));
    {
        let mut cancels = state.agent_cancels.lock().map_err(|e| e.to_string())?;
        cancels.insert(session_id.clone(), cancel_token.clone());
    }

    let app_handle = app.clone();
    let result = agent.run_loop(&app, project_id, prompt, cancel_token.clone(), move |step_data| {
        let _ = app_handle.emit("agent-step", step_data);
    }).await;

    // Cleanup cancellation token
    {
        let mut cancels = state.agent_cancels.lock().map_err(|e| e.to_string())?;
        cancels.remove(&session_id);
    }

    result
}

#[tauri::command]
fn stop_reactive_agent(state: State<AppState>, session_id: String) -> Result<(), String> {
    let cancels = state.agent_cancels.lock().map_err(|e| e.to_string())?;
    if let Some(token) = cancels.get(&session_id) {
        token.store(true, Ordering::SeqCst);
        log::info!("[AGENT] Stop signal sent to session: {}", session_id);
    }
    Ok(())
}

#[tauri::command]
async fn save_terminal_session(content: String, name: String) -> Result<String, String> {
    let base_path = "G:\\Project\\AuraOS\\vault\\sessions";
    std::fs::create_dir_all(base_path).map_err(|e| e.to_string())?;
    
    let now = chrono::Local::now();
    let filename = format!("{}_{}.md", now.format("%Y-%m-%d"), name.replace(" ", "_"));
    let full_path = std::path::Path::new(base_path).join(&filename);
    
    std::fs::write(&full_path, content).map_err(|e| e.to_string())?;
    
    Ok(full_path.to_string_lossy().to_string())
}

fn is_admin() -> bool {
    #[cfg(windows)]
    {
        use std::ptr;
        use winapi::um::processthreadsapi::{GetCurrentProcess, OpenProcessToken};
        use winapi::um::securitybaseapi::GetTokenInformation;
        use winapi::um::winnt::{TokenElevation, HANDLE, TOKEN_ELEVATION, TOKEN_QUERY};

        let mut token: HANDLE = ptr::null_mut();
        unsafe {
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) != 0 {
                let mut elevation = TOKEN_ELEVATION { TokenIsElevated: 0 };
                let mut size = std::mem::size_of::<TOKEN_ELEVATION>() as u32;
                if GetTokenInformation(token, TokenElevation, &mut elevation as *mut _ as *mut _, size, &mut size) != 0 {
                    return elevation.TokenIsElevated != 0;
                }
            }
        }
    }
    false
}

#[tauri::command]
fn create_terminal_session(app: AppHandle, state: State<AppState>, id: String, cwd: String) -> Result<(), String> {
    let mut sessions = state.terminal_sessions.lock().unwrap();
    
    if sessions.contains_key(&id) {
        return Ok(());
    }

    if !is_admin() {
        let _ = app.emit("terminal-error", "⚠️ AuraOS is NOT running as Admin. Some commands may fail. To get full Admin Terminal, please restart AuraOS as Administrator.");
    }

    let mut child = Command::new("powershell")
        .args(["-NoLogo", "-NoExit", "-Command", "-"])
        .current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open stderr")?;

    // Streaming thread for stdout
    let app_clone = app.clone();
    let session_id = id.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = app_clone.emit(&format!("terminal-data-{}", session_id), l);
            }
        }
    });

    // Streaming thread for stderr
    let app_clone = app.clone();
    let session_id_err = id.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(l) = line {
                let _ = app_clone.emit(&format!("terminal-error-{}", session_id_err), l);
            }
        }
    });

    sessions.insert(id, Arc::new(Mutex::new(TerminalSession { child, stdin, cwd })));
    Ok(())
}

fn kill_session(session: &mut TerminalSession) {
    let pid = session.child.id();
    #[cfg(windows)]
    {
        // /F = Force, /T = Tree
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = session.child.kill();
    }
}

#[tauri::command]
async fn add_plugin(app: AppHandle, github_url: String) -> Result<crate::modules::plugin_manager::PluginInstallResult, String> {
    crate::modules::download_and_extract_plugin(app, github_url).await
}

#[tauri::command]
fn delete_plugin(path: String) -> Result<(), String> {
    crate::modules::remove_plugin(path)
}

#[tauri::command]
fn close_terminal_session(state: State<AppState>, id: String) -> Result<(), String> {
    let mut sessions = state.terminal_sessions.lock().unwrap();
    if let Some(session_arc) = sessions.remove(&id) {
        let mut session = session_arc.lock().unwrap();
        kill_session(&mut session);
    }
    Ok(())
}

#[tauri::command]
fn interrupt_terminal_session(state: State<AppState>, id: String) -> Result<(), String> {
    let sessions = state.terminal_sessions.lock().unwrap();
    if let Some(session_arc) = sessions.get(&id) {
        let mut session = session_arc.lock().unwrap();
        kill_session(&mut session);
    }
    Ok(())
}

#[tauri::command]
fn run_shell_command(_app: AppHandle, state: State<AppState>, session_id: String, command: String, cwd: String) -> Result<String, String> {
    let sessions = state.terminal_sessions.lock().unwrap();
    let session_arc = sessions.get(&session_id).ok_or("Session not found")?;
    let mut session = session_arc.lock().unwrap();

    // Execute command by writing to stdin
    let full_command = format!("cd '{}'; {}\n", cwd, command);
    session.stdin.write_all(full_command.as_bytes()).map_err(|e: std::io::Error| e.to_string())?;
    session.stdin.flush().map_err(|e: std::io::Error| e.to_string())?;
    
    Ok("Sent".to_string())
}

#[tauri::command]
fn run_admin_command(_app: AppHandle, command: String, cwd: String) -> Result<String, String> {
    let cmd = format!(
        "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Start-Process cmd.exe -ArgumentList '/k {}' -WorkingDirectory '{}' -Verb RunAs\"",
        command.replace("\"", "\\\""), cwd.replace("\"", "\\\"")
    );
    
    let _ = Command::new("cmd")
        .args(["/c", &cmd])
        .spawn()
        .map_err(|e| e.to_string())?;
        
    Ok("Elevated process started in new window. To see output here, run AuraOS as Administrator.".to_string())
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

use crate::modules::ollama::ModelConfig;

#[tauri::command]
async fn run_autonomous_agent(
    prompt: String,
    model: Option<String>,
    system_context: Option<String>,
    app: AppHandle,
) -> Result<String, String> {
    use crate::modules::agent_engine::{ToolCall, ToolExecutor};
    
    let ollama = OllamaService::new();
    let executor = ToolExecutor::new();
    
    let mut system_prompt = String::from(
        "Ты — автономный агент AuraOS. Ты можешь самостоятельно использовать инструменты для выполнения задач. \
        Когда тебе нужно получить информацию о файлах или директориях, ты МОЖЕШЬ вызвать инструмент. \
        Отвечай технически точно и лаконично.\n\n\
        Доступные инструменты:\n\
        - ls(path) — показать содержимое директории\n\
        - read(path) — прочитать содержимое файла\n\
        - grep(pattern, path) — поиск по файлам\n\n\
        Если тебе нужно узнать содержимое директории или файла, ответь JSON-ом:\n\
        {{\"tool\": \"ls\", \"path\": \".\"}}\n\
        или\n\
        {{\"tool\": \"read\", \"path\": \"путь/к/файлу\"}}\n\n\
        Иначе просто ответь на вопрос пользователя.\n\n"
    );
    
    if let Some(ctx) = &system_context {
        system_prompt.push_str("\nКонтекст проекта:\n");
        system_prompt.push_str(ctx);
        system_prompt.push_str("\n");
    }
    
    log::info!("[AGENT] Thought: {}", prompt);
    let response: String = ollama.generate(
        &model.unwrap_or_else(|| "llama3.1:8b".to_string()), 
        &system_prompt, 
        &prompt
    ).await?;
    log::info!("[AGENT] Response received, parsing tool calls...");
    
    let tool_calls = {
        let mut calls = Vec::new();
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(response.trim()) {
            if let Some(tool) = json.get("tool").and_then(|v| v.as_str()) {
                calls.push(ToolCall {
                    name: tool.to_string(),
                    path: json.get("path").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    pattern: json.get("pattern").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    content: json.get("content").and_then(|v| v.as_str()).map(|s| s.to_string()),
                });
            }
        }
        calls
    };
    
    if tool_calls.is_empty() {
        let _ = app.emit("agent-complete", &response);
        return Ok(response);
    }
    
    for call in tool_calls {
        log::info!("[TOOL] Executing {} with path: {:?}", call.name, call.path);
        let result = executor.execute(&call, &None);
        log::info!("[OBSERVATION] Tool result: success={}, output_length={}", result.success, result.output.len());
        let _ = app.emit("tool-execution", serde_json::json!({
            "tool": call.name,
            "path": call.path,
            "result": result.output
        }));
    }
    
    let _ = app.emit("agent-complete", &response);
    Ok(response)
}

#[tauri::command]
fn execute_tool(name: String, path: Option<String>, pattern: Option<String>, project_root: Option<String>) -> Result<modules::agent_engine::ToolResult, String> {
    use crate::modules::agent_engine::{ToolCall, ToolExecutor};
    let executor = ToolExecutor::new();
    let call = ToolCall {
        name,
        path,
        pattern,
        content: None,
    };
    Ok(executor.execute(&call, &project_root))
}

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
            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_fullscreen(true);

            let mut monitor = Monitor::new();
            monitor.set_app_handle(app.handle().clone());
            monitor.start_emitting();

            let skill_engine = SkillEngine::new();

            app.manage(AppState {
                monitor: Mutex::new(monitor),
                skill_engine: Mutex::new(skill_engine),
                agent_engine: Mutex::new(modules::AgentEngine::new()),
                terminal_sessions: Mutex::new(HashMap::new()),
                agent_cancels: Mutex::new(HashMap::new()),
                file_watcher: Mutex::new(None),
            });

            // Handle clean exit by killing all terminal sessions
            let handle = app.handle().clone();
            app.listen("tauri://close-requested", move |_| {
                let state = handle.state::<AppState>();
                let mut sessions = state.terminal_sessions.lock().unwrap();
                for (_, session_arc) in sessions.drain() {
                    let mut session = session_arc.lock().unwrap();
                    kill_session(&mut session);
                }
            });

            let handle = app.handle().clone();
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
            
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Backquote);
            let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                    log::info!("Global shortcut Ctrl+` triggered");
                    if let Err(e) = handle.emit("toggle-terminal", ()) {
                        log::error!("Failed to emit toggle-terminal event: {}", e);
                    }
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
            run_autonomous_agent,
            execute_tool,
            create_terminal_session,
            close_terminal_session,
            interrupt_terminal_session,
            add_plugin,
            delete_plugin,
            save_terminal_session,
            run_reactive_agent,
            stop_reactive_agent,
            watch_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
