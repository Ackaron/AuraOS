use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDefinition {
    pub name: String,
    pub role: String,
    pub description: String,
    pub goals: Vec<String>,
    pub rules: Vec<String>,
    pub capabilities: Vec<String>,
    pub source_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentManifest {
    pub name: String,
    pub role_type: String,
    pub description: String,
    pub goals: Vec<String>,
    pub rules: Vec<String>,
    pub capabilities: Vec<String>,
    pub metadata: Option<serde_json::Value>,
}

pub struct AgentRegistry {
    agents: Arc<RwLock<HashMap<String, AgentDefinition>>>,
    watch_paths: Vec<PathBuf>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
            watch_paths: Vec::new(),
        }
    }

    pub fn set_watch_path(&mut self, path: PathBuf) {
        self.watch_paths.push(path);
    }

    pub fn scan_agents(&self, agents_dir: &PathBuf) -> Result<Vec<AgentDefinition>, String> {
        let mut discovered = Vec::new();

        if !agents_dir.exists() {
            return Ok(discovered);
        }

        let entries = fs::read_dir(agents_dir).map_err(|e| e.to_string())?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "md" {
                        if let Ok(definition) = self.parse_agent_file(&path) {
                            discovered.push(definition);
                        }
                    }
                }
            }
        }

        // Update internal state
        let mut agents = self.agents.write().map_err(|e| e.to_string())?;
        agents.clear();
        for agent in &discovered {
            agents.insert(agent.name.clone(), agent.clone());
        }

        Ok(discovered)
    }

    fn parse_agent_file(&self, path: &PathBuf) -> Result<AgentDefinition, String> {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;

        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Parse markdown for role information
        let mut role = String::new();
        let mut description = String::new();
        let mut goals = Vec::new();
        let mut rules = Vec::new();
        let mut capabilities = Vec::new();

        let mut current_section = String::new();

        for line in content.lines() {
            let trimmed = line.trim();

            if trimmed.starts_with("## ")
                && !trimmed.starts_with("## 🎯")
                && !trimmed.starts_with("## 📜")
                && !trimmed.starts_with("## 🛠")
                && !trimmed.starts_with("## 🧰")
            {
                current_section = trimmed.trim_start_matches("## ").to_lowercase();
            } else if trimmed.starts_with("### ") {
                current_section = trimmed.trim_start_matches("### ").to_lowercase();
            } else if trimmed.starts_with("- **") && current_section == "goals" {
                if let Some(goal) = trimmed.strip_prefix("- **") {
                    goals.push(goal.trim_end_matches("**").to_string());
                }
            } else if trimmed.starts_with("- ") && current_section == "goals" {
                goals.push(trimmed.trim_start_matches("- ").to_string());
            } else if trimmed.starts_with("1. **") && current_section == "rules" {
                if let Some(rule) = trimmed.strip_prefix("1. **") {
                    rules.push(rule.split("**").next().unwrap_or("").to_string());
                }
            } else if trimmed.starts_with("- ") && current_section == "capabilities" {
                capabilities.push(trimmed.trim_start_matches("- ").to_string());
            }
        }

        // Extract description from first paragraph
        for line in content.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with("##") {
                description = trimmed.to_string();
                break;
            }
        }

        // Try to extract role type from content
        if content.contains("Planner") || content.contains("strategist") {
            role = "planner".to_string();
        } else if content.contains("Executor") || content.contains("Design Engineer") {
            role = "executor".to_string();
        } else if content.contains("Verifier") || content.contains("Quality Guard") {
            role = "verifier".to_string();
        } else {
            role = name.clone();
        }

        Ok(AgentDefinition {
            name,
            role,
            description,
            goals,
            rules,
            capabilities,
            source_path: path.clone(),
        })
    }

    pub fn get_agents(&self) -> Result<Vec<AgentDefinition>, String> {
        let agents = self.agents.read().map_err(|e| e.to_string())?;
        Ok(agents.values().cloned().collect())
    }

    pub fn get_agent(&self, name: &str) -> Result<Option<AgentDefinition>, String> {
        let agents = self.agents.read().map_err(|e| e.to_string())?;
        Ok(agents.get(name).cloned())
    }

    pub fn get_agent_prompt(&self, name: &str) -> Result<String, String> {
        let agents = self.agents.read().map_err(|e| e.to_string())?;

        if let Some(agent) = agents.get(name) {
            let content = fs::read_to_string(&agent.source_path).map_err(|e| e.to_string())?;
            Ok(content)
        } else {
            Err(format!("Agent not found: {}", name))
        }
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}
