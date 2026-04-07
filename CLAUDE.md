# 🕹️ CLAUDE.md | AuraOS Control Center

## 🎯 Core Directives
- **Spec-First**: Никакого кода без актуальной спецификации в `SPECIFICATION.md`.
- **GSD Logic**: Работай строго через субагентов: **Planner** (планирование) -> **Executor** (код) -> **Verifier** (тесты).
- **Atomic Actions**: Одна задача из `ROADMAP.md` = одна итерация изменений.
- **UI/UX Fidelity**: Интерфейс строго по `.rules/ui-ux.md`. Стандарты **21st.dev** и **UI-UX Pro Max** — абсолютный приоритет.
- **Local-First AI**: Приоритет на интеграцию с **Ollama** (RTX 5080). Никаких облачных сервисов.

## 📚 Source of Truth (Hierarchy)
1. **Vision**: `PROJECT_IDEA.md` (AuraOS: Модульная IDE с локальным мозгом и Skill Core).
2. **Blueprints**: `SPECIFICATION.md` (Архитектура Tauri/Rust, логика Model Router).
3. **Design Code**: `.rules/ui-ux.md` (Регламент на базе `uipro` и эстетики Fluid UI).
4. **Agent Rules**: `.rules/ai-behavior.md` (Greco Les Paul Philosophy — надёжность без оверинжиниринга).
5. **Memory**: `vault/index.md` (Архитектурные ADR и историческом контекст).

## 🤖 Reactive Agent System (АКТУАЛЬНЫЙ СТАТУС)

AuraOS имеет встроенный реактивный агент на Rust (`src-tauri/src/modules/agent_engine.rs`).

### Доступные инструменты агента:
| Инструмент | Синтаксис | Описание |
|---|---|---|
| `ls` | `{"tool": "ls", "path": "src"}` | Список файлов в папке |
| `read` | `{"tool": "read", "path": "README.md"}` | Читать файл |
| `grep` | `{"tool": "grep", "pattern": "TODO", "path": "src"}` | Поиск по файлам |
| `write_file` | `{"tool": "write_file", "path": "notes.md", "content": "..."}` | Создать/обновить файл |
| `mkdir` | `{"tool": "mkdir", "path": "data/raw"}` | Создать папку |
| `rm` | `{"tool": "rm", "path": "temp.txt"}` | Удалить файл/папку |
| `finish` | `{"tool": "finish", "content": "Отчёт..."}` | **ЗАВЕРШИТЬ задачу** |

### Правила путей:
- ВСЕГДА используй **относительные пути** (`data/file.json`, `src/main.rs`)
- Система автоматически добавляет корень проекта
- Никогда не используй абсолютные пути (`G:\Project\...`)

### Как работает цикл агента:
1. Получает запрос пользователя
2. Генерирует JSON с инструментом в блоке ` ```json ... ``` `
3. AuraOS выполняет инструмент
4. Агент видит Observation (результат)
5. Повторяет до завершения или 7 шагов
6. **Обязательно завершает вызовом `finish`**

## 🛠 Project Lifecycle
- **Planning**: `/plan` -> обновление `.planning/ROADMAP.md` и `STATE.md` через Planner.
- **Development**: `/execute` -> реализация логики на **Rust (Tauri)** и **React (Vite)**.
- **UI Engineering**: `/ui` -> внедрение компонентов через **21st.dev Magic**.
- **Orchestration**: `/think` -> проектирование маршрутизации задач между моделями (Small/Medium/Large).
- **Validation**: `/review` -> проверка субагентом Verifier на соответствие SPEC.
- **Persistence**: `/save` -> сохранение лога сессии в `vault/sessions/`.

## ⚙️ Environment & Setup
- **Agent Context**: Local LLM via Ollama (`http://localhost:11434`). Тон: лаконичный, технически точный.
- **Tech Stack**:
    - **Frontend**: React + Vite + Tailwind CSS.
    - **Backend**: Rust (Tauri v2) — скорость и безопасность.
    - **AI Bridge**: Ollama API (`/api/chat`, stream=true).
    - **DB**: SQLite (`auraos.db` в AppData) — хранит проекты, модели, скиллы.
- **Rules Persistence**: Папка `.rules/` обязательна к исполнению для всех операций.

## ⌨️ Quick Commands
- **Dev**: `npm run tauri dev`
- **Build**: `npm run tauri build`
- **Check Rust**: `cargo check` (из `src-tauri/`)

## 🚀 Initial Machine Setup
- **On-boarding**: При отсутствии `.env` спроси у пользователя `MAGIC_API_KEY` и автоматически создай файл `.env`.
- **Secret Management**: Никогда не пиши реальные ключи в файлы, кроме `.env`. Добавь `.env` в `.gitignore`.

## 🎸 The Greco Philosophy
Код должен быть как **Greco Les Paul 1975** — надёжным, классическим, без лишних «педалей перегруза» (overengineering).