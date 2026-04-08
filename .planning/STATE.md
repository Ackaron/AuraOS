# 🚀 Current Project State

## 📍 Активная задача
- **Задача**: Phase 3 — Infinite Memory (Context Management)
- **Субагент**: Executor
- **Связанный файл**: `[[ROADMAP.md#phase-3-infinite-memory-context-management]]`

---

## 🎯 Текущий фокус
- Зафиксировать финальную архитектуру когнитивного ядра AuraOS.
- Определить, как именно работает маршрутизация моделей, ролей, инструментов и контекста.
- Подготовить основу для перехода от “описания идеи” к “реальному исполняемому ядру”.
- Сохранить compatibility с уже принятыми решениями:
  - local-first;
  - Tauri v2 + Rust core;
  - React 19 + Vite;
  - SQLite;
  - `.claude/agents/`;
  - `.claude/commands/`;
  - `Shared Skill Core`;
  - `layered context`;
  - `GitHub-first installer`.

---

## ✅ Что уже зафиксировано

### 1. Концепция продукта
AuraOS определён как локальная когнитивная оболочка для кодинга, аналитики и автоматизации, где знания, роли и инструменты не теряются между проектами, а живут как переиспользуемый системный слой.

### 2. Базовая архитектура
Зафиксирован стек:
- **Runtime**: Tauri v2.
- **Core**: Rust.
- **UI**: React 19 + Vite.
- **Database**: SQLite.
- **Local AI**: Ollama / LM Studio.
- **Design system**: Fluid Zen.
- **Tooling**: Rust-first hands, typed orchestration, structured tool calling.

### 3. Документы проекта
Подготовлены или определены как обязательные:
- `CLAUDE.md`
- `SPECIFICATION.md`
- `ROADMAP.md`
- `.rules/`
- `README.md` в будущем как публичная точка входа
- `architecture/` или эквивалентный набор технических документов при расширении проекта

### 4. Ключевая модель контекста
Принят принцип **layered prompt construction**:
1. Базовая логика AuraOS.
2. Инструкция выбранного субагента.
3. Активные скиллы из Shared Skill Core.
4. Проектные правила.
5. Опционально: MCP-инструменты и локальные сервисы.

### 5. Ключевая модель ролей
Субагенты не зашиваются в код, а определяются файлами в `.claude/agents/`.  
Это значит:
- роли можно добавлять и удалять как обычные `.md` файлы;
- модель для каждой роли можно назначать отдельно;
- проект остаётся расширяемым без переписывания ядра.

### 6. Ключевая модель знаний
Shared Skill Core — это глобальный слой знаний, который:
- ставится из GitHub;
- индексируется автоматически;
- активируется тумблером;
- доступен во всех проектах;
- используется без ручного копирования контекста.

### 7. Ключевая модель расширения
MCP-серверы и локальные инструменты рассматриваются как часть расширяемой capability-системы, а не как отдельный внешний мир.

---

## 🚧 В работе прямо сейчас

### Phase 2: Cognitive Intelligence
В текущий момент проект концентрируется на том, чтобы сделать **мозг системы**:

- `OpenAI Compatibility Shim`;
- `Query Engine`;
- `Structured Tool Calling`;
- `Dynamic Model Router`;
- `DFA routing`;
- `layered system prompt construction`;
- обработку ошибок и retry logic;
- поддержку streamed responses;
- поддержку role-specific execution.

### Что именно разбирается
- Как нормализовать ответы разных LLM-провайдеров в единый формат.
- Как строить единый цикл рассуждения и исполнения.
- Как безопасно и предсказуемо подключать инструменты.
- Как выбирать модель под роль и задачу.
- Как передавать контекст между агентами без хаоса.
- Как сделать так, чтобы система была наблюдаемой и отлаживаемой.

---

## 🧠 Модель мышления системы

### 1. Task Intake
Пользователь вводит задачу через UI или команду.

### 2. Intent Detection
Система определяет:
- тип задачи;
- предполагаемую роль;
- нужный уровень контекста;
- необходимость инструментов;
- необходимость MCP;
- необходимость compacting.

### 3. Routing
Router решает:
- какую модель использовать;
- какой субагент активировать;
- какие скиллы подключить;
- какие проектные правила применить.

### 4. Execution
Субагент выполняет работу в layered context.

