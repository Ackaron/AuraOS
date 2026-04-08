import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Plus, Square, Terminal as TerminalIcon } from 'lucide-react';
import { useAuraStore } from '@/stores';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

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

  const [mounted, setMounted] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRefs = useRef<Record<string, (() => void)[]>>({});

  const activeSession = useMemo(() => 
    terminalSessions.find(s => s.id === activeTerminalId),
    [terminalSessions, activeTerminalId]
  );

  const currentCwd = activeSession?.cwd || terminalCwd || activeProjectPath;

  const initTerminal = useCallback(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#22c55e',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#22c55e40',
        black: '#0a0a0a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e5e5',
        brightBlack: '#737373',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      fontSize: 12,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.writeln('\x1b[36m🔒 AuraOS Terminal\x1b[0m');
    terminal.writeln(`Location: ${currentCwd || 'C:\\'}`);
    terminal.writeln('');
    terminal.write('\x1b[32m❯\x1b[0m ');

    terminal.onData((data) => {
      if (!activeTerminalId) return;
      
      if (data === '\r') {
        terminal.writeln('');
      } else if (data === '\x03') {
        handleInterrupt();
      } else {
        terminal.write(data);
      }
    });
  }, [activeTerminalId, currentCwd]);

  const handleNewTerminal = useCallback(async () => {
    const cwd = activeProjectPath || 'C:\\';
    const id = addTerminalSession(cwd, 'Shell');
    try {
      await invoke('create_terminal_session', { id, cwd });
    } catch (_e) {
      console.error(_e);
    }
  }, [activeProjectPath, addTerminalSession]);

  const handleCloseTerminal = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await invoke('close_terminal_session', { id });
    removeTerminalSession(id);
  };

  const handleInterrupt = async () => {
    if (!activeTerminalId) return;
    try {
      await invoke('interrupt_terminal_session', { id: activeTerminalId });
      updateTerminalSession(activeTerminalId, { isRunning: false });
    } catch {
      console.error('Interrupt failed');
    }
  };

  useEffect(() => {
    setMounted(true);
    if (terminalSessions.length === 0 && activeProjectPath) {
      handleNewTerminal();
    }
  }, [activeProjectPath, terminalSessions.length, handleNewTerminal]);

  useEffect(() => {
    if (isOpen && mounted && !xtermRef.current) {
      setTimeout(initTerminal, 100);
    }
  }, [isOpen, mounted, initTerminal]);

  useEffect(() => {
    if (!isOpen || !activeTerminalId) return;

    const setupListeners = async () => {
      if (unlistenRefs.current[activeTerminalId]) return;
      
      const { listen } = await import('@tauri-apps/api/event');
      
      const un1 = await listen<string>(`terminal-data-${activeTerminalId}`, (event) => {
        if (xtermRef.current) {
          xtermRef.current.write(event.payload.replace(/\n/g, '\r\n'));
        }
      });

      const un2 = await listen<string>(`terminal-error-${activeTerminalId}`, (event) => {
        if (xtermRef.current) {
          xtermRef.current.write(`\r\x1b[31m${event.payload}\x1b[0m\r\n`);
        }
      });

      unlistenRefs.current[activeTerminalId] = [un1, un2];
    };

    setupListeners();

    return () => {
      if (unlistenRefs.current[activeTerminalId]) {
        unlistenRefs.current[activeTerminalId].forEach(u => u());
        delete unlistenRefs.current[activeTerminalId];
      }
    };
  }, [isOpen, activeTerminalId]);

  useEffect(() => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [isOpen, activeTerminalId]);

  const handleResize = useCallback(() => {
    if (fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && mounted && (
        <motion.div
          key="bottom-terminal"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 0.8 }}
          className="absolute bottom-0 left-0 right-0 h-1/4 min-h-[200px] bg-[#0a0a0a] border-t border-white/[0.08] backdrop-blur-xl z-20 flex flex-col"
        >
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

          <div className="flex-1 relative" ref={terminalRef} />

          <div className="flex items-center gap-2 px-4 py-2 border-t border-white/[0.06] shrink-0 bg-white/[0.01]">
            <span className="text-[10px] text-aura-accent/60 font-mono shrink-0 truncate max-w-[40%]">
              {currentCwd ? `${currentCwd.split('\\').pop()}> ` : '> '}
            </span>
            
            {activeSession?.isRunning && (
              <button
                onClick={handleInterrupt}
                className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded border border-red-500/20 transition-all ml-2"
              >
                <Square className="w-3 h-3 fill-current" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Stop</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition-colors text-aura-muted/40 ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}