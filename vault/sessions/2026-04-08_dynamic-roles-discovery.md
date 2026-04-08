# Session: Dynamic Roles Discovery & Model Router

**Date:** 2026-04-08
**Phase:** Phase 2.4 + 2.5 Implementation

## Goals
- Dynamic agent discovery from `.claude/agents/*.md`
- Model Router UI with dynamic roles
- Replace static Logic/Code/Docs/Fast with file-driven roles

## Actions Taken

### 1. Agent Discovery Implementation
- Added `find_project_root()` function to locate project root from any working directory
- Modified `get_discovered_agents` to scan on every call
- Fixed parsing order (Verifier before Executor to avoid misclassification)

### 2. Frontend Updates
- Added `discoveredAgents` to Zustand store
- Updated `ModelRouterPanel` to show dynamic roles from `.claude/agents/`
- Connected agent loading in `App.tsx`

### 3. Rust Backend
- `agent_registry.rs`: Parse agents from markdown files
- `lib.rs`: Commands to get/discover agents
- Fixed path resolution for dev vs release builds

## Key Files Modified
- `src/stores/auraStore.ts` - added discoveredAgents
- `src/components/ModelRouterPanel/ModelRouterPanel.tsx` - dynamic roles UI
- `src/App.tsx` - load agents on startup
- `src-tauri/src/modules/agent_registry.rs` - agent parsing
- `src-tauri/src/lib.rs` - agent commands, project root finder

## Result
- ✅ 3 roles discovered: planner, executor, verifier
- ✅ Name = filename (without .md)
- ✅ Description = first goal from file
- ✅ Models displayed for selection

## Next Steps
- Connect selected role to agent execution (use role's instructions)
- Add command palette
- Implement layered system prompt with agent instructions
