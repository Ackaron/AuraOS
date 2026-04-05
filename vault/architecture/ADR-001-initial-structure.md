# ADR-001: Initial Project Structure

## Status
Accepted

## Date
2026-04-05

## Context
Инициализация AuraOS — модульной IDE с локальным AI-брейнтом и Skill Core. Необходимо выбрать архитектуру для frontend и backend слоев.

## Decision
**Tech Stack:**
- **Runtime**: Tauri v2 (Rust Core) для нативной скорости и доступа к GPU
- **Frontend**: React 19 + Vite + TypeScript (Strict Mode)
- **State**: Zustand (UI state) + Rust Mutex (shared state)
- **Styling**: Tailwind CSS v4 + Framer Motion (spring animations)
- **Theme**: Analytic Noir — Pure Black (#000000), 8pt grid

**Rust Modules:**
- `monitor` — GPU/CPU stats streaming через Tauri Events
- `skill_engine` — FS Watcher для индексации скиллов

**React Components:**
- `Layout` — Sidebar + Main Area с glassmorphism
- `ModelMonitor` — VRAM/Model status display
- `SkillPanel` — Skill Core browser
- `CommandTerminal` — NLP input (K-интерфейс)

## Consequences
**Positive:**
- Нативная скорость через Rust
- Премиальный UI через Tailwind v4 + Framer Motion
- Готовность к GPU мониторингу

**Negative:**
- Сложность конфигурации Tailwind v4 (PostCSS plugin change)
- Необходимость поддержки двух языков

## References
- [[PROJECT_IDEA]]
- [[SPECIFICATION.md]]
- `.rules/ui-ux.md`
