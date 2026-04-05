import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Loader2 } from 'lucide-react';
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
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const { activeProjectPath } = useAuraStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && mounted && activeProjectPath) {
      setLines([{
        id: 'welcome',
        type: 'output',
        content: `🔒 Admin Terminal initialized in: ${activeProjectPath}\nPress Enter to execute commands with elevated privileges.`,
        timestamp: new Date(),
      }]);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, mounted, activeProjectPath]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeProjectPath || isProcessing) return;

    const cmd = input.trim();
    setLines(prev => [...prev, {
      id: Date.now().toString(),
      type: 'input',
      content: `$ ${cmd}`,
      timestamp: new Date(),
    }]);
    setInput('');
    setIsProcessing(true);

    try {
      const result = await invoke<string>('run_admin_command', {
        command: cmd,
        cwd: activeProjectPath,
      });
      
      setLines(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: result.trim() ? 'output' : 'output',
        content: result || 'Command completed.',
        timestamp: new Date(),
      }]);
    } catch (error) {
      setLines(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    }

    setIsProcessing(false);
    inputRef.current?.focus();
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && mounted && (
        <motion.div
          key="bottom-terminal"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ 
            type: 'spring', 
            stiffness: 300, 
            damping: 28,
            mass: 0.8
          }}
          className="absolute bottom-0 left-0 right-0 h-1/4 min-h-[150px] bg-black/95 border-t border-white/[0.08] backdrop-blur-xl z-20 flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-mono text-red-400/80">Admin Terminal (Elevated)</span>
              <span className="text-[10px] text-aura-muted/50 ml-2">
                Ctrl+` to toggle
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-aura-muted/60" />
            </button>
          </div>

          <div 
            ref={outputRef}
            className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1"
          >
            {lines.map((line) => (
              <div
                key={line.id}
                className={cn(
                  'whitespace-pre-wrap break-all',
                  line.type === 'input' && 'text-aura-accent',
                  line.type === 'output' && 'text-white/70',
                  line.type === 'error' && 'text-red-400'
                )}
              >
                {line.content}
              </div>
            ))}
            {isProcessing && (
              <div className="flex items-center gap-2 text-aura-muted/60">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Executing...</span>
              </div>
            )}
          </div>

          <form 
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 border-t border-white/[0.06] shrink-0"
          >
            <span className="text-xs text-aura-accent font-mono">$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeProjectPath ? "Run admin command..." : "Select a project first"}
              disabled={!activeProjectPath || isProcessing}
              className="flex-1 bg-transparent border-none outline-none text-xs text-white/80 placeholder:text-aura-muted/30 font-mono"
            />
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}