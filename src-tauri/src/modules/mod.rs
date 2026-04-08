pub mod monitor;
pub mod skill_engine;
pub mod ollama;
pub mod agent_engine;
pub mod plugin_manager;
pub mod agent_registry;
pub mod command_registry;
pub mod mcp_client;
pub mod context_manager;

pub use monitor::{Monitor, SystemStats};
pub use skill_engine::{SkillEngine, SkillMetadata, SkillManifest, SkillContent};
pub use agent_engine::AgentEngine;
pub use plugin_manager::{download_and_extract_plugin, remove_plugin};
pub use agent_registry::{AgentRegistry, AgentDefinition};
pub use command_registry::{CommandRegistry, CommandDefinition};
pub use mcp_client::{McpClient, McpServerConfig, McpServerStatus};
pub use context_manager::{ContextManager, SessionState, CompactBoundary};
