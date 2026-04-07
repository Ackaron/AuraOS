import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Plus, Square, Terminal as TerminalIcon } from 'lucide-react';
import { useAuraStore } from '@/stores';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error';
  content: string;
  timestamp: Date;
}

interface BottomTerminalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BottomTerminal({ isOpen, onClose }: BottomTerminalProps) {
  const { 
    activeProjectPath, 
    terminalCwd, 
    terminalSessions, 
    activeTerminalId, 
    addTerminalSession, 
    removeTerminalSession, 
    setActiveTerminalId,
    updateTerminalSession
  } = useAuraStore();

  const [sessionLines, setSessionLines] = useState<Record<string, TerminalLine[]>>({});
  const [input, setInput] = useState('');
  const [mounted, setMounted] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const unlistenRefs = useRef<Record<string, (() => void)[]>>({});

  const activeSession = useMemo(() => 
    terminalSessions.find(s => s.id === activeTerminalId),
    [terminalSessions, activeTerminalId]
  );

  const currentCwd = activeSession?.cwd || terminalCwd || activeProjectPath;

  const [history, setHistory] = useState<Record<string, string[]>>({});
  const [historyIndex, setHistoryIndex] = useState<Record<string, number>>({});

  useEffect(() => {
    setMounted(true);
    // Initialize first terminal if none exist
    if (terminalSessions.length === 0 && activeProjectPath) {
      handleNewTerminal();
    }
  }, [activeProjectPath]);

