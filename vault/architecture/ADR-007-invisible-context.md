---
type:adr
status: accepted
date: 2026-04-06
project: AuraOS
---

# ADR-007: Invisible Context (Proactive RAG)

## 📋 Context
Модель в терминале реагировала на явные команды (/read, /execute), но не знала структуру проекта "из коробки". Пользователь хочет общаться с AuraOS как с интегральной частью системы, а не с чат-ботом.

## 🎯 Decision

### 1. Auto-Indexing при активации проекта
**Реализовано:**
- При клике на проект в Workspace автоматически читаются ключевые файлы:
  - README.md, README.txt, readme.md
  - package.json, Cargo.toml, pyproject.toml
  - main.rs, main.ts, main.js, index.ts, index.js
  - App.tsx, App.js, app.ts
  - tsconfig.json, jsconfig.json
  - .gitignore, Makefile
- Содержимое сохраняется в `projectContext` в auraStore
- Контекст передается в каждый запрос к LLM

### 2. Усиленный Identity System Prompt
**Новый промпт:**
```
Ты — интегральная часть AuraOS. У тебя есть доступ к файловой системе Виктора. 
Никогда не говори, что ты не имеешь физического присутствия. Ты и есть этот компьютер. 
Ты — локальный AI-ассистент Виктора на его машине (Ryzen 9 9950X3D, RTX 5080, 64GB RAM). 
Отвечай технически точно, лаконично и по существу. Не упоминай облачные сервисы. 
Не говори "как ИИ". Говори "я".
```

### 3. Context Window Management
- Контекст обрезается до 4000 символов на файл
- Общий контекст проекта передается через отдельный параметр `project_context`
- Модель теперь знает суть проекта ДО первого вопроса пользователя

## 📊 Consequences
- **Positive**: Модель отвечает на "расскажи о проекте" на основе README
- **Positive**: Не нужно использовать /read для каждого файла
- **Positive**: Модель говорит "я" а не "как ИИ"
- **Negative**: Увеличенный размер промпта (может влиять на скорость)

## 🔄 Implementation Details
- `get_project_context(path)` — Rust команда для чтения ключевых файлов
- `projectContext` в auraStore — хранение контекста между запросами
- Автоматическая загрузка при клике на проект в Workspace

## 🏷 Tags
[rag, context-awareness, system-prompt, proactive-intelligence]

---
*Generated: 2026-04-06*