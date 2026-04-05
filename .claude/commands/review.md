# 🛡️ Command: /review (The Quality Guard)

Когда пользователь вводит эту команду:
1. **Вызов роли**: Активируй субагента `gsd-verifier`.
2. **Аудит Integrity**: Проверь код на соответствие `SPECIFICATION.md`, отсутствие `any`, безопасность RLS и отсутствие `TODO`.
3. **Автоматизация UI**: Используй **Playwright Skill** для визуальной проверки интерфейса (Analytic Noir, 8pt сетка) и запуска E2E тестов.
4. **Resource Check**: Убедись, что Executor не верстал вручную то, что есть в `uipro` или `21st.dev`.
5. **Obsidian Audit**: Используй `obsidian-skills` для проверки целостности `[[Wikilinks]]` и наличия YAML-метаданных.
6. **Вердикт**: Выдай список замечаний или Approve. Исправлять код ЗАПРЕЩЕНО (READ-ONLY).