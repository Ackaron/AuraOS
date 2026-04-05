# 🧠 Obsidian Knowledge Management (Kepano Standard + Skills)

## 1. Automated Knowledge Control
- **Skill Usage**: Агент обязан использовать установленные `obsidian-skills` для поиска, создания и редактирования заметок.
- **Deep Search**: Вместо простого чтения файлов, используй скилл поиска по всему `vault/` для нахождения контекста в старых сессиях или ADR.
- **Link Management**: Используй автоматическое управление `[[Wikilinks]]`, чтобы поддерживать целостность графа знаний без "битых" связей.

## 2. Structural Principles (The Architecture)
- **Atomic Notes**: Одна заметка = одна идея, модуль или ADR. Избегай длинных документов.
- **Maps of Content (MOC)**: Используй `vault/index.md` как центральный узел (Hub). Категории: `Architecture`, `Sessions`, `Database`, `Business Logic`.
- **Kepano Folder Logic**:
  - `vault/architecture/` — проектные решения (ADR).
  - `vault/sessions/` — логи сессий от команды `/save`.
  - `vault/modules/` — документация компонентов кода.

## 3. Metadata Standard (YAML)
Каждая заметка ОБЯЗАНА начинаться с YAML-блока:
```yaml
---
type: {feature | adr | session | module | idea}
status: {idea | in-progress | completed | archived}
tags: [gsd, project-name]
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

## 4. Automated Session Logging (Future AuraOS Integration)

Когда AuraOS достигнет v1.0, автоматическое логирование должно работать так:

### Session Trigger
- Команда `/save` или `/sync` в Terminal активирует процесс записи
- Автоматически собирает: текущую задачу, измененные файлы, статус ROADMAP

### Automated Fields
```yaml
---
type: session
status: completed
date: auto-generated
project: AuraOS
phase: read from .planning/STATE.md
tags: [auto, session]
---
```

### Content Collection
- **Completed Tasks**: Парсит `.planning/STATE.md` → `## ✅ Последние шаги`
- **Active Context**: Берет текущую задачу из STATE
- **File Changes**: Ищет git diff или анализирует измененные файлы
- **Artifacts**: Ссылается на новые ADRs в `vault/architecture/`

### Folder Structure Auto-Creation
```
vault/
└── sessions/
    └── YYYY-MM-DD_description.md  # авто-создание при /save
```

### Skill State Sync
При каждом `/save`:
1. Читает текущие активные скиллы из `useAuraStore`
2. Записывает: какие скиллы были активны в этой сессии
3. Линкует к `vault/index.md` через MOC

> **Greco Philosophy**: Логи должны быть такими же чистыми, как звук Greco Les Paul 1975 — никакого мусора, только рабочие связи.