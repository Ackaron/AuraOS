# SPECIFICATION.md
# 📐 TECHNICAL SPECIFICATION: AuraOS 2.0 (Cognitive Shell)

## 1. Executive Summary

**AuraOS 2.0** — это локальная когнитивная оболочка (Cognitive Shell), которая объединяет агентскую логику, приватность локальных LLM и систему переиспользуемых знаний, инструментов и ролей.  
Проект строится как **Reference Implementation** высокопроизводительного AI-ассистента с упором на стабильность инструментов, точность восприятия и долговременное сохранение контекста.

### 1.1 Product Thesis

AuraOS решает ключевую проблему современного AI-workflow: знания, контекст, команды и роли не должны теряться между сессиями и проектами.  
Система должна работать как локальный AI-оркестратор, который:

- понимает тип задачи;
- выбирает подходящую модель;
- подключает нужного субагента;
- подтягивает только релевантные скиллы;
- сохраняет проектный контекст и правила;
- работает локально и приватно.

### 1.2 Core Promise

AuraOS 2.0 обеспечивает:

- **Local-first execution** — весь интеллект и данные остаются на машине пользователя.
- **Shared intelligence** — навыки и правила доступны во всех проектах.
- **Dynamic agents** — роли определяются файлами, а не жёстко прошиты в коде.
- **GitHub-first extension flow** — скиллы и MCP можно ставить по ссылке.
- **Layered context** — итоговый промпт собирается из нескольких независимых слоёв.

---

## 2. Architectural Stack (The Foundation)

- **Runtime**: Tauri v2 (Rust Core) — минимальный футпринт, безопасность и прямой доступ к системным ресурсам.
- **Frontend**: React 19 + Vite.
- **UI Engine**: Tailwind CSS v4 + Framer Motion + 21st.dev.
- **State Management**: Zustand для UI state, TanStack Query для server/state synchronization.
- **Inference Bridge**: OpenAI-compatible shim на Rust, чтобы абстрагировать логику агента от конкретного провайдера.
- **Database**: SQLite через `tauri-plugin-sql` для индексации скиллов, сессий и метаданных проектов.
- **Language**: Rust для логики и инструментов, TypeScript для UI.
- **Local AI Bridge**: Ollama API и LM Studio SDK через localhost, с возможностью расширения через inference shim.

### 2.1 Design Principles

- **Local-first by default**.
- **Modular by file structure**.
- **Provider-agnostic AI layer**.
- **Predictable and inspectable orchestration**.
- **No hidden roles, no hidden knowledge, no hidden state**.

### 2.2 Why Tauri

Tauri подходит для AuraOS, потому что даёт:
- нативную скорость;
- малый размер приложения;
- Rust-based security and orchestration;
- удобный путь к desktop UX без тяжелого Electron-footprint.

---

## 3. Cognitive Engine & Orchestration

Центральный компонент системы — **Reactive Agent Loop**.  
В отличие от линейных промптов, AuraOS 2.0 использует циклическую модель:

`Thought -> Tool Call -> Observation -> Analysis`

### 3.1 Loop Mechanics

- **Structured Tooling**: инструменты описываются через строгие схемы; ручной парсинг не используется.
- **Max Turns**: динамический лимит шагов с возможностью продления при видимом прогрессе.
- **Interruptible State**: агент запускается как background task в Rust, что позволяет мгновенно прерывать выполнение без зависания UI.
- **Task Awareness**: агент всегда знает, на каком уровне он работает — модель, субагент, скилл, проектное правило или внешний инструмент.

### 3.2 Context Management: Snip & Compact

Чтобы решать проблему переполнения контекста, AuraOS применяет алгоритм **Snip & Compact**.

1. **Snip Point**: при достижении порога окна контекста система определяет точку среза.
2. **Preserved Segment**: последние сообщения и текущий рабочий хвост сохраняются без искажения.
3. **Compacted History**: более ранняя история сжимается в компактный системный блок, содержащий:
   - краткое резюме выполненных действий;
   - перечень прочитанных файлов;
   - текущее состояние задачи;
   - принятые архитектурные решения;
   - важные ограничения и предпочтения.
