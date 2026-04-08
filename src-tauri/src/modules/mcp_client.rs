use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServerStatus {
    pub name: String,
    pub running: bool,
    pub tools: Vec<McpTool>,
    pub error: Option<String>,
}

pub struct McpClient {
    servers: std::sync::Mutex<HashMap<String, McpServerConfig>>,
    processes: std::sync::Mutex<HashMap<String, Child>>,
    status: std::sync::Mutex<HashMap<String, McpServerStatus>>,
}

impl McpClient {
    pub fn new() -> Self {
        Self {
            servers: std::sync::Mutex::new(HashMap::new()),
            processes: std::sync::Mutex::new(HashMap::new()),
            status: std::sync::Mutex::new(HashMap::new()),
        }
    }

    pub fn register_server(&self, name: String, config: McpServerConfig) -> Result<(), String> {
        let mut servers = self.servers.lock().map_err(|e| e.to_string())?;
        servers.insert(name.clone(), config);

        let mut status = self.status.lock().map_err(|e| e.to_string())?;
        status.insert(
            name.clone(),
            McpServerStatus {
                name,
                running: false,
                tools: vec![],
                error: None,
            },
        );

        Ok(())
    }

    pub fn get_registered_servers(&self) -> Result<Vec<String>, String> {
        let servers = self.servers.lock().map_err(|e| e.to_string())?;
        Ok(servers.keys().cloned().collect())
    }

    pub fn start_server(&self, name: &str) -> Result<(), String> {
        let config = {
            let servers = self.servers.lock().map_err(|e| e.to_string())?;
            servers
                .get(name)
                .cloned()
                .ok_or_else(|| format!("Server not found: {}", name))?
        };

        log::info!(
            "[MCP] Starting server: {} with command: {}",
            name,
            config.command
        );

        let mut cmd = Command::new(&config.command);
        cmd.args(&config.args);

        for (key, value) in &config.env {
            cmd.env(key, value);
        }

        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start MCP server: {}", e))?;

        {
            let mut processes = self.processes.lock().map_err(|e| e.to_string())?;
            processes.insert(name.to_string(), child);
        }

        {
            let mut status = self.status.lock().map_err(|e| e.to_string())?;
            if let Some(s) = status.get_mut(name) {
                s.running = true;
                s.error = None;
            }
        }

        Ok(())
    }

    pub fn stop_server(&self, name: &str) -> Result<(), String> {
        let mut processes = self.processes.lock().map_err(|e| e.to_string())?;

        if let Some(mut child) = processes.remove(name) {
            let _ = child.kill();
        }

        let mut status = self.status.lock().map_err(|e| e.to_string())?;
        if let Some(s) = status.get_mut(name) {
            s.running = false;
        }

        Ok(())
    }

    pub fn get_server_status(&self, name: &str) -> Result<McpServerStatus, String> {
        let status = self.status.lock().map_err(|e| e.to_string())?;
        status
            .get(name)
            .cloned()
            .ok_or_else(|| format!("Server not found: {}", name))
    }

    pub fn get_all_status(&self) -> Result<Vec<McpServerStatus>, String> {
        let status = self.status.lock().map_err(|e| e.to_string())?;
        Ok(status.values().cloned().collect())
    }

    pub fn call_tool(
        &self,
        server_name: &str,
        _tool_name: &str,
        _arguments: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let is_running = {
            let status = self.status.lock().map_err(|e| e.to_string())?;
            status.get(server_name).map(|s| s.running).unwrap_or(false)
        };

        if !is_running {
            return Err(format!("MCP server '{}' is not running", server_name));
        }

        Ok(serde_json::json!({
            "success": true,
            "message": "MCP tool call placeholder - server is running",
            "server": server_name
        }))
    }
}

impl Default for McpClient {
    fn default() -> Self {
        Self::new()
    }
}
