# ADR-005: Hardware Polling & Memory Calculation

## Status
Accepted

## Date
2026-04-05

## Context
Необходимо обеспечить точное отображение данных о RAM, соответствующее Windows Task Manager. Предыдущая реализация использовала `used_memory()`, что давало завышенные значения.

## Decision

### RAM Calculation Formula

```rust
// Old (incorrect):
let ram_used = sys.used_memory() / 1024 / 1024;

// New (matches Task Manager):
let ram_total = sys.total_memory() / 1024 / 1024;
let ram_available = sys.available_memory() / 1024 / 1024;
let ram_used = ram_total - ram_available;
```

**Logic:** 
- Windows Task Manager показывает: Used = Total - Available
- sysinfo `available_memory()` возвращает реально доступную память
- Формула `Total - Available` дает точное соответствие

### CPU Calculation
```rust
let cpu_usage = sys.cpus().iter().map(|c| c.cpu_usage()).sum::<f32>() 
    / sys.cpus().len() as f32;
```

### GPU (Simulation)
- VRAM использует mock данные (реальный GPU мониторинг требует NVML)
- Температура также симулируется

## Consequences

**Positive:**
- RAM теперь соответствует Task Manager
- Точные данные для пользователя
- Коллапсирующая панель System Monitor

**Negative:**
- GPU данные по-прежнему mock (требует NVML интеграцию)

## References
- [[SPECIFICATION.md]] — Hardware monitoring section
- `src-tauri/src/modules/monitor.rs` — Implementation