4. **Relinking**: компактный блок связывается с сохранённым хвостом через стабильный session pointer.

### 3.3 Context Rules

- Не терять текущую цель.
- Не дублировать устаревшие инструкции.
- Не подмешивать лишние скиллы.
- Не разрушать связь между проектом, ролью и задачей.
- Всегда сохранять возможность восстановить ход решения.

---

## 4. Dynamic Federated Agents (DFA)

AuraOS 2.0 использует полностью файлово-ориентированную архитектуру агентов.  
Жёстко закодированных ролей в приложении не существует — все роли определяются файлами.

### 4.1 Source of Roles

- **Directory**: `.claude/agents/`
- Каждый файл `*.md` внутри этой папки определяет одну роль.
- Имя файла без расширения становится названием роли.

Примеры:
- `planner.md`
- `executor.md`
- `verifier.md`
- `researcher.md`
- `debugger.md`

### 4.2 Dynamic Discovery

Система автоматически сканирует `.claude/agents/`:
- при запуске проекта;
- при изменении файлов;
- при добавлении или удалении роли.

Результат:
- новый `.md` файл → новая роль появляется в Model Router;
- удаление файла → роль исчезает из интерфейса и оркестрации.

### 4.3 Role-to-Model Assignment

- Для каждой роли можно независимо назначить любую доступную локальную модель.
- Разные роли могут использовать разные модели одновременно.
- Назначение модели не фиксируется глобально, а хранится как проектная или пользовательская настройка.

### 4.4 Role Instructions

Содержимое `agent_name.md` полностью определяет поведение субагента:
- стиль мышления;
- обязанности;
- ограничения;
- приоритеты;
- формат ответов;
- допустимые инструменты;
- критерии завершения задачи.

### 4.5 Command Layer

- Папка `.claude/commands/` содержит `.md` файлы с кастомными командами и инструментами.
- Команды доступны субагентам согласно их инструкциям и правам.
- Команды рассматриваются как расширение оркестрации, а не как отдельная логика приложения.

### 4.6 Layered Prompt Construction

Промпт собирается по принципу слоёв от общего к частному:

1. **Base Architecture Instruction** — базовая логика AuraOS.
2. **Role-Specific Instruction** — содержимое выбранного файла из `.claude/agents/`.
3. **Skill Context** — контекст активных скиллов из Shared Skill Core.
4. **Project Context** — локальные правила проекта (`.rules/`, `CLAUDE.md`, дополнительные инструкции).

### 4.7 Orchestration Patterns

Поддерживаются:
- одиночный субагент;
- последовательный вызов нескольких ролей;
- role handoff;
- проверка результата отдельным verifier-агентом;
- динамический выбор роли системой.

Пример цепочки:
- Planner → Executor → Verifier

### 4.8 DFA Design Goal

Цель DFA — сделать систему, где роли живут как файлы, а не как код.  
Это обеспечивает:
- прозрачность;
- расширяемость;
- переносимость;
- easy maintenance;
- совместимость с GitHub-first distribution.

---

## 5. Shared Skill Core (SSC)

Shared Skill Core — глобальное хранилище знаний и инструментов, доступное во всех проектах пользователя.

### 5.1 Skill Definition

Каждый скилл — это директория, содержащая:

- `skill.json` — метаданные: имя, версия, зависимости, tags, required_models.
- `SKILL.md` — системные инструкции по использованию навыка.
- `src/` — опционально, исходный код MCP-сервера или скрипты-инструменты.
- `examples/` — опционально, примеры применения.
- `assets/` — опционально, шаблоны, схемы, ресурсы.

### 5.2 Skill Types

Поддерживаются несколько типов скиллов:

- **Knowledge skill** — знания, шаблоны, методики.
- **Workflow skill** — пошаговые процессы и регламенты.
- **Tool skill** — инструкции для конкретных инструментов.
- **MCP skill** — скилл, который поднимает локальный MCP-сервер.
- **Hybrid skill** — сочетание знаний, инструкций и инструментов.

