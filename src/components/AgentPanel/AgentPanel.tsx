import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Cpu, Bot, User, Shield, Square, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
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
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<{type: string, content: string, timestamp: Date}[]>([]);
  const [isLogExpanded, setIsLogExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { modelRouter, currentTaskType, activeProjectId, activeProjectPath } = useAuraStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const activeTask = currentTaskType;
  const activeModel = modelRouter[currentTaskType] || 'No model';

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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

  const handleStop = async () => {
    if (!agentSessionId) return;
    try {
      await invoke('stop_reactive_agent', { sessionId: agentSessionId });
      setProcessLogs(prev => [...prev, {
        type: 'system',
        content: '🛑 Termination signal sent...',
        timestamp: new Date()
      }]);
    } catch (e) {
      console.error('Failed to stop agent:', e);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;

    const sessionId = self.crypto.randomUUID();
    setAgentSessionId(sessionId);
    setProcessLogs([]);
    setIsLogExpanded(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const promptValue = input.trim();
    setInput('');
    setIsProcessing(true);

    try {
      const assistantId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);

      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<any>('agent-step', (event) => {
        const { type, content, tool, args, success, output } = event.payload;
        
        if (type === 'thought' || type === 'tool_start' || type === 'tool_result') {
           let logText = '';
           if (type === 'thought') logText = `🤔 ${content.replace(/```json[\s\S]*?```/g, '').trim()}`;
           if (type === 'tool_start') logText = `🔧 Executing ${tool}(${args || ''})...`;
           if (type === 'tool_result') logText = success ? `✅ ${tool} complete.` : `❌ ${tool} failed: ${output}`;
           
           if (logText) {
             setProcessLogs(prev => [...prev, {
               type,
               content: logText,
               timestamp: new Date()
             }]);
           }
        }

        setMessages((prev) => 
          prev.map(msg => {
            if (msg.id !== assistantId) return msg;
            
            let newContent = msg.content;
            if (type === 'tool_result' && tool === 'finish') {
                newContent = output || content;
            } else if (type === 'finish_step') {
                newContent = content;
            }
            
            return { ...msg, content: newContent };
          })
        );
      });

      const finalResult = await invoke<string>('run_reactive_agent', {
        prompt: promptValue,
        projectId: activeProjectId,
        sessionId: sessionId,
      });

      setMessages((prev) => 
        prev.map(msg => {
          if (msg.id === assistantId && !msg.content) {
            return { ...msg, content: finalResult };
          }
          return msg;
        })
      );

      unlisten();
    } catch (error) {
      if (error === 'cancelled') {
        setProcessLogs(prev => [...prev, { type: 'system', content: '🚫 Task cancelled by user.', timestamp: new Date() }]);
      } else {
        console.error('Agent Loop error:', error);
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Agent Error: ${String(error)}`,
          timestamp: new Date(),
        }]);
      }
    } finally {
      setIsProcessing(false);
      setAgentSessionId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-aura-accent/20 to-transparent border border-aura-accent/20 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-aura-accent/60" />
                  </div>
                  <p className="text-sm font-medium text-white/40">
                    Aura Engine Online
                  </p>
                  <p className="text-xs text-aura-muted/40 mt-1">
                    Ready for analysis and implementation
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
                      'flex gap-3 group',
                      msg.role === 'user' ? 'flex-row-reverse' : ''
                    )}
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/5',
                      msg.role === 'user' 
                        ? 'bg-aura-accent/10 border-aura-accent/20' 
                        : 'bg-white/[0.02]'
                    )}>
                      {msg.role === 'user' ? (
                        <User className="w-4 h-4 text-aura-accent" />
                      ) : (
                        <Bot className="w-4 h-4 text-aura-muted" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 max-w-[85%]">
                      <div
                        className={cn(
                          'px-3.5 py-2.5 rounded-2xl text-[11px] leading-relaxed font-mono relative',
                          msg.role === 'user'
                            ? 'bg-aura-accent/10 text-aura-accent border border-aura-accent/10 rounded-tr-none'
                            : msg.role === 'system'
                            ? 'bg-red-500/10 text-red-400/80 border border-red-500/20'
                            : 'bg-white/[0.03] text-white/90 border border-white/[0.06] rounded-tl-none'
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </div>
                        
                        {(msg.role === 'assistant' || msg.role === 'user') && msg.content && (
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-aura-muted opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                            title="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-aura-muted">
                      <Loader2 className="w-3 h-3 animate-spin text-aura-accent" />
                      <span className="font-medium">Synthesizing Implementation...</span>
                    </div>
                    <button 
                      onClick={() => setIsLogExpanded(!isLogExpanded)}
                      className="p-1 hover:bg-white/5 rounded-md transition-all"
                    >
                      {isLogExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {isLogExpanded && processLogs.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="bg-white/[0.01] border border-white/5 rounded-xl overflow-hidden"
                    >
                      <div className="max-h-52 overflow-y-auto p-2.5 space-y-2 font-mono text-[10px]">
                        {processLogs.map((log, i) => (
                          <div key={i} className="flex gap-2.5 text-aura-muted/60 animate-in fade-in slide-in-from-left-1 duration-300">
                            <span className="text-aura-accent/30 shrink-0 select-none">
                              {log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                            </span>
                            <span className="break-words leading-relaxed">{log.content}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/[0.06]">
              <div className="relative flex flex-col gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl p-2 transition-all focus-within:border-aura-accent/30 focus-within:bg-white/[0.05]">
                <textarea
                  ref={textAreaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeProjectPath ? "Describe the architecture or feature..." : "Select a project first"}
                  disabled={!activeProjectPath || isProcessing}
                  className="w-full bg-transparent border-none outline-none text-[11px] text-white/90 placeholder:text-aura-muted/30 font-mono resize-none py-1.5 px-2 custom-scrollbar"
                  style={{ maxHeight: '200px' }}
                />
                
                <div className="flex items-center justify-between px-2 pb-1">
                  <div className="text-[9px] text-aura-muted/40 font-mono uppercase tracking-wider">
                    {input.length > 0 && <span>{input.length} chars</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {isProcessing ? (
                      <button
                        type="button"
                        onClick={handleStop}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-400/20 transition-all group"
                        title="Stop execution"
                      >
                        <Square className="w-3.5 h-3.5 fill-current group-active:scale-90" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSubmit()}
                        disabled={!activeProjectPath || !input.trim()}
                        className="p-1.5 rounded-lg text-aura-accent hover:bg-aura-accent/20 transition-all disabled:opacity-20 group"
                        title="Send command"
                      >
                        <Send className="w-3.5 h-3.5 group-active:scale-90" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-center">
                <span className="text-[9px] text-aura-muted/30 font-mono">
                  Press Enter to send, Shift + Enter for new line
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
              <Shield className="w-3.5 h-3.5 text-red-500" />
              <span className="text-xs font-mono text-red-400/80">Analytic Terminal (Lvl 4)</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-[11px] bg-black/20">
              {terminalOutput.map((line, i) => (
                <div key={i} className={cn(
                  'whitespace-pre-wrap leading-relaxed',
                  line.startsWith('$') ? 'text-aura-accent/90' : 'text-white/60'
                )}>
                  {line}
                </div>
              ))}
            </div>
            <form onSubmit={handleTerminalSubmit} className="p-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 focus-within:border-aura-accent/30">
                <span className="text-xs text-aura-accent font-mono font-bold">$</span>
                <input
                  ref={terminalInputRef}
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder={activeProjectPath ? "Run administrative protocol..." : "Select a project first"}
                  disabled={!activeProjectPath}
                  className="flex-1 bg-transparent border-none outline-none text-xs text-white/90 placeholder:text-aura-muted/30 font-mono"
                />
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}