---
type: adr
status: accepted
tags: [gsd, architecture, ui, layout]
created: 2026-04-06
updated: 2026-04-06
---

# ADR-008: Three-Panel Layout with File Viewer & Agent Chat

## 1. Контекст (The Problem)
AuraOS нуждается в обновленном лейауте для максимальной продуктивности разработчика:
- Терминал агента должен быть справа на всю высоту (как в Antigravity)
- Нужна ресайзабельная область для изменения ширины панелей
- Центральная часть должна отображать файлы для просмотра/редактирования
- При двойном клике на файл в FileTree — открывать его в редакторе
- Админ-терминал с elevated privileges для системных команд

## 2. Предложенное решение (The Decision)

### Структура панелей:
```
┌──────────────────────────────────────────────────────────────┐
│ Sidebar (Left)     │  Workspace (Center)  │  Agent (Right)   │
│ - ModelMonitor     │  - FileViewer        │  - Chat          │
│ - ModelRouter      │  - Monaco Editor     │  - Admin Term    │
│ - SkillPanel       │  - Tabs              │                  │
│ - ProjectPanel     │  - Bottom Terminal   │                  │
│ - SystemStats      │  (Ctrl+`)            │                  │
├─────────────────────┼──────────────────────┼──────────────────┤
│   280px (fixed)     │  flex                │  resizeable      │
│                    │  (25% bottom term)   │  200-600px      │
└──────────────────────────────────────────────────────────────┘
```

### Техническая реализация:
1. **Layout.tsx**: 
   - Drag handle между Workspace и Agent Panel
   - Ширина сохраняется в localStorage (key: `auraos-agent-panel-width`)
   - Диапазон: 200px - 600px
   
2. **FileViewer.tsx**: 
   - Monaco Editor для подсветки синтаксиса
   - Табы для открытых файлов (Sublime/VS Code style)
   - Кнопка закрытия (X) на каждом табе

3. **BottomTerminal.tsx**: 
   - Выезжает снизу вверх (spring animation)
   - Занимает 25% высоты Workspace
   - Горячая клавиша: `Ctrl+\`` (backtick)
   - Автоматически инициализируется с правами администратора
   - При открытии показывает: `🔒 Admin Terminal initialized in: {activeProjectPath}`

4. **Rust commands**: 
   - `run_shell_command`: стандартный вызов cmd.exe
   - `run_admin_command`: PowerShell с `RunAs` для elevated privileges

### Shell Integration:
- `run_shell_command`: стандартный вызов cmd.exe
- `run_admin_command`: PowerShell с `RunAs` для elevated privileges

### Анимации:
- Terminal slide-up: `type: 'spring', stiffness: 300, damping: 28`
- Agent panel: `type: 'spring', stiffness: 280, damping: 28`
- Табы: плавное появление через framer-motion

## 3. Последствия (Consequences)

### ✅ Плюсы
- Трипанельный лейаут соответствует лучшим IDE (VS Code, Zed)
- Monaco Editor обеспечивает профессиональную подсветку кода
- Agent Panel справа — привычный паттерн для AI-ассистентов
- Admin Terminal с elevated privileges — полный контроль над системой
- Resizable панели с persistence — гибкость для разных размеров экранов
- Ctrl+` быстрый доступ к терминалу как в VS Code
- Табы позволяют быстро переключаться между файлами

### ❌ Минусы / Риски
- Monaco Editor может быть тяжелым для очень больших файлов
- Admin terminal требует UAC подтверждения на Windows
- localStorage очищается при браузерном сбросе (можно мигрировать в SQLite)

## 4. Статус (Status)
- [ ] **Proposed**
- [x] **Accepted**

## 5. Связи (Links)
- Код: 
  - `src/components/Layout/Layout.tsx` — resizable agent panel
  - `src/components/FileViewer/FileViewer.tsx` — Monaco + tabs
  - `src/components/Terminal/BottomTerminal.tsx` — Ctrl+` terminal
  - `src/components/AgentPanel/AgentPanel.tsx` — chat + admin toggle
- Rust: `src-tauri/src/lib.rs` — `run_shell_command`, `run_admin_command`
- Сессия: [[vault/sessions/2026-04-06_ui-enhancements]]