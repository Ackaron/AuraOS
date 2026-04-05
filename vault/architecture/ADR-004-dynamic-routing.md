# ADR-004: Dynamic Routing Architecture

## Status
Accepted

## Date
2026-04-05

## Context
Проектирование системы динамического роутинга задач между AI-моделями. Необходимо обеспечить гибкость назначения моделей на роли без hardcoding.

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User Input                              │
│         "why should I use Rust?" → Terminal                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              detectTaskType()                               │
│  - /logic, /code, /docs prefixes                           │
│  - Keyword detection (why/analyze → logic)                 │
│  - Default → fast                                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              modelRouter Store                              │
│  {                                                           │
│    logic: 'deepseek-r1:8b',                                │
│    code: 'qwen2.5:14b',                                     │
│    docs: 'phi4:latest',                                     │
│    fast: 'llama3.1:8b'                                      │
│  }                                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              invoke('run_inference')                        │
│  - model: selected from modelRouter                         │
│  - prompt: user input                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Ollama API (localhost:11434)                   │
└─────────────────────────────────────────────────────────────┘
```

### UI Components

**ModelRouterPanel:**
- 4 expandable sections: Logic, Code, Docs, Fast
- Dropdown with real models from Ollama
- Visual: "Logic → deepseek-r1:8b"
- Active role highlighted with accent ring

**Terminal:**
- Predictive model badge near input
- Changes on-the-fly based on input detection
- Shows: [model name] badge

### Database Schema

```sql
CREATE TABLE ai_models_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_type TEXT NOT NULL UNIQUE,  -- logic, code, docs, fast
  model_name TEXT NOT NULL,
  provider TEXT DEFAULT 'ollama',
  parameters TEXT DEFAULT '{}',
  created_at DATETIME,
  updated_at DATETIME
);
```

### Persistence Flow

1. **On Change**: User selects model in dropdown → `setModelForTask()` → SQLite INSERT OR REPLACE
2. **On Load**: App starts → `getModelAssignments()` → populate `modelRouter` store

### Ollama Discovery

- `check_ollama_status` returns: `{ available: bool, models: [{ name, size }] }`
- Models stored in `availableModels` store
- Used in dropdown menus

## Consequences

**Positive:**
- Flexible model assignment per role
- Real models from local Ollama
- Persisted between sessions
- Predictive UX in terminal

**Negative:**
- Requires Ollama running for full discovery
- Fallback to defaults if DB unavailable

## References
- [[SPECIFICATION.md]] — AI Bridge section
- [[ADR-001]] — Initial structure
- `src/stores/auraStore.ts` — Model Router state
- `src/lib/database.ts` — SQLite operations
