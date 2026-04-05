# 👨‍🔬 Command: /plan (The Strategist)

Когда пользователь вводит эту команду:
1. **Вызов роли**: Активируй субагента `gsd-planner`.
2. **Анализ Source of Truth**: Проанализируй `PROJECT_IDEA.md` и `SPECIFICATION.md`.
3. **Глубокое мышление**: Используй `/think` (Sequential Thinking) для оценки архитектурных рисков и зависимостей.
4. **Артефакты & Limits**: 
   - Обнови `.planning/ROADMAP.md` и `STATE.md`.
   - Разбей ближайшую фазу на атомарные задачи, выполнимые локальной моделью (Qwen 14B) без потери контекста.
5. **UI Strategy**: В планах на верстку явно указывай использование шаблонов `uipro` и элементов `21st.dev`.
6. **Obsidian Sync**: Используй `obsidian-skills` для обновления `vault/index.md` и создания ADR в `vault/architecture/` при изменении структуры.