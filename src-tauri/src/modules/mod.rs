pub mod monitor;
pub mod skill_engine;
pub mod ollama;
pub mod agent_engine;
pub mod plugin_manager;

pub use monitor::{Monitor, SystemStats};
pub use skill_engine::{SkillEngine, SkillMetadata};
pub use agent_engine::AgentEngine;
pub use plugin_manager::{download_and_extract_plugin, remove_plugin};