### 5. Observation
Результат, tool output и промежуточные состояния поступают обратно в query loop.

### 6. Compact / Persist
Если контекст растёт, система:
- сжимает историю;
- сохраняет summary;
- фиксирует session state;
- готовит resume capability.

---

## 📚 Что уже считается обязательным

### Для когнитивного ядра
- Никаких жёстко зашитых ролей в коде.
- Никаких скрытых решений без наблюдаемого следа.
- Никакого монолитного контекста без разделения по слоям.
- Никакого “ручного копирования знаний” между проектами.
- Никакой зависимости от одного провайдера модели.

### Для навыков
- Каждый skill должен иметь manifest.
- Каждый skill должен быть индексируемым.
- Каждый skill должен быть активируемым/деактивируемым.
- Каждый skill должен быть совместим с глобальным Skill Core.
- Каждый skill должен быть безопасным при установке и обновлении.

### Для субагентов
- Каждый agent — отдельный файл.
- Каждая роль — отдельная ответственность.
- Каждая роль может иметь свой модельный профиль.
- Каждая роль может использовать общий Skill Core.
- Каждая роль должна быть совместима с проектными правилами.

---

## 🧩 Важные проектные нюансы

### Local-first
Всё должно работать локально по умолчанию.  
Облачные зависимости допускаются только как опциональные расширения, но не как базовая логика AuraOS.

### Privacy by design
- Код, контекст и сессии не должны уходить в облако без явного решения пользователя.
- Секреты должны храниться безопасно.
- Логи не должны содержать чувствительные данные.

### File-driven architecture
Любая новая сущность в системе должна иметь файловое представление:
- агент;
- skill;
- command;
- project rule;
- manifest;
- config preset.

### Layered intelligence
Итоговое поведение системы строится не одним “супер-промптом”, а набором слоёв с понятным приоритетом.

### Observability
Система должна показывать:
- что сейчас делает агент;
- какую роль он выполняет;
- какую модель использует;
- какие инструменты подключены;
- когда контекст был compacted;
- что пошло не так, если возникла ошибка.

### Graceful degradation
Если что-то ломается:
- модель недоступна;
- MCP не стартует;
- skill package повреждён;
- история сессии неполная;
- UI не успел обновиться,

то AuraOS должен не падать целиком, а переходить в безопасный и понятный fallback-режим.

---

## 🧱 Архитектурные приоритеты

### Приоритет 1: Надёжное ядро
Сначала должен появиться стабильный core:
- маршрутизация;
- model shim;
- structured tools;
- file-driven agents;
- session persistence.

### Приоритет 2: Контекст и память
Затем:
- compacting;
- history recovery;
- session resume;
- summary boundaries;
- hash-based persistence.

### Приоритет 3: Skill Core
Затем:
- installer;
- manifests;
- global index;
- activation model;
- compatibility layer.

### Приоритет 4: UI и UX
Затем:
- shell layout;
- router sidebar;
- skill sidebar;
- terminal;
- monitoring widgets;
- premium motion.

### Приоритет 5: Полировка
Потом:
- security audit;
- performance tuning;
- tests;
- parity validation;
- release hardening.

---

## 🔍 Сейчас важно не упустить

### Технические риски
- Не распылиться на слишком ранний UI-перфекционизм.
- Не сделать слишком абстрактный model router без работающих сценариев.
- Не смешать project rules, skill context и agent instructions в один неразделимый блок.
- Не потерять compatibility с уже существующими файлами и подходами.
- Не сделать installer, который ломает локальную структуру при установке.

### Продуктовые риски
- Слишком много философии и слишком мало исполняемых механизмов.
- Слишком широкий MVP.
- Недостаточно понятный путь “от задачи до результата”.
- Отсутствие прозрачности того, почему система выбрала именно эту роль или модель.

### UX-риск
Если интерфейс красивый, но непонятный — проект проигрывает.  
Если интерфейс простой, но система предсказуемо думает и помнит — проект выигрывает.

---

## 🚀 Phase 2: Cognitive Intelligence — ЗАВЕРШЕНА ✅

### Достигнуто
- Динамическое сканирование `.claude/agents/*.md` (AgentRegistry)
- Динамическое сканирование `.claude/commands/*.md` (CommandRegistry)
- MCP Client layer (register, start, stop, status)
- Context Snip & Compact (SessionState, ContextManager)
- xterm.js интегрирован в Terminal UI
- SQLite: sessions, agents, commands tables
- GitHub Plugin/Skill Installer работает
- `.env.example` создан

