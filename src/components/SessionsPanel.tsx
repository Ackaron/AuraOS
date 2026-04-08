import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Trash2, ChevronDown, ChevronUp, MessageSquarePlus, FileText, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuraStore } from '@/stores';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';

interface SessionsPanelProps {
  isCollapsed?: boolean;
}

export function SessionsPanel({ isCollapsed = false }: SessionsPanelProps) {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    addSession,
    removeSession,
    currentTaskType,
    modelRouter,
    compactSession,
    isSkillCoreExpanded,
    setSkillCoreExpanded,
  } = useAuraStore();

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSessions = async () => {
      try {
        setLoading(true);
        const dbSessions = await invoke<Array<{
          id: string;
          model_id: string;
          created_at: string;
          transcript: string;
          compact_state: string;
        }>>('get_all_sessions');

        for (const s of dbSessions) {
          try {
            const transcript = JSON.parse(s.transcript || '[]');
            const compactState = JSON.parse(s.compact_state || '[]');
            
            addSession({
              sessionId: s.id,
              messages: transcript,
              compactHistory: compactState,
              totalTokens: 0,
              contextLimit: 64000,
            });
          } catch {
            addSession({
              sessionId: s.id,
              messages: [],
              compactHistory: [],
              totalTokens: 0,
              contextLimit: 64000,
            });
          }
        }
      } catch {
        console.log('No sessions loaded');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [addSession]);

  const handleSessionClick = (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
    } else {
      setExpandedSessionId(sessionId);
      setActiveSession(sessionId);
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('delete_session_state', { sessionId });
      removeSession(sessionId);
    } catch {
      console.error('Failed to delete session');
    }
  };

  const handleCompact = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('compact_session', { sessionId });
      compactSession(sessionId);
    } catch {
      console.error('Failed to compact session');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTaskLabel = (taskType: string) => {
    const labels: Record<string, string> = {
      logic: 'Logic',
      code: 'Code',
      docs: 'Docs',
      fast: 'Fast',
    };
    return labels[taskType] || taskType;
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-3">
        <Clock className="w-4 h-4 text-aura-accent" />
        <FileText className="w-4 h-4 text-aura-muted" />
        <MessageSquarePlus className="w-4 h-4 text-aura-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer group"
        onClick={() => setSkillCoreExpanded(!isSkillCoreExpanded)}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-aura-accent/80 group-hover:text-aura-accent transition-colors" />
          <span className="text-sm font-medium text-white/60 tracking-tight group-hover:text-white/90 transition-colors">
            Sessions
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-aura-muted/40">
            {sessions.length}
          </span>
          <div className="p-1 rounded-lg hover:bg-white/5 transition-colors">
            {isSkillCoreExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-aura-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-aura-muted" />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSkillCoreExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-4 h-4 rounded-full border border-aura-accent/30 border-t-aura-accent animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-4">
                  <Clock className="w-8 h-8 text-aura-muted/30 mx-auto mb-2" />
                  <p className="text-xs text-aura-muted/50">No sessions yet</p>
                  <p className="text-[10px] text-aura-muted/30 mt-1">
                    Start a conversation to create one
                  </p>
                </div>
              ) : (
                sessions.map((session, index) => {
                  const isExpanded = expandedSessionId === session.sessionId;
                  const isActive = activeSessionId === session.sessionId;
                  const lastMessage = session.messages[session.messages.length - 1];
                  const preview = lastMessage?.content?.slice(0, 60) || 'Empty session';

                  return (
                    <motion.div
                      key={session.sessionId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                        delay: index * 0.05,
                      }}
                      className={cn(
                        'mx-2 my-1 rounded-xl transition-all group',
                        isActive && 'ring-1 ring-aura-accent/30'
                      )}
                    >
                      <div
                        className="p-3 cursor-pointer hover:bg-white/[0.04] transition-all rounded-xl"
                        onClick={() => handleSessionClick(session.sessionId)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            {isActive ? (
                              <Zap className="w-3 h-3 text-aura-accent shrink-0 animate-pulse" />
                            ) : (
                              <FileText className="w-3 h-3 text-aura-muted/50 shrink-0" />
                            )}
                            <span className="text-xs font-medium text-white truncate">
                              {preview}
                              {(preview.length >= 58) && '...'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => handleCompact(session.sessionId, e)}
                              className="p-1 rounded text-aura-muted hover:text-amber-400 transition-colors"
                              title="Compact session"
                            >
                              <Zap className="w-3 h-3" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => handleDeleteSession(session.sessionId, e)}
                              className="p-1 rounded text-aura-muted hover:text-red-400 transition-colors"
                              title="Delete session"
                            >
                              <Trash2 className="w-3 h-3" />
                            </motion.button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-aura-muted/40 font-mono">
                              {formatDate(session.compactHistory[session.compactHistory.length - 1]?.timestamp || Date.now())}
                            </span>
                            <span className="text-[10px] text-aura-muted/30">·</span>
                            <span className="text-[10px] text-aura-muted/40 font-mono">
                              {session.messages.length} msgs
                            </span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-aura-muted/50 font-mono">
                            {session.totalTokens} tokens
                          </span>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden bg-white/[0.01] rounded-b-xl"
                          >
                            <div className="p-3 pt-0 border-t border-white/[0.04]">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-aura-muted/40">Task</span>
                                  <span className="text-aura-accent font-mono">
                                    {getTaskLabel(currentTaskType)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-aura-muted/40">Model</span>
                                  <span className="text-white/60 font-mono">
                                    {modelRouter[currentTaskType]}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-aura-muted/40">Context</span>
                                  <span className="text-white/60 font-mono">
                                    {Math.round((session.totalTokens / session.contextLimit) * 100)}%
                                  </span>
                                </div>
                                {session.compactHistory.length > 0 && (
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-aura-muted/40">Compacts</span>
                                    <span className="text-amber-400 font-mono">
                                      {session.compactHistory.length}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}