# 📐 TECHNICAL SPECIFICATION: AuraOS

## 1. Архитектурный стек
- **Runtime**: Tauri v2 (Rust Core)
- **Frontend Framework**: React + Vite (TSX)
- **State Management**: Zustand (для UI) + Rust Channels (для связи с ядром)
- **Local AI Bridge**: Ollama API & LM Studio SDK (Localhost)
- **Database**: SQLite (через Tauri-plugin-sql) для локального кэша и метаданных
- **UI Engine**: Tailwind CSS + 21st.dev Components
- **Language**: Rust (Backend), TypeScript (Frontend: Strict Mode)

## 2. Модель данных (Local Schema)
*Все локальные таблицы в SQLite. Использование `snake_case` для полей*.

- **ai_models_config**:
  - `id`: integer (primary key)
  - `task_type`: text (напр. 'logic', 'code', 'docs')
  - `model_name`: text (напр. 'deepseek-coder', 'llama3')
  - `provider`: text ('ollama' | 'lm_studio')
  - `parameters`: jsonb (temperature, top_p, context_window)

- **skill_core_index**:
  - `id`: uuid (primary key)
  - `name`: text (not null) — название скилла (инструмента)
  - `path`: text (путь к скиллу, напр. ~/.opencode/skills/ui-ux-pro-max)
  - `methods`: jsonb (доступные методы/команды скилла)
  - `is_active`: boolean (загружен ли в контекст)
  - `tags`: text[] (automation, testing, ui, etc.)

- **project_index** (отдельная сущность):
  - `id`: uuid (primary key)
  - `name`: text — название проекта (Guitar OS, INTCT, etc.)
  - `path`: text (путь к рабочей директории)
  - `last_opened`: timestamp

## 3. Orchestration API (Rust <-> TS)
*Взаимодействие через Tauri Commands (`invoke`)*.

- `invoke("run_inference", { task, prompt })`: Выбор модели на основе `task_type` и выполнение запроса.
- `invoke("sync_skill_folder", { path })`: Сканирование папки скиллов и обновление индекса.
- `invoke("get_system_stats")`: Мониторинг нагрузки на 9950x3d и RTX 5080.

## 4. User Stories & Бизнес-логика
- **Story 1 (Model Router)**: Как разработчик, я хочу, чтобы сложные архитектурные вопросы уходили в мощную модель (30b+), а мелкие правки кода — в быструю (7b), экономя ресурсы и время.
- **Story 2 (Global Skills)**: Как аналитик, я хочу один раз описать логику "бизнес-процессов СТЦ" в папке скиллов, чтобы любая модель в любом новом проекте знала этот контекст.
- **Clarification**:
  - **Skills** — это инструменты/плагины (Playwright, Obsidian, UI-UX Pro Max, MCP Magic). Расположение: `~/.opencode/skills/` или `~/.claude/plugins/`.
  - **Projects** — это рабочие директории (Guitar OS, INTCT, Rust Core). Расположение: пользовательские папки.
- **Logic Flow (Inference)**: 
  1. Запрос пользователя попадает в **Dispatcher**.
  2. Dispatcher проверяет тип задачи и наличие релевантных "скиллов" в локальном RAG.
  3. Формируется промпт: `System Prompt` + `Skill Context` + `User Query`.
  4. Запрос уходит в выбранный инстанс (Ollama/LM Studio).

## 5. UI/UX Экраны (Wireframes)
*Стиль: "Fluid Zen", акцент на прозрачности (glassmorphism), основной фон #000000 / #050505*.

- **Layout**: 
  - Sidebar (Left): Skill Core панель — список установленных инструментов (Playwright, Obsidian, UI-UX Pro Max, MCP Magic). При клике на скилл показываются его методы.
  - Main: Workspace — рабочая область для проектов.
- **System Monitor**: Real-time виджет в sidebar показывающий:
  - GPU VRAM (RTX 5080)
  - System RAM (64GB DDR5)
  - CPU Usage & Temp (9950x3d)
  - Active Models list
- **Typography**: Geist Mono для кода, Inter для интерфейса.

## 6. Безопасность & Локальность
- **Zero-Cloud Policy**: Весь код и данные остаются на G:\Project\ и в локальной SQLite. Никакой телеметрии во внешние облака.
- **Validation**: Zod на фронтенде для проверки конфигов моделей.
- **Secret Management**: API ключи для опциональных внешних сервисов хранятся в зашифрованном виде через системный Keychain (через Rust-библиотеки).

## 7. Edge Cases (Обработка ошибок)
- **Model Offline**: Если Ollama не запущена, интерфейс показывает "Pulse Red" статус и кнопку "Quick Start Ollama".
- **Context Overflow**: Если контекст скиллов слишком велик, автоматическая суммаризация через Small Model (1b-3b).
- **Resource Lock**: При перегрузке GPU — автоматическая очередь задач или переключение на CPU (9950x3d).