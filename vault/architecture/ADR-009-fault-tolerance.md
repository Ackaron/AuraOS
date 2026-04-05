---
type: adr
status: accepted
tags: [gsd, architecture, fault-tolerance, state-management]
created: 2026-04-06
updated: 2026-04-06
---

# ADR-009: Fault-Tolerant State Management

## 1. Контекст (The Problem)
Предыдущая реализация имела проблемы:
- Ошибка в одном плагине (global-shortcut) блокировала инициализацию всего приложения
- Терминал мигал и исчезал из-за race condition между React и Rust
- Состояние терминала хранилось локально в компоненте, а не в глобальном store
- SQLite и Ollama инициализировались без изоляции ошибок

## 2. Предложенное решение (The Decision)

### Централизация состояния в auraStore.ts:
```typescript
interface AuraState {
  // UI State (все в одном месте)
  isSidebarCollapsed: boolean;
  isTerminalOpen: boolean;
  sidebarWidth: number;
  agentWidth: number;
  
  // Actions
  toggleTerminal: () => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setAgentWidth: (width: number) => void;
}
```

### Изоляция инициализации:
- Каждый компонент инициализации (DB, Ollama, Models) обернут в try-catch
- Ошибка в одном компоненте не влияет на другие
- Логирование через `log::info/error` в Rust для отладки

### Terminal State Flow:
1. Rust global shortcut → emit "toggle-terminal" 
2. React listen → вызывает `toggleTerminal()` из store
3. Store меняет `isTerminalOpen: !isTerminalOpen`
4. BottomTerminal реагирует на изменение через selector

### Resizable Panels:
- Agent panel: drag handle справа, ширина в store + localStorage
- Sidebar: toggle кнопка, фиксированная ширина 64px в collapsed режиме

## 3. Последствия (Consequences)

### ✅ Плюсы
- Единый source of truth для UI состояния
- Отказоустойчивость: ошибка плагина не убивает приложение
- Предсказуемое поведение терминала без миганий
- Persistence ширины панелей через localStorage

### ❌ Минусы / Риски
- Zustand store должен быть синхронизирован с localStorage для долгосрочного хранения

## 4. Статус (Status)
- [ ] **Proposed**
- [x] **Accepted**

## 5. Связи (Links)
- Код: `src/stores/auraStore.ts` — все UI состояния
- Код: `src/components/Layout/Layout.tsx` — resizable панели
- Код: `src/components/Terminal/BottomTerminal.tsx` — терминал с store
- Rust: `src-tauri/src/lib.rs` — изолированная инициализация с логированием