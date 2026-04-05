---
type:adr
status: accepted
date: 2026-04-06
project: AuraOS
---

# ADR-006: System Prompt Injection & Shell Integration

## 📋 Context
Модель в терминале не знала своей рабочей директории и генерировала нерелевантные ответы (упоминала Alibaba Cloud). Требовалось интегрировать контекст активного проекта в каждый запрос к LLM и добавить возможность исполнять реальные shell-команды.

## 🎯 Decision

### 1. System Prompt Injection
**Реализовано в `lib.rs:run_inference`:**
- При каждом запросе к LLM автоматически добавляется system prompt
- Включает: имя AI (AuraOS AI), specs hardware (Ryzen 9 9950X3D, RTX 5080), текущая рабочая директория (`activeProjectPath`)
- Промпт на русском для лучшей релевантности

```rust
let system_prompt = format!(
    "Ты — AuraOS AI, локальный ассистент на компьютере Виктора (Ryzen 9 9950X3D, RTX 5080). \
     Твоя текущая рабочая директория: {}. Ты имеешь доступ к файлам проекта. \
     Отвечай технически точно и лаконично.\n\n",
    path
);
```

### 2. Shell Integration
**Добавлено:**
- `tauri-plugin-shell` в Cargo.toml и capabilities
- Команда `read_file_content(path)` для чтения файлов
- Префикс `!` для shell-команд в терминале (например `!dir`, `!git status`)
- Префикс `/read filename` для чтения содержимого файла

### 3. Terminal UI Updates
- Отображение текущей директории (CWD) в терминале
- Индикация активной task type (logic/code/docs/fast)
- Placeholder с подсказкой выбрать проект

## 📊 Consequences
- **Positive**: Модель теперь знает контекст проекта и отвечает релевантно
- **Positive**: Возможность исполнять реальные команды ОС через терминал
- **Negative**: Требуется активный проект для работы терминала

## 🔄 Implementation Details
- `run_inference` принимает `activeProjectPath: Option<String>`
- Shell команды выполняются через `Command.create('cmd', ['/c', cmd])` с `cwd=activeProjectPath`
- Файлы читаются через Rust `std::fs::read_to_string`

## 🏷 Tags
[system-prompt, shell, context-awareness, terminal]

---
*Generated: 2026-04-06*