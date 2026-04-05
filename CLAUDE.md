# 🕹️ CLAUDE.md | AuraOS Control Center (Project Manager Edition)

## 🎯 Core Directives
- **Spec-First**: Никакого кода без актуальной спецификации в `SPECIFICATION.md`.
- **GSD Logic**: Работай строго через субагентов: **Planner** (планирование) -> **Executor** (код) -> **Verifier** (тесты).
- **Atomic Actions**: Одна задача из `ROADMAP.md` = одна итерация изменений.
- **UI/UX Fidelity**: Интерфейс строго по `.rules/ui-ux.md`. Стандарты **21st.dev** и **UI-UX Pro Max** — абсолютный приоритет.
- **Local-First AI**: Приоритет на интеграцию с **Ollama** и **LM Studio** (использование мощностей RTX 5080).

## 📚 Source of Truth (Hierarchy)
1. **Vision**: `PROJECT_IDEA.md` (AuraOS: Модульная IDE с локальным мозгом и Skill Core).
2. **Blueprints**: `SPECIFICATION.md` (Архитектура Tauri/Rust, логика Model Router).
3. **Design Code**: `.rules/ui-ux.md` (Регламент на базе `uipro` и эстетики Fluid UI).
4. **Task Force**: `.claude/agents/` (Роли: Planner, Executor, Verifier).
5. **Memory**: `vault/index.md` (Архитектурные ADR и логика фрактальной синестезии).

## 🛠 Project Lifecycle
- **Planning**: `/plan` -> обновление `.planning/ROADMAP.md` и `STATE.md` через Planner.
- **Development**: `/execute` -> реализация логики на **Rust (Tauri)** и **React (Vite)**.
- **UI Engineering**: `/ui` -> внедрение компонентов через **21st.dev Magic**.
- **Orchestration**: `/think` -> проектирование маршрутизации задач между моделями (Small/Medium/Large).
- **Validation**: `/review` -> проверка субагентом Verifier (Playwright) на соответствие SPEC.
- **Persistence**: `/save` -> сохранение лога сессии в `vault/sessions/` и синхронизация через `obsidian-skills`.

## ⚙️ Environment & Setup
- **Agent Context**: Local LLM. Тон: лаконичный, технически точный, резонирующий как Greco Les Paul 1975.
- **Tech Stack**: 
    - **Frontend**: React + Vite + Tailwind (библиотеки 21st.dev).
    - **Backend**: Rust (Tauri) — для максимальной скорости и безопасности.
    - **AI Bridge**: Прямые вызовы Ollama API / LM Studio SDK.
- **Rules Persistence**: Папка `.rules/` обязательна к исполнению для всех операций.

## ⌨️ Quick Commands
- **Dev**: `npm run tauri dev`
- **Build**: `npm run tauri build`
- **UI Pro CLI**: `uipro update` / `uipro versions`
- **Search UI**: `mcp-magic-search <query>`
  
## 🚀 Initial Machine Setup
- **On-boarding**: При отсутствии `.env` спроси у пользователя `MAGIC_API_KEY` и автоматически создай файл `.env`.
- **Secret Management**: Никогда не пиши реальные ключи в файлы, кроме `.env`. Добавь `.env` в `.gitignore`.
- **UI/UX Pro Max Skill**: 
  1. `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`.
  2. `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`.
  3. `npm install -g uipro-cli` — глобальная установка CLI.
  4. `uipro init --ai opencode` — инициализация навыка для среды OpenCode.
- **MCP Magic**: Выполни команду настройки: 
  `claude mcp add magic --scope user --env API_KEY=$MAGIC_API_KEY -- npx -y @21st-dev/magic@latest`.
- **Obsidian Skills (Kepano)**: 
  1. Выполни установку скиллов для OpenCode: 
     `git clone https://github.com/kepano/obsidian-skills.git ~/.opencode/skills/obsidian-skills`.
  2. Скопируй стандарты управления знаниями в `.rules/obsidian.md`.
- **Playwright Skill (Recommended Setup)**: 
    1. `/plugin marketplace add lackeyjb/playwright-skill`.
    2. `/plugin install playwright-skill@playwright-skill`.
    3. `cd ~/.claude/plugins/marketplaces/playwright-skill/skills/playwright-skill && npm run setup`.