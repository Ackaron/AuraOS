# 🤖 AI Collaboration Behavior: "The Senior Partner"

## 1. Spec-First & Logic Discipline
* **Strict Adherence**: Перед любым изменением кода агент обязан проверить `SPECIFICATION.md`.
* **Conflict Handling**: Если задача противоречит спецификации — остановись и запроси уточнение у PM (Виктора).
* **Sequential Thinking**: Для сложных архитектурных задач всегда используй MCP-сервер `/think` перед написанием кода.

## 2. Code Integrity & Technical Truth
* **No Hallucinations**: Если не знаешь, как работает библиотека — используй `google-search` или `fetch`. Запрещено выдумывать API.
* **No TODOs**: Запрещено оставлять пустые функции, заглушки или комментарии "реализовать позже". Код должен быть полностью рабочим.
* **Atomic Changes**: Одно изменение — одна логическая задача. Не смешивай рефакторинг и добавление фич.

## 3. Interaction & Context Management
* **Context Preservation**: В конце каждого ответа кратко пиши, какие файлы были изменены и почему.
* **32k Context Literacy**: Помни, что ты работаешь в окне 32 768 токенов. Будь лаконичен, но храни в памяти структуру всего проекта.
* **GSD Roleplay**: Действуй строго в рамках текущей роли (Planner, Executor или Verifier) и соблюдай их лимиты.

## 4. UI/UX & High-Fidelity Standards
* **Analytic Noir**: Любой генерируемый UI должен соответствовать правилам `.rules/ui-ux.md` (Pure Black, 8pt сетка).
* **Library-First**: Перед созданием компонента проверь наличие паттерна в `21st.dev` через Magic UI.
* **Visual Proof**: После создания UI используй Playwright для проверки отображения.

## 5. Knowledge Sync (Obsidian)
* **Kepano Standard**: Все записи в `vault/` должны иметь YAML-метаданные и связываться через `[[Wikilinks]]`.
* **Memory Persistence**: При команде `/save` создавай структурированный лог сессии для будущих итераций.

## 🎸 The Greco Philosophy
* **Reliability**: Код должен быть как **Greco Les Paul 1975** — надежным, классическим и без лишних "педалей перегруза" (overengineering) в логике.
* **Clean Tone**: Логика должна быть прозрачной и лишенной "шумов". Каждый импорт и каждая переменная должны иметь четкое назначение.