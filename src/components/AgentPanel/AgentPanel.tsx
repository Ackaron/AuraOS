import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Cpu, Bot, User, Shield } from 'lucide-react';
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

export function AgentPanel() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { modelRouter, currentTaskType, activeProjectPath, projectContext } = useAuraStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeTask = currentTaskType;
  const activeModel = modelRouter[currentTaskType] || 'No model';

  const handleTerminalCommand = async (cmd: string): Promise<string> => {
    if (!activeProjectPath) {
      return 'No active project selected. Click a project in Workspace first.';
    }

    try {
      const result = await invoke<string>('run_admin_command', {
        command: cmd,
        cwd: activeProjectPath,
      });
      return result;
    } catch (e) {
      return `Error: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }
  };

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim() || !activeProjectPath) return;

    const cmd = terminalInput.trim();
    setTerminalOutput(prev => [...prev, `$ ${cmd}`]);
    setTerminalInput('');

    try {
      const result = await handleTerminalCommand(cmd);
      setTerminalOutput(prev => [...prev, result]);
    } catch (error) {
      setTerminalOutput(prev => [...prev, `Error: ${error}`]);
    }
  };

  const detectTaskType = (text: string): 'logic' | 'code' | 'docs' | 'fast' => {
    const lower = text.toLowerCase();
    if (lower.startsWith('/logic') || lower.includes('why') || lower.includes('should') || lower.includes('analyze')) return 'logic';
    if (lower.startsWith('/code') || lower.includes('function') || lower.includes('implement') || lower.includes('fix')) return 'code';
    if (lower.startsWith('/docs') || lower.includes('explain') || lower.includes('document')) return 'docs';
    return 'fast';
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
      const response = await invoke<string>('run_inference', {
        model: selectedModel,
        prompt: input.replace(/^\/[\w]+\s*/, ''),
        activeProjectPath: activeProjectPath,
        projectContext: projectContext,
      });

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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-aura-accent" />
            <span className="text-sm font-medium text-white">Agent</span>
          </div>
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors',
              showTerminal 
                ? 'bg-aura-accent/20 text-aura-accent' 
                : 'text-aura-muted/60 hover:text-white/80 hover:bg-white/[0.05]'
            )}
          >
            <Shield className="w-3 h-3" />
            <span>Admin</span>
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-aura-muted/50">
          <Cpu className="w-2.5 h-2.5" />
          <span>{activeModel}</span>
          <span className="mx-1">•</span>
          <span className="uppercase">{activeTask}</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {!showTerminal ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-aura-accent/20 to-transparent border border-aura-accent/20 flex items-center justify-center mb-3">
                    <Bot className="w-6 h-6 text-aura-accent/60" />
                  </div>
                  <p className="text-xs text-aura-muted/60">
                    Start a conversation
                  </p>
                </div>
              )}
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'flex gap-2',
                      msg.role === 'user' ? 'flex-row-reverse' : ''
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
                      msg.role === 'user' 
                        ? 'bg-aura-accent/20' 
                        : 'bg-white/[0.05]'
                    )}>
                      {msg.role === 'user' ? (
                        <User className="w-3.5 h-3.5 text-aura-accent" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-aura-muted" />
                      )}
                    </div>
                    <div
                      className={cn(
                        'px-3 py-2 rounded-xl max-w-[85%] text-xs font-mono',
                        msg.role === 'user'
                          ? 'bg-aura-accent/20 text-aura-accent'
                          : msg.role === 'system'
                          ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20'
                          : 'bg-white/5 text-white/80'
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 text-xs text-aura-muted"
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Processing...</span>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={activeProjectPath ? "Ask the agent..." : "Select a project first"}
                  disabled={!activeProjectPath || isProcessing}
                  className="flex-1 bg-transparent border-none outline-none text-xs text-white/80 placeholder:text-aura-muted/30 font-mono"
                />
                <button
                  type="submit"
                  disabled={isProcessing || !activeProjectPath}
                  className="p-1.5 rounded-lg text-aura-accent hover:bg-aura-accent/20 transition-colors disabled:opacity-30"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
              <Shield className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-mono text-red-400/80">Admin Terminal (Elevated)</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[11px]">
              {terminalOutput.map((line, i) => (
                <div key={i} className={cn(
                  'whitespace-pre-wrap',
                  line.startsWith('$') ? 'text-aura-accent' : 'text-white/60'
                )}>
                  {line}
                </div>
              ))}
            </div>
            <form onSubmit={handleTerminalSubmit} className="p-3 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-2">
                <span className="text-xs text-aura-accent font-mono">$</span>
                <input
                  ref={terminalInputRef}
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder={activeProjectPath ? "Run admin command..." : "Select a project first"}
                  disabled={!activeProjectPath}
                  className="flex-1 bg-transparent border-none outline-none text-xs text-white/80 placeholder:text-aura-muted/30 font-mono"
                />
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}