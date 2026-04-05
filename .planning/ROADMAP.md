# 🗺️ ROADMAP: AuraOS v1.0.0

## 🎯 Текущая цель
**Phase 1: Foundation Core** — В процессе. SQLite настроен, Ollama API готов.

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

### 🔴 Phase 1: Foundation Core — 🟡 В ПРОЦЕССЕ
| # | Задача | DoD | Приоритет | Статус |
|---|--------|-----|-----------|--------|
| 1.1 | Tauri Commands bridge | Rust ↔ TS invoke работает | 🔴 | ✅ |
| 1.2 | SQLite plugin | Schema валидна | 🔴 | ✅ |
| 1.3 | Таблицы `ai_models_config`, `skill_core_index` | Миграция проходит | 🔴 | ✅ |
| 1.4 | Ollama API integration | Пинг к localhost:11434 | 🔴 | ✅ |
| 1.5 | Model Router логика | `/logic` → small, `/code` → large | 🟡 | 🟡 |
| 1.6 | check_ollama_status command | Статус при старте | 🟡 | ✅ |
| 1.7 | run_inference command | Выполнение запроса | 🟡 | ✅ |

### 🔵 Phase 2: UI Shell (Analytic Noir)
| # | Задача | DoD | Приоритет |
|---|--------|-----|-----------|
| 2.1 | Layout: Sidebar + Main Area | Glassmorphism, #000000 | 🔴 |
| 2.2 | Model Monitor Widget | VRAM отображение | 🟡 |
| 2.3 | NLP Terminal (K-интерфейс) | Команды работают | 🟡 |
| 2.4 | Skill Core Browser | Markdown индекс | 🟡 |
| 2.5 | Workspace Editor | Code editor integration | 🟡 |

### 🟣 Phase 3: AI Bridge
| # | Задача | DoD | Приоритет |
|---|--------|-----|-----------|
| 3.1 | Ollama streaming | Real-time response | 🔴 |
| 3.2 | LM Studio support | Multi-provider | 🟡 |
| 3.3 | Skill Context injection | RAG from local files | 🟡 |

### 🔴 Phase 4: QA & Verification
| # | Задача | DoD | Приоритет |
|---|--------|-----|-----------|
| 4.1 | E2E tests (Playwright) | Скриншоты + smoke tests | 🔴 |
| 4.2 | TypeScript audit | Ноль `any` | 🔴 |
| 4.3 | UI/UX verification | 8pt grid + spring animations | 🔴 |

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

*Обновлено: 2026-04-05 23:10*
