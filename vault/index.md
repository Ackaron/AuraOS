---
type: index
status: active
tags: [gsd, knowledge-base, hub]
created: 2026-03-20
updated: 2026-03-20
---

# 🧠 Knowledge Vault Index (MOC)

Этот раздел является "вторым мозгом" проекта и центральным узлом навигации (Map of Content). Здесь хранятся долгосрочные знания, архитектурные решения и контекст, который агент использует для глубокого понимания проекта между сессиями.

## 🏛 [[Architecture]]
- **Decision Records**: Решения по стеку, логика базы данных и ключевые паттерны.
- **Templates**: См. [[ADR_TEMPLATE]] для записи новых архитектурных решений.
- **Database**: Описание схем Prisma и политик RLS для Supabase.

## 📝 [[Sessions]]
- **Chronology**: История работы и лог сессий, создаваемый командой `/save`.
- **Context Recovery**: Позволяет быстро восстановить нить разработки после перерыва или переключения между задачами.
  - [[2026-04-05_initialization]] — Phase 0: Bootstrap + Layout Demo v1
  - [[agent-genesis-phase3-2026-04-06]] — Phase 3: AI Bridge In Progress

## 🧩 [[Modules]]
- **Code Documentation**: Техническое описание конкретных модулей, компонентов и интеграций.
- **UI Pro Patterns**: Использование шаблонов из `uipro` и элементов `21st.dev`.

## 💼 Business Context
- **Vision**: Описание бизнес-логики и целей проекта (ссылается на [[PROJECT_IDEA]]).
- **Audience**: Целевая аудитория и ключевые Jobs-to-be-Done.

---

## 🛠 Knowledge Workflow
1. **Search**: Перед началом задачи агент использует `obsidian-skills` для поиска по этому индексу.
2. **Update**: Executor обновляет [[Architecture]] или [[Modules]] при внесении значимых правок.
3. **Persist**: Команда `/save` автоматически линкует новую сессию в раздел [[Sessions]].

> **Engineering Note**: База знаний должна быть такой же чистой и структурированной, как звук **Greco Les Paul 1975**. Никакого мусора, только рабочие связи [[Wikilinks]].