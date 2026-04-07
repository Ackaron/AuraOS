---
type: adr
status: proposed
date: 2026-04-06
author: AuraOS Executor
tags: [architecture, agent-engine, claw-integration, rust]
---

# ADR-011: Aura-Claw Bridge — Autonomous Agent Loop

## 📜 Decision Summary

Integrate Claw Code's autonomous agent loop pattern (Thought → Action → Observation) into AuraOS Rust backend. The goal: Agent reads files and proposes edits WITHOUT explicit `/read` commands.

---

## 🔍 Context

### Current State (AuraOS v1.0)
- Ollama integration via `OllamaService` in `src-tauri/src/modules/ollama.rs`
- Model Router assigns tasks to models (logic → deepseek-r1, code → qwen2.5)
- No autonomous tool execution — requires explicit commands

### Claw Code Pattern (Reference)
- `runtime.py:154-167` — `run_turn_loop()`: multi-turn agent cycle
- `tools.py:81-86` — `execute_tool()`: tool execution abstraction
- `query_engine.py` — token budget, turn limiting, transcript compaction

---

## 🎯 Architecture Components

### 1. Agent Loop Decomposition

```
┌─────────────────────────────────────────────────────────────────┐
│                    AuraOS Agent Loop                              │
├─────────────────────────────────────────────────────────────────┤
│  USER INPUT                                                     │
│       ↓                                                          │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │   Route Prompt   │ ──▶ │  Detect Tool     │                  │
│  │  (token match)   │     │  Request          │                  │
│  └──────────────────┘     └────────┬─────────┘                  │
│                                    ↓                             │
│                         ┌──────────────────┐                     │
│                         │  Tool Executor   │                     │
│                         │  (ls/read/write) │                     │
│                         └────────┬─────────┘                     │
│                                  ↓                               │
│                         ┌──────────────────┐                     │
│                         │  Observation     │                     │
│                         │  (inject result) │                    │
│                         └────────┬─────────┘                     │
│                                  ↓                               │
│                         ┌──────────────────┐                     │
│                         │  LLM Continue    │                     │
│                         │  (next turn)     │                     │
│                         └────────┬─────────┘                     │
│                                  ↓                               │
│                        CHECK MAX TURNS                           │
│                                  ↓                               │
│                        OUTPUT TO USER                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Rust Implementation (`src-tauri/src/modules/agent_engine.rs`)

```rust
pub struct AgentEngine {
    ollama: OllamaService,
    tool_executor: ToolExecutor,
    context_manager: ContextManager,
    config: AgentConfig,
    turn_count: usize,
}

impl AgentEngine {
    pub async fn run_autonomous_loop(&mut self, user_prompt: &str) -> AgentResult {
        let mut messages = vec![Message::user(user_prompt)];
        
        while self.turn_count < self.config.max_turns {
            // 1. Send to Ollama with current context
            let response = self.ollama.generate_streaming(
                &self.config.model,
                &self.build_prompt(&messages),
                |chunk| { /* stream to UI */ }
            ).await?;

            // 2. Parse response for tool calls
            let tool_calls = self.parse_tool_calls(&response);
            
            if tool_calls.is_empty() {
                // No tool needed → output final response
                return AgentResult::Complete(response);
            }

            // 3. Execute tools autonomously
            for call in tool_calls {
                let observation = self.tool_executor.execute(&call).await?;
                messages.push(Message::assistant(response.clone()));
                messages.push(Message::tool_observation(call, observation));
            }

            self.turn_count += 1;
        }

        AgentResult::MaxTurnsReached
    }

    fn parse_tool_calls(&self, response: &str) -> Vec<ToolCall> {
        // Parse JSON blocks like: <tool_call>{"name": "read_file", "path": "src/main.rs"}</tool_call>
        // Or regex: Action: read_file("src/main.rs")
    }
}
```

---

### 2. Tooling Porting — First 5 Tools

| Tool | Claw Source | Rust Implementation | Security |
|------|-------------|---------------------|----------|
| `ls` | `tools.py` | `list_directory(path)` | 🔓 No confirmation |
| `read` | `tools.py` | `read_file(path, offset?, limit?)` | 🔓 No confirmation |
| `write` | `tools.py` | `write_file(path, content)` | 🔒 **CONFIRM required** |
| `grep` | `tools.py` | `search_in_files(pattern, path?)` | 🔓 No confirmation |
| `terminal_cmd` | `tools.py` | `execute_shell(cmd)` | 🔒 **CONFIRM required** |

#### Security Mechanism: Permission Gate

```rust
#[derive(Clone, Copy, PartialEq)]
pub enum ToolPermission {
    Auto,      // ls, read, grep — no confirmation
    Confirm,   // write, terminal_cmd — require user approval
}

pub struct ToolExecutor {
    permission_map: HashMap<String, ToolPermission>,
    pending_confirmations: Vec<PendingTool>,
}

