# Session Log: 2026-04-08 Agent Brain Fixes

## Date
2026-04-08

## Context
User reported that asking "привет, что ты умеешь?" caused the agent to generate ~26500 tokens with massive duplication and JSON blocks leaking into the chat UI instead of clean text.

## Problems Identified

1. **System prompt too verbose** — ~3000 tokens of rules, examples, formatting
2. **Project structure scanned** — full directory tree added thousands of tokens
3. **All .rules/*.md loaded** — massive context bloat
4. **Skills loaded in full** — entire SKILL.md content injected
5. **Thoughts emitted to UI** — internal reasoning shown in chat
6. **JSON blocks not sanitized** — tool call blocks leaked to final output
7. **max_steps = 15** — too many loops causing repetition
8. **Force tool use** — model forced to call tools even for simple questions

## Fixes Applied

### 1. Simplified System Prompt (`agent_engine.rs:821-825`)
- Reduced from ~3000 to ~200 tokens
- Clear rule: "отвечай ПРОСТЫМ ТЕКСТОМ без JSON"
- Explicit: "НЕ выводи мысли (thought) — они только для контекста"

### 2. Removed Project Structure Scan (`agent_engine.rs:844`)
- Removed `list_directory()` call that added thousands of tokens
- Replaced with simple: "Ты работаешь с проектом: {path}"

### 3. Limited Rules Loading (`agent_engine.rs:855`)
- Changed from scanning ALL `.rules/*.md` to ONLY `CLAUDE.md`
- Reduced from ~5000+ tokens to ~100

### 4. Skills Just Listed (`agent_engine.rs:882-892`)
- No longer reads full SKILL.md content
- Just lists skill names: "Активные скиллы: skill1, skill2"

### 5. Thoughts Hidden from UI (`agent_engine.rs:1185-1187`)
- Removed `on_step` emission for thoughts
- In history now stored as: `[внутренняя работа: ...]`

### 6. Reduced max_steps (`agent_engine.rs:996`)
- Changed from 15 to 5
- Faster exit from loop

### 7. Better Sanitization (`agent_engine.rs:1323-1339`)
- Filters out lines starting with `{` or `}`
- More aggressive cleanup of JSON remnants
- Normalizes whitespace

### 8. Removed Force Tool Use (`agent_engine.rs:1266-1272`)
- If model answers with text (no tools), accepts it as final response
- No more "SYSTEM ALERT: You have not called any tools"

### 9. Fixed UI Chunk Display (`AgentPanel.tsx:194-197`)
- Chunks now actually append to message content
- Was returning early without adding content

## Files Modified

- `src-tauri/src/modules/agent_engine.rs` — system prompt, loops, sanitization
- `src/components/AgentPanel/AgentPanel.tsx` — chunk display fix

## Testing
After rebuild with `npm run tauri dev`, user should see:
- Short text response to "привет, что ты умеешь?"
- No JSON blocks in output
- No thought blocks in UI
- Significantly fewer tokens consumed