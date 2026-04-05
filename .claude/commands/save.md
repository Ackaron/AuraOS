# 🧠 Command: /save (Knowledge Persistence)

Когда пользователь вводит эту команду:
1. **Резюме сессии**: Собери отчет: решенные задачи, принятые ADR и изменения в схеме.
2. **Автоматизированное логирование**: Используй `obsidian-skills` для создания лога в `vault/sessions/` (формат: `YYYY-MM-DD_TaskName.md`).
3. **Knowledge Sync**: 
   - Обнови статусы и связи в `vault/index.md` согласно `.rules/obsidian.md`.
   - Убедись, что все новые заметки соответствуют стандарту Kepano (YAML + `[[Wikilinks]]`).
4. **Graph View Integrity**: Убедись, что новые модули корректно отображаются в Obsidian Graph View.