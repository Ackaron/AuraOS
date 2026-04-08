use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandDefinition {
    pub name: String,
    pub description: String,
    pub content: String,
    pub source_path: PathBuf,
}

pub struct CommandRegistry {
    commands: Arc<RwLock<HashMap<String, CommandDefinition>>>,
}

impl CommandRegistry {
    pub fn new() -> Self {
        Self {
            commands: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn scan_commands(&self, commands_dir: &PathBuf) -> Result<Vec<CommandDefinition>, String> {
        let mut discovered = Vec::new();

        if !commands_dir.exists() {
            return Ok(discovered);
        }

        let entries = fs::read_dir(commands_dir).map_err(|e| e.to_string())?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "md" {
                        if let Ok(definition) = self.parse_command_file(&path) {
                            discovered.push(definition);
                        }
                    }
                }
            }
        }

        let mut commands = self.commands.write().map_err(|e| e.to_string())?;
        commands.clear();
        for cmd in &discovered {
            commands.insert(cmd.name.clone(), cmd.clone());
        }

        Ok(discovered)
    }

    fn parse_command_file(&self, path: &PathBuf) -> Result<CommandDefinition, String> {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;

        let name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Extract description from first paragraph
        let mut description = String::new();
        for line in content.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty()
                && !trimmed.starts_with('#')
                && !trimmed.starts_with("##")
                && !trimmed.starts_with('-')
            {
                description = trimmed.to_string();
                break;
            }
        }

        Ok(CommandDefinition {
            name,
            description,
            content,
            source_path: path.clone(),
        })
    }

    pub fn get_commands(&self) -> Result<Vec<CommandDefinition>, String> {
        let commands = self.commands.read().map_err(|e| e.to_string())?;
        Ok(commands.values().cloned().collect())
    }

    pub fn get_command(&self, name: &str) -> Result<Option<CommandDefinition>, String> {
        let commands = self.commands.read().map_err(|e| e.to_string())?;
        Ok(commands.get(name).cloned())
    }
}

impl Default for CommandRegistry {
    fn default() -> Self {
        Self::new()
    }
}
