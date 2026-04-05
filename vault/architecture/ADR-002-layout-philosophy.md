# ADR-002: Layout Philosophy — "Fluid Zen"

## Status
Accepted

## Date
2026-04-05

## Context
Проектирование UI-системы AuraOS v1.0.0. Необходимо создать визуальный язык, отражающий концепцию "Cognitive IDE" — минималистичный, но мощный интерфейс с акцентом на прозрачность и глубину.

## Decision

### Design Principles

**1. Analytic Noir Aesthetic**
- Background: `#000000` (Pure Black) — никаких серых оттенков
- Surfaces: `rgba(255, 255, 255, 0.03-0.06)` — минимальная прозрачность
- Borders: `rgba(255, 255, 255, 0.06)` — едва заметные границы
- Accent: `#14b8a6` (Teal/Cyan) — для активных состояний

**2. Glassmorphism Layer**
```
.glass {
  bg: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

**3. 8pt Grid System**
- Все spacing: `p-2` (8px), `p-4` (16px), `p-6` (24px), `gap-6` (24px)
- Border radius: `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px)

**4. Typography**
- UI: `Inter` — 14px body, 12px caption, 18px+ headings
- Code/Mono: `Geist Mono` / `JetBrains Mono` — для всех технических данных
- Numerics: Font-mono ОБЯЗАТЕЛЕН для предотвращения "дрожания"

**5. Spring Physics (Framer Motion)**
```typescript
transition={{ 
  type: 'spring', 
  stiffness: 280, 
  damping: 28,
  mass: 0.8
}}
```

### Component Architecture

```
┌─────────────────────────────────────────────────┐
│ Sidebar (w-72)        │ Main Area              │
│ ┌───────────────────┐  │ ┌───────────────────┐  │
│ │ Logo + Title      │  │ │ Header + Status   │  │
│ ├───────────────────┤  │ ├───────────────────┤  │
│ │ System Monitor    │  │ │                   │  │
│ │ - GPU (RTX 5080)  │  │ │   Workspace      │  │
│ │ - CPU (9950x3d)    │  │ │   (Empty State)  │  │
│ │ - Models List     │  │ │                   │  │
│ ├───────────────────┤  │ │                   │  │
│ │ Skill Core        │  │ ├───────────────────┤  │
│ │ - Guitar OS       │  │ │ Command Terminal  │  │
│ │ - Business INTCT   │  │ │ (K-Interface)    │  │
│ │ - Rust Patterns   │  │ └───────────────────┘  │
│ └───────────────────┘  │                        │
└─────────────────────────────────────────────────┘
```

### Interaction Patterns

1. **Panel Transitions**: Spring animations (x: -320 → 0)
2. **Success Feedback**: Green flash + checkmark animation
3. **Model Selection**: Pulse glow on active indicator
4. **Terminal**: Typing animation + processing spinner

## Consequences

**Positive:**
- Premium feel без визуального шума
- Консистентный опыт на всех экранах
- Готовность к RTL/dark-only будущему

**Negative:**
- Glassmorphism требует backdrop-filter (GPU нагрузка)
- Нужен хороший контраст для accessibility

## References
- [[SPECIFICATION.md]] — UI/UX Screens section
- `.rules/ui-ux.md` — Full design code
- [[ADR-001]] — Initial structure
