import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Users, Zap } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuraStore } from '@/stores';
import { cn } from '@/lib/utils';

interface ModelRouterPanelProps {
  isCollapsed?: boolean;
}

export function ModelRouterPanel({ isCollapsed = false }: ModelRouterPanelProps) {
  const {
    discoveredAgents,
    modelRouter,
    currentTaskType,
    setCurrentTaskType,
    setModelForTask,
    availableModels
  } = useAuraStore();

  const [expanded, setExpanded] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleModelSelect = (agentName: string, modelName: string) => {
    setModelForTask(agentName, modelName);
  };

  const getAgentModel = (agentName: string) => {
    return modelRouter[agentName] || availableModels[0] || 'qwen2.5:14b';
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-3">
        <Users className="w-4 h-4 text-aura-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-aura-accent/80 group-hover:text-aura-accent transition-colors" />
          <span className="text-sm font-medium text-white/60 tracking-tight group-hover:text-white/90 transition-colors">
            Roles
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-aura-muted/40">
            {discoveredAgents.length}
          </span>
          <div className="p-1 rounded-lg hover:bg-white/5 transition-colors">
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-aura-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-aura-muted" />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {discoveredAgents.length === 0 ? (
                <div className="text-center py-4">
                  <Users className="w-8 h-8 text-aura-muted/30 mx-auto mb-2" />
                  <p className="text-xs text-aura-muted/50">No roles found</p>
                  <p className="text-[10px] text-aura-muted/30 mt-1">
                    Add agents to .claude/agents/
                  </p>
                </div>
              ) : (
                discoveredAgents.map((agent, index) => {
                  const isActive = currentTaskType === agent.name;
                  const model = getAgentModel(agent.name);

                  return (
                    <motion.div
                      key={agent.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                        delay: index * 0.05,
                      }}
                      className={cn(
                        'mx-1 my-1 rounded-xl transition-all cursor-pointer',
                        isActive 
                          ? 'bg-aura-accent/10 ring-1 ring-aura-accent/30' 
                          : 'hover:bg-white/5'
                      )}
                      onClick={() => setCurrentTaskType(agent.name)}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className={cn(
                              'w-3.5 h-3.5',
                              isActive ? 'text-aura-accent' : 'text-aura-muted/50'
                            )} />
                            <span className="text-xs font-medium text-white">
                              {agent.role || agent.name}
                            </span>
                          </div>
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-aura-accent animate-pulse" />
                          )}
                        </div>
                        
                        <p className="text-[10px] text-aura-muted/50 mt-1.5 line-clamp-2">
                          {agent.description || 'No description'}
                        </p>

                        {availableModels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {availableModels.slice(0, 3).map(m => (
                              <button
                                key={m}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleModelSelect(agent.name, m);
                                }}
                                className={cn(
                                  'text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors',
                                  m === model 
                                    ? 'bg-aura-accent/20 text-aura-accent' 
                                    : 'bg-white/5 text-aura-muted/60 hover:text-white/80'
                                )}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
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