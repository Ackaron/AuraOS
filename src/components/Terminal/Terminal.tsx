import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Cpu, FolderOpen, Terminal as TerminalIcon } from 'lucide-react';
import { useAuraStore } from '@/stores';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: Date;
}

export function CommandTerminal() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { modelRouter, currentTaskType, activeProjectPath, projectContext } = useAuraStore();

  const detectTaskType = (text: string): 'logic' | 'code' | 'docs' | 'fast' => {
    const lower = text.toLowerCase();
    if (lower.startsWith('/logic') || lower.includes('why') || lower.includes('should') || lower.includes('analyze')) return 'logic';
    if (lower.startsWith('/code') || lower.includes('function') || lower.includes('implement') || lower.includes('fix')) return 'code';
    if (lower.startsWith('/docs') || lower.includes('explain') || lower.includes('document')) return 'docs';
    return 'fast';
  };

  const getActiveTaskType = () => {
    if (!input.trim()) return currentTaskType;
    return detectTaskType(input);
  };

  const activeTask = getActiveTaskType();

  const handleShellCommand = async (cmd: string): Promise<string> => {
    if (!activeProjectPath) {
      return 'No active project selected. Click a project in Workspace first.';
    }

    try {
      const output = await invoke<string>('run_shell_command', { 
        command: cmd, 
        cwd: activeProjectPath 
      });
      return output || 'Command executed with no output';
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  };

  const handleReadFile = async (filename: string): Promise<string> => {
    if (!activeProjectPath) {
      return 'No active project selected.';
    }

    const filePath = `${activeProjectPath}\\${filename}`;

    try {
      const content = await invoke<string>('read_file_content', { path: filePath });
      const truncated = content.length > 2000 ? content.substring(0, 2000) + '\n\n... (truncated)' : content;
      return `File: ${filename}\n\n${truncated}`;
    } catch (e) {
      return `Error reading file: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const taskType = detectTaskType(input);
    const selectedModel = modelRouter[taskType];

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      let response: string;

      if (input.startsWith('/read ')) {
        const filename = input.replace('/read ', '').trim();
        response = await handleReadFile(filename);
      } else if (input.startsWith('!')) {
        const cmd = input.substring(1).trim();
        response = await handleShellCommand(cmd);
      } else {
        response = await invoke<string>('run_inference', {
          model: selectedModel,
          prompt: input.replace(/^\/[\w]+\s*/, ''),
          activeProjectPath: activeProjectPath,
          projectContext: projectContext,
        });
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || `Model ${selectedModel} responded`,
        model: selectedModel,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Inference failed'}`,
        model: selectedModel,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }

    setIsProcessing(false);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="border-t border-white/[0.06] bg-gradient-to-t from-aura-surface/80 to-transparent backdrop-blur-xl">
      {activeProjectPath && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-white/5">
          <FolderOpen className="w-3.5 h-3.5 text-aura-accent" />
          <span className="text-[11px] text-aura-muted/70 font-mono truncate">
            {activeProjectPath}
          </span>
        </div>
      )}
      <div className="max-h-48 overflow-y-auto p-4 space-y-2">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                'flex gap-3 text-sm',
                msg.role === 'user' ? 'flex-row-reverse' : ''
              )}
            >
              <div
                className={cn(
                  'px-3 py-2 rounded-xl max-w-[80%] font-mono text-[13px]',
                  msg.role === 'user'
                    ? 'bg-aura-accent/20 text-aura-accent'
                    : msg.role === 'system'
                    ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20'
                    : 'bg-white/5 text-white/80'
                )}
              >
                {msg.content}
                {msg.model && msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-aura-muted/50">
                    <Cpu className="w-2.5 h-2.5" />
                    {msg.model}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-sm text-aura-muted"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </motion.div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pb-4">
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/5 rounded-lg">
          <TerminalIcon className="w-3.5 h-3.5 text-aura-accent" />
          <span className="text-[10px] text-aura-accent font-mono">{activeTask}</span>
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={activeProjectPath ? "Type command or ! for shell..." : "Select a project in Workspace first"}
          disabled={!activeProjectPath}
          className="flex-1 bg-transparent border-none outline-none text-sm text-white/80 placeholder:text-aura-muted/30 font-mono"
        />
        
        <motion.button
          type="submit"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isProcessing || !activeProjectPath}
          className="p-2 rounded-lg bg-aura-accent/20 text-aura-accent hover:bg-aura-accent/30 transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </form>
    </div>
  );
}