### Build artifacts
- `src-tauri/target/release/app.exe`
- `src-tauri/target/release/bundle/msi/AuraOS_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/AuraOS_0.1.0_x64-setup.exe`

---

## 🔴 Блокировки и вопросы

Все основные пункты Phase 2 исправлены.

---

## 🚀 Phase 3: Infinite Memory — ЗАВЕРШЕНА ✅

### Достигнуто
- Context Snip & Compact в Rust (`context_manager.rs`)
- SessionState с messages, compact_history, total_tokens
- CompactBoundary с summary, actions_taken, files_accessed, decisions
- SQLite таблица `sessions` с полями transcript и compact_state
- Frontend API для сохранения/загрузки сессий
- Zustand store: SessionState, sessions[], activeSessionId
- Session actions: addSession, updateSession, removeSession, compactSession
- Новые Tauri команды: get_full_session_state, load_session_state, delete_session_state

---

## 🚀 Phase 4: Shared Skill Core (SSC) — ЗАВЕРШЕНА ✅

### Достигнуто
- Skill Cloner: clone_skill_from_github, update_skill с поддержкой branch
- Skill Manifest Parsing: parse_skill_manifest (skill.json, SKILL.md)
- Dynamic Skill Loading: scan_local_skills
- Global Indexing: search_by_tag
- SkillEngine с content_cache для индексации файлов скиллов
- SkillPanel UI с установкой из GitHub

### Реализованные Tauri команды
- clone_skill_from_github(url, branch) -> SkillMetadata
- update_skill(id) -> SkillMetadata  
- scan_local_skills() -> Vec<SkillMetadata>
- get_skill_content(skill_id) -> Vec<SkillContent>
- search_skills_by_tag(tag) -> Vec<SkillMetadata>

---

## 🚀 Phase 5: High-End UI/UX (The Reference Shell) — ГОТОВА К ЗАПУСКУ

---

## 🧭 Текущие решения

### Уже принято
- AuraOS строится как local-first shell.
- Субагенты определяются файлами.
- Skills устанавливаются из GitHub.
- Контекст собирается слоями.
- SQLite используется для persistence.
- Rust является ядром orchestration и tooling.
- React — только presentation layer.

### Пока открыто
- Точный формат manifest-файлов.
- Полная схема событий.
- Приоритеты fallback-моделей.
- Режим восстановления сессии.
- Состав MVP skill set.
- Состав стартового agent pack.
- Порядок реализации cognitive core.

---

## 📈 Текущее состояние зрелости проекта

### Сильные стороны
- Концепция уже оформлена.
- Архитектура уже выстроена.
- Основные слои уже определены.
- Roadmap уже детализирован.
- Спецификация уже почти является blueprint-уровнем.

### Что ещё не завершено
- Нужно динамическое сканирование `.claude/agents/*.md` в Rust
- Нужен GitHub-first Skill Installer
- Нужен xterm.js для интегрированного терминала
- Нужен MCP client layer
- Нужен Context Snip & Compact

### Где сейчас проект
Проект находится на стадии, где **дизайн системы уже понятен**, но ещё требуется перевести его в строгие рабочие контракты и минимально жизнеспособную реализацию.

---

## 🧪 Критерии ближайшего успеха

Следующий шаг считается успешным, если будет выполнено хотя бы одно из следующих:

1. Зафиксирован рабочий формат `agent manifest`.
2. Зафиксирован рабочий формат `skill manifest`.
3. Описан и принят event protocol.
4. Сформирован минимальный agent loop.
5. Определён MVP-safe bootstrap mode.
6. Создан первый end-to-end сценарий:
   - задача → роутинг → агент → инструмент → результат → сохранение сессии.

---

## 🗂 Что должно оставаться синхронизированным

Этот статус должен соответствовать:
- `ROADMAP.md`
- `SPECIFICATION.md`
- `CLAUDE.md`
- `.rules/`
- структуре `.claude/agents/`
- структуре `.claude/commands/`
- будущей реализации `src-tauri/`

Если что-то меняется в одном месте, это должно быть отражено в остальных документах.

---

## 🕒 Последнее обновление
**2026-04-08 14:13**