impl ToolExecutor {
    pub async fn execute(&self, call: &ToolCall) -> Result<String, ToolError> {
        let permission = self.permission_map.get(&call.name)
            .unwrap_or(&ToolPermission::Confirm);

        if *permission == ToolPermission::Confirm {
            // Send event to frontend for user confirmation
            self.request_confirmation(call).await
        } else {
            self.execute_immediate(call).await
        }
    }
}
```

**Frontend Integration** (React):
```tsx
// ToolConfirmationModal.tsx
const [pendingTool, setPendingTool] = useState<ToolCall | null>(null);

useEffect(() => {
    window.addEventListener('tool-confirmation', (e) => {
        setPendingTool(e.detail);
    });
}, []);

if (pendingTool) {
    return <ConfirmDialog tool={pendingTool} onApprove={...} onDeny={...} />;
}
```

---

### 3. Context Management — Project Snapshot

#### Claw Pattern (`context.py`)
```python
@dataclass(frozen=True)
class PortContext:
    source_root: Path
    tests_root: Path
    assets_root: Path
    python_file_count: int
    test_file_count: int
    # ...
```

#### AuraOS Project Snapshot (SQLite)

```sql
CREATE TABLE IF NOT EXISTS project_snapshot (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    root_path TEXT NOT NULL,
    file_count INTEGER DEFAULT 0,
    dir_structure TEXT,  -- JSON: {"src": {"files": [...], "dirs": [...]}}
    key_files TEXT,      -- JSON: ["src/main.rs", "Cargo.toml", ...]
    last_scan DATETIME DEFAULT CURRENT_TIMESTAMP,
    cache_version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS file_index (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES project_snapshot(id),
    path TEXT NOT NULL,
    file_type TEXT,      -- "rs", "ts", "tsx", "md"
    size_bytes INTEGER,
    modified_at DATETIME,
    summary TEXT,        -- AI-generated summary (first 200 chars)
    is_key_file BOOLEAN DEFAULT 0
);
```

#### Context Injection Prompt

```
## Project Context
- Root: /path/to/project
- Structure: {dir_structure_json}
- Key Files: {key_files_list}
- File Count: {file_count}

## Recent Changes
{last_5_modified_files}

## Current File (if relevant)
{file_content_preview}
```

**Why This Eliminates Re-reading RAM:**
- `dir_structure` caches directory tree as JSON (not file contents)
- `file_index` stores metadata only — not 64GB of file data
- `summary` field = AI-generated one-liner per file
- Full content loaded ONLY when tool explicitly called (`read_file`)

---

### 4. UI Shell Stability — Keybindings Fix

#### Claw's Approach (from `keybindings/` snapshot)
- Event delegation at document level
- `useEffect` cleanup on unmount
- Prevents duplicate handlers

#### Current AuraOS Issue
- `Ctrl + ``: Multiple handlers firing
- Resize: React state updates during drag → jitter

#### Proposed Fix

```tsx
// useKeyHandler.ts — singleton key handler
import { useEffect, useRef } from 'react';

export function useKeyHandler(key: string, callback: () => void) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // Ctrl+` — prevent default, trigger once
            if (e.key === '`' && e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                callbackRef.current();
            }
        };

        document.addEventListener('keydown', handler, { once: true });
        return () => document.removeEventListener('keydown', handler);
    }, [key]);
}
```

**For Resize:**
```tsx
// Layout.tsx — direct DOM, no React state during drag
const handleDrag = (e: MouseEvent) => {
    const newWidth = e.clientX - SIDEBAR_OFFSET;
    // Direct DOM update — ZERO React re-renders
    sidebarRef.current!.style.width = `${newWidth}px`;
};

const handleDragEnd = () => {
    // Only NOW update React state
    setSidebarWidth(parseInt(sidebarRef.current!.style.width));
};
```

---

## 🔄 Migration Plan

### Phase 1 (Immediate)
- [ ] Create `src-tauri/src/modules/agent_engine.rs`
- [ ] Implement `ToolExecutor` with permission system
- [ ] Add `ls`, `read`, `grep` tools (Auto permission)
- [ ] Add SQLite tables for project_snapshot

### Phase 2
- [ ] Implement `write`, `terminal_cmd` with confirmation UI
- [ ] Integrate with Ollama streaming
- [ ] Add "autonomous mode" toggle in UI

### Phase 3
- [ ] Context caching (project_snapshot)
- [ ] Token budget management
- [ ] Max turns enforcement

---

## ✅ Acceptance Criteria

| Criteria | Verification |
|----------|---------------|
| Agent reads files without `/read` command | Test: "Show me src/main.rs" → auto read |
| Tool confirmation works for write/terminal | Modal appears, execution blocked until confirm |
| Project Snapshot caches structure | `SELECT * FROM project_snapshot` returns valid JSON |
| Ctrl+` works without duplicates | Press 5 times → 5 triggers, not 15 |
| Resize smooth (no jitter) | Drag sidebar → 60fps, no React renders |

---

## 🎸 Notes

- **Analytic Noir Style**: Agent should respond with structured analysis, not just raw output
- **Greco Les Paul 1975**: Clean, resonant, no noise — same principle for agent responses
- **Token Budget**: Inherit from Claw's `QueryEngineConfig.max_budget_tokens`

---

*Proposed: 2026-04-06*
*Status: Open for Review*