### 5.3 Skill Activation Model

Каждый скилл имеет состояние:
- inactive;
- active;
- locked;
- deprecated.

Активация происходит через UI-тумблер или команду.  
После активации скилл становится частью глобального Skill Context и может использоваться всеми подходящими субагентами.

### 5.4 GitHub-First Installer

- **Engine**: `git2` crate.
- **Flow**: пользователь вводит ссылку → `git clone --depth 1` в `~/.auraos/skills/` → автоматическая валидация `skill.json` → регистрация в SQLite.
- **Activation**: чекбокс в UI включает/выключает скилл в глобальном Dispatcher.
- **Branch/Tag support**: возможно указание ветки или тега.
- **Update flow**: обновление через pull/reclone с проверкой версии.

### 5.5 Discovery and Indexing

После установки AuraOS:
- сканирует содержимое скилла;
- строит индекс по заголовкам, тегам и методам;
- сохраняет метаданные в `skill_core_index`;
- добавляет скилл в поисковый слой.

### 5.6 Compatibility Sources

Для обратной совместимости поддерживается сканирование:
- `~/.opencode/skills/`
- `~/.claude/plugins/`
- локальных проектных каталогов скиллов.

### 5.7 Skill Resolution

При выполнении задачи система:
- определяет intent;
- ищет релевантные навыки;
- подмешивает только нужные фрагменты;
- избегает полного загрузочного шума;
- учитывает приоритеты и конфликты.

### 5.8 Skill Conflict Policy

Если два скилла конфликтуют:
- приоритет у активного проекта;
- затем у explicitly selected skill;
- затем у более специфичного skill package;
- затем у базового skill core.

---

## 6. Hardware-Aware Monitoring (Observability)

AuraOS 2.0 чувствует машину и показывает состояние локальных ресурсов в реальном времени.

### 6.1 Monitoring Inputs

Модуль мониторинга (`monitor.rs`) предоставляет:
- **GPU**: VRAM usage, load, temperature через NVML или совместимый источник.
- **CPU**: per-core load, temperature, total load.
- **Memory**: available RAM, swap, pressure.
- **Disk**: space usage, I/O saturation.
- **Process state**: статус локальных моделей и MCP-сервисов.

### 6.2 UI Integration

- live widget в сайдбаре;
- цветовая индикация;
- статус системы в одном взгляде.

Пример состояний:
- Cyan = Chill
- Orange = Thinking
- Pulse Red = Error / OOM / service down

### 6.3 Monitoring Goals

- заранее видеть перегрузку;
- понимать, почему модель тормозит;
- быстро реагировать на падение сервиса;
- не допускать скрытых зависаний;
- улучшить UX работы с локальным AI.

---

## 7. Data Model (SQLite Schema)

*Snake_case naming convention.*

### 7.1 Core Tables

- **projects**
  - `id` (uuid)
  - `name`
  - `path`
  - `created_at`
  - `config` (json)

- **skills**
  - `id`
  - `name`
  - `source_url`
  - `local_path`
  - `is_active` (bool)
  - `metadata` (json)

- **sessions**
  - `id`
  - `project_id`
  - `model_id`
  - `transcript` (json)
  - `compact_state` (json)

- **model_config**
  - `task_type`
  - `model_name`
  - `provider_url`

### 7.2 Extended Tables

- **ai_models_config**
  - `id` (integer primary key)
  - `task_type` (example: logic, code, docs)
  - `model_name`
  - `provider` (`ollama` | `lm_studio`)
  - `parameters` (json)

- **skill_core_index**
  - `id` (uuid primary key)
  - `name`
  - `path`
  - `methods` (json)
  - `is_active`
  - `tags`

### 7.3 Optional Tables

- **agents**
  - `id`
  - `name`
  - `source_path`
  - `model_name`
  - `is_active`
  - `metadata`

- **commands**
  - `id`
  - `name`
  - `source_path`
  - `scope`
  - `metadata`

- **project_rules**
  - `id`
  - `project_id`
  - `rule_path`
  - `priority`
  - `content_hash`

