# 🗺️ ROADMAP: AuraOS v1.0.0

## 🎯 Текущая цель
**Phase 2: UI Shell** — ✅ ЗАВЕРШЕНО. Agentic Power в процессе.

---

## 🏗️ Milestones

### 🔴 Phase 0: Bootstrap (Sprint 0) — ✅ ЗАВЕРШЕНО
| # | Задача | DoD | Статус |
|---|--------|-----|--------|
| 0.1 | Tauri + React + TS каркас | Каркас запускается | ✅ |
| 0.2 | Tailwind + Framer Motion + Zustand | npm run build проходит | ✅ |
| 0.3 | ESLint/Prettier strict mode | Нет TS-errors | ✅ |
| 0.4 | Zustand store | Counter demo работает | ✅ |
| 0.5 | ui-ux-pro-max-skill | uipro init выполнен | ✅ |

### 🔴 Phase 1: Foundation Core — ✅ ЗАВЕРШЕНО
| # | Задача | DoD | Приоритет | Статус |
|---|--------|-----|-----------|--------|
| 1.1 | Tauri Commands bridge | Rust ↔ TS invoke работает | 🔴 | ✅ |
| 1.2 | SQLite plugin | Schema валидна | 🔴 | ✅ |
| 1.3 | Таблицы `ai_models_config`, `skill_core_index` | Миграция проходит | 🔴 | ✅ |
| 1.4 | Ollama API integration | Пинг к localhost:11434 | 🔴 | ✅ |
| 1.5 | Model Router логика | `/logic` → small, `/code` → large | 🟡 | ✅ |
| 1.6 | check_ollama_status command | Статус при старте | 🟡 | ✅ |
| 1.7 | run_inference command | Выполнение запроса | 🟡 | ✅ |

### 🔵 Phase 2: UI Shell (Analytic Noir) — ✅ ЗАВЕРШЕНО
| # | Задача | DoD | Приоритет | Статус |
|---|--------|-----|-----------|--------|
| 2.1 | Layout: Sidebar + Main Area | Glassmorphism, #000000 | 🔴 | ✅ |
| 2.2 | Model Monitor Widget | VRAM отображение | 🟡 | ✅ |
| 2.3 | NLP Terminal (K-интерфейс) | Команды работают | 🟡 | ✅ |
| 2.4 | Skill Core Browser | Markdown индекс | 🟡 | ✅ |
| 2.5 | Workspace Editor | Code editor integration | 🟡 | ✅ |
| 2.6 | Sidebar icon centering | 64px collapsed mode | 🟡 | ✅ |
| 2.7 | Terminal auto-focus | Ctrl+` focus | 🟡 | ✅ |

### 🟣 Phase 3: Agentic Power & Memory
| # | Задача | DoD | Приоритет | Статус |
|---|--------|-----|-----------|--------|
| 3.1 | Agent Engine (Rust) | ToolExecutor в Rust | 🔴 | ✅ |
| 3.2 | Tool: ls(path) | Directory listing | 🔴 | ✅ |
| 3.3 | Tool: read(path) | File reading | 🔴 | ✅ |
| 3.4 | Tool: grep(pattern) | Content search | 🔴 | ✅ |
| 3.5 | Autonomous loop | Thought → Action → Observation | 🔴 | ✅ |
| 3.6 | Tool Permissions | Auto/Confirm gate | 🟡 | ✅ |
| 3.7 | Session Memory | Multi-turn context | 🟡 | 🔄 |
| 3.8 | Project Snapshot | SQLite cache (avoid 64GB re-read) | 🟡 | 🔄 |

### 🟣 Phase 4: Ecosystem Sync
| # | Задача | DoD | Приоритет |
|---|--------|-----|-----------|
| 4.1 | MCP Integration | Magic UI plugins | 🟡 |
| 4.2 | GitHub Integration | Push/pull sync | 🟡 |
| 4.3 | 21st.dev Magic | UI component marketplace | 🟡 |
| 4.4 | E2E tests | Playwright smoke tests | 🔴 |
| 4.5 | TypeScript audit | Zero `any` | 🔴 |

---

## 🚩 Definition of Done (универсальное)
- [ ] `npm run build` проходит без errors
- [ ] `cargo check` проходит без errors
- [ ] Нет `any` в TS-коде (strict mode)
- [ ] UI соответствует `.rules/ui-ux.md` (8pt, Pure Black, spring animations)
- [ ] ADR создан в `vault/architecture/`
- [ ] `/review` от Verifier пройден

---

## 📋 Model Router Mapping
| Task Type | Model | Notes |
|-----------|-------|-------|
| logic | deepseek-r1:8b | Complex reasoning |
| code | qwen2.5:14b | Code generation |
| docs | phi4:latest | Documentation |
| fast | llama3.1:8b | Quick responses |

---

## 🤖 Agent Capabilities (v1.0)
| Tool | Status | Permission |
|------|--------|------------|
| ls(path) | ✅ Working | Auto |
| read(path) | ✅ Working | Auto |
| grep(pattern) | ✅ Working | Auto |
| write | 🔒 Ready | Confirm |
| terminal_cmd | 🔒 Ready | Confirm |

---

*Обновлено: 2026-04-06*