  // Dynamic Listeners for each session
  useEffect(() => {
    const setupSessionListeners = async (sessionId: string) => {
      if (unlistenRefs.current[sessionId]) return;

      const { listen } = await import('@tauri-apps/api/event');
      
      const un1 = await listen<string>(`terminal-data-${sessionId}`, (event) => {
        setSessionLines(prev => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] || []), {
            id: Math.random().toString(),
            type: 'output',
            content: event.payload,
            timestamp: new Date(),
          }]
        }));
      });

      const un2 = await listen<string>(`terminal-error-${sessionId}`, (event) => {
        setSessionLines(prev => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] || []), {
            id: Math.random().toString(),
            type: 'error',
            content: event.payload,
            timestamp: new Date(),
          }]
        }));
      });

      unlistenRefs.current[sessionId] = [un1, un2];
    };

    terminalSessions.forEach(s => setupSessionListeners(s.id));

    return () => {
      // Cleanup unlisten refs for sessions that no longer exist
      Object.keys(unlistenRefs.current).forEach(id => {
        if (!terminalSessions.some(s => s.id === id)) {
          unlistenRefs.current[id].forEach(u => u());
          delete unlistenRefs.current[id];
        }
      });
    };
  }, [terminalSessions]);

  const handleNewTerminal = async () => {
    const cwd = activeProjectPath || 'C:\\';
    const id = addTerminalSession(cwd, 'Shell');
    try {
      await invoke('create_terminal_session', { id, cwd });
      setSessionLines(prev => ({
        ...prev,
        [id]: [{
          id: 'welcome',
          type: 'output',
          content: `🔒 Aura Shell connected.\nLocation: ${cwd}`,
          timestamp: new Date(),
        }]
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCloseTerminal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await invoke('close_terminal_session', { id });
    removeTerminalSession(id);
    setSessionLines(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleInterrupt = async () => {
    if (!activeTerminalId) return;
    try {
      await invoke('interrupt_terminal_session', { id: activeTerminalId });
      updateTerminalSession(activeTerminalId, { isRunning: false });
      setSessionLines(prev => ({
        ...prev,
        [activeTerminalId]: [...(prev[activeTerminalId] || []), {
          id: Date.now().toString(),
          type: 'error',
          content: '^C (Process interrupted)',
          timestamp: new Date(),
        }]
      }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen && mounted) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mounted, activeTerminalId]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [sessionLines, activeTerminalId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeTerminalId) return;
    const sessHistory = history[activeTerminalId] || [];
    const sessIdx = historyIndex[activeTerminalId] ?? -1;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (sessHistory.length > 0) {
        const nextIndex = sessIdx + 1 < sessHistory.length ? sessIdx + 1 : sessIdx;
        setHistoryIndex(prev => ({ ...prev, [activeTerminalId]: nextIndex }));
        setInput(sessHistory[sessHistory.length - 1 - nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (sessIdx > 0) {
        const nextIndex = sessIdx - 1;
        setHistoryIndex(prev => ({ ...prev, [activeTerminalId]: nextIndex }));
        setInput(sessHistory[sessHistory.length - 1 - nextIndex]);
      } else if (sessIdx === 0) {
        setHistoryIndex(prev => ({ ...prev, [activeTerminalId]: -1 }));
        setInput('');
      }
    } else if (e.ctrlKey && e.key === 'c') {
      handleInterrupt();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentCwd || !activeTerminalId || activeSession?.isRunning) return;

    const cmd = input.trim();
    
    // Update history
    setHistory(prev => {
      const sessH = prev[activeTerminalId] || [];
      if (sessH[sessH.length - 1] === cmd) return prev;
      return { ...prev, [activeTerminalId]: [...sessH, cmd] };
    });
    setHistoryIndex(prev => ({ ...prev, [activeTerminalId]: -1 }));

    // Update Name by command
    const newName = cmd.split(' ')[0] + (cmd.split(' ')[1] ? ' ' + cmd.split(' ')[1] : '');
    updateTerminalSession(activeTerminalId, { 
      name: newName.length > 15 ? newName.substring(0, 12) + '...' : newName,
      isRunning: true 
    });

    setSessionLines(prev => ({
      ...prev,
      [activeTerminalId]: [...(prev[activeTerminalId] || []), {
        id: Date.now().toString(),
        type: 'input',
        content: `${currentCwd}> ${cmd}`,
        timestamp: new Date(),
      }]
    }));
    
    setInput('');

    // Command Interceptor
    if (cmd.startsWith('/save')) {
      const sessionName = cmd.split(' ').slice(1).join('_') || 'session';
      const timestamp = new Date().toLocaleString();
      
      // Use the latest lines including the /save command
      const latestLines = [...(sessionLines[activeTerminalId] || []), {
        id: Date.now().toString(),
        type: 'input' as const,
        content: `${currentCwd}> ${cmd}`,
        timestamp: new Date(),
      }];

      let markdown = `# AuraOS Terminal Session\n`;
      markdown += `**Date:** ${timestamp}\n`;
      markdown += `**CWD:** ${currentCwd}\n\n`;
      markdown += `---\n\n`;
      
      latestLines.forEach(line => {
        if (line.type === 'input') {
          markdown += `\n### > ${line.content.split('> ').pop()}\n`;
        } else if (line.type === 'error') {
          markdown += `\n> [!CAUTION]\n> **Error:** ${line.content}\n`;
        } else {
          markdown += line.content + '\n';
        }
      });

      try {
        const path = await invoke<string>('save_terminal_session', { 
          content: markdown, 
          name: sessionName 
        });
        
        setSessionLines(prev => ({
          ...prev,
          [activeTerminalId]: [...(prev[activeTerminalId] || []), {
            id: Date.now().toString(),
            type: 'output',
            content: `💾 Session saved to: ${path}`,
            timestamp: new Date(),
          }]
        }));
      } catch (error) {
        setSessionLines(prev => ({
          ...prev,
          [activeTerminalId]: [...(prev[activeTerminalId] || []), {
            id: Date.now().toString(),
            type: 'error',
            content: `Save Error: ${String(error)}`,
            timestamp: new Date(),
          }]
        }));
      }
      
      setInput('');
      return;
    }

    if (cmd.startsWith('/plugin add ') || cmd.startsWith('/plugin install ')) {
      const url = cmd.split(' ').pop() || '';
      const fullUrl = url.startsWith('http') ? url : `https://github.com/${url.replace('obsidian@', '')}`;
      
      try {
        updateTerminalSession(activeTerminalId, { isRunning: true });
        
        const result = await invoke<{ success: boolean; message: string; path: string }>('add_plugin', { 
          githubUrl: fullUrl 
        });
        
        let skillName = fullUrl.split('/').pop() || 'Unknown Skill';
        if (skillName.endsWith('.git')) skillName = skillName.slice(0, -4);

        if (result.success && result.path) {
          const { addAvailableSkill } = await import('@/lib/database');
          await addAvailableSkill(crypto.randomUUID(), skillName, result.path, fullUrl);
        }

        setSessionLines(prev => ({
          ...prev,
          [activeTerminalId]: [...(prev[activeTerminalId] || []), {
            id: Date.now().toString(),
            type: result.success ? 'output' : 'error',
            content: result.message,
            timestamp: new Date(),
          }]
        }));
      } catch (error) {
        setSessionLines(prev => ({
          ...prev,
          [activeTerminalId]: [...(prev[activeTerminalId] || []), {
            id: Date.now().toString(),
            type: 'error',
            content: `Plugin Error: ${String(error)}`,
            timestamp: new Date(),
          }]
        }));
      } finally {
        updateTerminalSession(activeTerminalId, { isRunning: false });
      }
      return;
    }

    try {
      await invoke('run_shell_command', {
        sessionId: activeTerminalId,
        command: cmd,
        cwd: currentCwd,
      });
      // We don't set isRunning = false here because the command might be long running (npm run dev)
      // The shell stays in "isRunning" mode until manually stopped or output indicates completion
      // For simplicity in this demo, simpler commands will just finish, and user can type again.
      // Real shells track process lifecycle. Here, we'll allow typing again if the shell is ready.
      // But for "dev" commands, it stays "running".
      if (!cmd.includes('npm') && !cmd.includes('dev') && !cmd.includes('watch') && !cmd.includes('serve')) {
        updateTerminalSession(activeTerminalId, { isRunning: false });
      }
    } catch (error) {
      updateTerminalSession(activeTerminalId, { isRunning: false });
      setSessionLines(prev => ({
        ...prev,
        [activeTerminalId]: [...(prev[activeTerminalId] || []), {
          id: (Date.now() + 1).toString(),
          type: 'error',
          content: `Shell Error: ${String(error)}`,
          timestamp: new Date(),
        }]
      }));
    }
  };

  const activeLines = activeTerminalId ? (sessionLines[activeTerminalId] || []) : [];

  return (
    <AnimatePresence mode="wait">
      {isOpen && mounted && (
        <motion.div
           key="bottom-terminal"
           initial={{ y: '100%', opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           exit={{ y: '100%', opacity: 0 }}
           transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 0.8 }}
           className="absolute bottom-0 left-0 right-0 h-1/4 min-h-[200px] bg-aura-black/95 border-t border-white/[0.08] backdrop-blur-xl z-20 flex flex-col"
        >
          {/* Tab Bar */}
          <div className="flex items-center px-2 bg-white/[0.02] border-b border-white/[0.06] shrink-0 overflow-x-auto no-scrollbar">
            {terminalSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setActiveTerminalId(session.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-white/[0.04] min-w-[120px] transition-all group",
                  activeTerminalId === session.id 
                    ? "bg-white/[0.06] text-aura-accent" 
                    : "text-aura-muted/60 hover:bg-white/[0.03] hover:text-white/80"
                )}
              >
                {session.isRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin text-aura-accent" />
                ) : (
                  <TerminalIcon className="w-3 h-3" />
                )}
                <span className="text-[11px] font-medium truncate flex-1">{session.name}</span>
                <button
                  onClick={(e) => handleCloseTerminal(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded transition-all"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            <button 
              onClick={handleNewTerminal}
              className="p-2 hover:bg-white/10 text-aura-muted/40 hover:text-aura-accent transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Output Area */}
          <div 
            ref={outputRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5"
          >
            {activeLines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  'whitespace-pre-wrap break-all',
                  line.type === 'input' && 'text-aura-accent mt-2',
                  line.type === 'output' && 'text-white/70',
                  line.type === 'error' && 'text-red-400 font-bold'
                )}
              >
                {line.content}
              </div>
            ))}
          </div>

          {/* Input & Control Bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-t border-white/[0.06] shrink-0 bg-white/[0.01]">
            <span className="text-[10px] text-aura-accent/60 font-mono shrink-0 truncate max-w-[40%]">
              {currentCwd ? `${currentCwd.split('\\').pop()}>` : '>'}
            </span>
            <form onSubmit={handleSubmit} className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeSession?.isRunning ? "Process running... (Ctrl+C to stop)" : "Run command..."}
                disabled={!currentCwd}
                className="w-full bg-transparent border-none outline-none text-xs text-white/80 placeholder:text-aura-muted/30 font-mono"
              />
            </form>
            
            {activeSession?.isRunning && (
              <button
                onClick={handleInterrupt}
                title="Stop process (Ctrl+C)"
                className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded border border-red-500/20 transition-all ml-2"
              >
                <Square className="w-3 h-3 fill-current" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Stop</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition-colors text-aura-muted/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}