### 7.4 Data Principles

- Everything that matters should be indexable.
- Everything that can be repeated should be reusable.
- Everything that is project-specific should remain scoped.
- Everything that is global should be shared through SSC.
- Everything that is ephemeral should be compacted or summarized.

---

## 8. UX/UI: Fluid Zen Design System

**Fluid Zen** — это эстетика профессионального терминала будущего.

### 8.1 Visual Language

- минимальный визуальный шум;
- спокойная аналитическая глубина;
- ясная иерархия;
- premium feel без перегрузки;
- ощущение “тихой мощности”.

### 8.2 Component Strategy

Используются:
- **21st.dev**;
- **Magic UI**;
- **Framer Motion**;
- **Tailwind CSS v4**.

Компоненты должны поддерживать:
- Bento grids;
- animated borders;
- command palette;
- skill cards;
- agent cards;
- router panels;
- live monitoring widgets.

### 8.3 Color Palette

- Background: `#050505` (Obsidian)
- Cards/Panels: `#0a0a0a`
- Accent Cyan: `#00f5ff`
- Accent Indigo: `#6366f1`
- Success Green: `#22c55e`
- Warning Orange: `#f59e0b`
- Error Red: `#ef4444`

### 8.4 Typography

- Monospace: `Geist Mono`
- UI: `Outfit` или `Inter`

### 8.5 Motion Language

- micro-animations;
- spring transitions;
- hover depth;
- subtle glow;
- calm state transitions.

### 8.6 UI Priorities

- clarity over decoration;
- action over spectacle;
- predictability over novelty;
- readability over complexity.

---

## 9. Workflow & Tooling

Инструменты (“Hands”) реализуются на уровне Rust для максимальной надёжности.

### 9.1 Core Tools

1. **fs_read / fs_write**
   - обязательная проверка security perimeter;
   - работа только внутри project root или разрешённых путей.

2. **fs_grep / fs_glob**
   - реактивный поиск;
   - быстрый поиск по коду, документации и скиллам.

3. **terminal**
   - streaming execution;
   - поддержка OS-specific backends.

4. **mcp_client**
   - запуск внешних MCP-серверов;
   - регистрация capabilities;
   - обеспечение связи с Model Router.

### 9.2 Tooling Philosophy

- Инструменты должны быть предсказуемыми.
- Ошибки должны быть наблюдаемыми.
- Вызовы должны быть валидируемыми.
- Результаты должны быть пригодны для повторного использования.
- Каждый инструмент должен быть безопасен по умолчанию.

---

## 10. Security & Privacy

### 10.1 Privacy Model

- **Local-first**: весь инференс и данные — на машине пользователя.
- **Zero-telemetry**: отсутствует внешняя телеметрия по умолчанию.
- **Project isolation**: проектные правила не смешиваются между workspace.
- **Explicit sharing**: любое расширение контекста должно быть явным.

### 10.2 Secrets Management

- PAT для GitHub хранится через системный keychain.
- Токены доступа не должны попадать в лог или историю.
- Секреты не должны быть частью Skill Core или session transcript.

### 10.3 Safety Constraints

- операции файловой системы ограничены root-perimeter;
- инструменты вызываются по схеме;
- внешние действия требуют явного разрешения;
- MCP-серверы должны проходить локальную регистрацию и валидацию.

---

## 11. Edge Cases

### 11.1 Ollama Down

Если Ollama недоступен:
- UI показывает статус Pulse Red;
- система предлагает запуск сервиса;
- задачи могут быть переключены на доступную локальную модель.

### 11.2 Context Overload

При достижении физического лимита контекста:
- выполняется принудительный Snip;
- история сжимается;
- хвост сохраняется;
- session continuity не теряется.

### 11.3 Skill Conflict

При конфликте имён команд, инструментов или методов:
- система детектирует дубликаты;
- показывает приоритет источников;
- позволяет вручную выбрать активный вариант.

### 11.4 Model Unavailable

Если выбранная модель недоступна:
- используется fallback policy;
- роутер подбирает совместимую альтернативу;
- пользователь видит понятное уведомление.

### 11.5 Corrupted Skill Package

Если пакет скилла повреждён:
- он не активируется;
- запись помечается как invalid;
- система предлагает переустановку.

### 11.6 Broken Project Rules

Если `.rules/` или `CLAUDE.md` содержит конфликт:
- применяются более приоритетные правила;
- конфликт отображается в diagnostics;
- решение не должно ломать текущую сессию.

---

## 12. User Stories

### 12.1 Model Router Story

Как пользователь, я хочу, чтобы система автоматически выбирала модель в зависимости от типа задачи, чтобы получить лучший баланс скорости и качества.

### 12.2 Global Skills Story

Как пользователь, я хочу один раз настроить скилл и использовать его во всех проектах, чтобы не повторять одно и то же описание.

### 12.3 Subagent Story

Как пользователь, я хочу назначить отдельную роль под анализ, код и проверку, чтобы разделить когнитивную нагрузку и повысить качество результата.

### 12.4 Private Workflow Story

Как пользователь, я хочу, чтобы все данные и контекст оставались локально, чтобы безопасно работать с чувствительными материалами.

### 12.5 Knowledge Continuity Story

Как пользователь, я хочу, чтобы мои лучшие практики и шаблоны не терялись между проектами, чтобы AuraOS становился умнее вместе со мной.

---

## 13. Non-Functional Requirements

### 13.1 Performance

- быстрый запуск приложения;
- низкая задержка UI;
- минимальный overhead на маршрутизацию;
- мгновенная реакция на изменения ролей и скиллов.

### 13.2 Reliability

- устойчивость к падению модели;
- восстановление сессии;
- безопасный fallback;
- корректная работа при частично сломанных конфигурациях.

### 13.3 Maintainability

- file-driven architecture;
- прозрачные схемы;
- ясные метаданные;
- минимальный скрытый state;
- легко расширяемая структура.

### 13.4 Portability

- переносимость между проектами;
- поддержка portable app-data;
- совместимость с локальными директориями навыков;
- отсутствие жёсткой привязки к одному provider.

---

## 14. Recommended Improvements

Ниже — что я бы добавил в спецификацию, чтобы она была ещё сильнее.

### 14.1 Explicit Versioning

Стоит явно определить:
- версию схемы skill.json;
- версию agent file format;
- версию database schema;
- версию prompt layering format.

### 14.2 Manifest Format

Полезно описать стандартный manifest для:
- skill packages;
- agent files;
- commands;
- MCP services.

### 14.3 Capability Negotiation

Нужно определить, как AuraOS понимает:
- какие инструменты доступны;
- какие модели поддерживают конкретный формат;
- какие скиллы совместимы с конкретным агентом;
- какие MCP можно запускать на текущей машине.

### 14.4 Observability Events

Добавить event layer:
- skill_installed;
- skill_activated;
- agent_spawned;
- model_switched;
- context_compacted;
- mcp_registered;
- task_completed;
- task_failed.

### 14.5 Recovery Flow

Нужно описать:
- восстановление после падения приложения;
- восстановление после падения модели;
- восстановление после ошибки MCP;
- восстановление после невалидного skill package.

---

## 15. Final System Statement

**AuraOS 2.0** — это local-first cognitive shell, где роли, знания, инструменты и проектные правила собираются в единую динамическую систему.  
Она объединяет:
- динамических субагентов;
- глобальный Shared Skill Core;
- локальный model router;
- GitHub-first установку;
- layered context;
- приватную и расширяемую архитектуру.

В результате пользователь получает не просто AI-инструмент, а **персональную операционную систему для мышления, кодинга и аналитики**.

---

## 16. Notes for Implementation

- Начинать с минимального ядра: router + skills + agent files + session persistence.
- Не перегружать MVP визуальными эффектами.
- Сначала сделать надёжную файловую архитектуру, потом усложнять UX.
- Логику контекста и приоритетов описать формально до разработки UI.
- Держать спецификацию синхронизированной с реальной структурой каталогов.
