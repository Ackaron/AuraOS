import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Code, FileText, Zap, ChevronDown, ChevronUp, Check, Settings } from 'lucide-react';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuraStore, type TaskType } from '@/stores';
import { cn } from '@/lib/utils';

const roleConfig: { type: TaskType; label: string; icon: typeof Brain; color: string }[] = [
  { type: 'logic', label: 'Logic', icon: Brain, color: 'text-purple-400' },
  { type: 'code', label: 'Code', icon: Code, color: 'text-blue-400' },
  { type: 'docs', label: 'Docs', icon: FileText, color: 'text-green-400' },
  { type: 'fast', label: 'Fast', icon: Zap, color: 'text-amber-400' },
];

interface DropdownPortalProps {
  buttonRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  onClose: () => void;
}

function DropdownPortal({ buttonRef, children }: DropdownPortalProps) {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useLayoutEffect(() => {
    const updateCoords = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };

    updateCoords();
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [buttonRef]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="fixed bg-black/90 rounded-lg border border-white/10 shadow-2xl z-[99999] overflow-hidden"
      style={{ 
        top: coords.top + 4,
        left: coords.left,
        width: coords.width,
        minWidth: '180px'
      }}
    >
      {children}
    </motion.div>,
    document.body
  );
}

interface ModelRouterPanelProps {
  isCollapsed?: boolean;
}

export function ModelRouterPanel({ isCollapsed = false }: ModelRouterPanelProps) {
  const { 
    modelRouter, 
    currentTaskType, 
    availableModels, 
    setModelForTask, 
    setCurrentTaskType,
    isModelRouterExpanded,
    setModelRouterExpanded,
    activeSessionContextUsage,
    modelContextLimits
  } = useAuraStore();
  const [openDropdown, setOpenDropdown] = useState<TaskType | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const allModels = availableModels.length > 0 
    ? availableModels 
    : ['deepseek-r1:8b', 'qwen2.5:14b', 'llama3.1:70b', 'phi4:latest'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-3">
        <Settings className="w-4 h-4 text-aura-accent" />
        {roleConfig.map((role) => {
          const Icon = role.icon;
          return <Icon key={role.type} className={cn('w-4 h-4', role.color)} />;
        })}
      </div>
    );
  }

  return (
    <div className="px-4 py-2 space-y-4" ref={containerRef}>
      <div 
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setModelRouterExpanded(!isModelRouterExpanded)}
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-aura-accent/80 group-hover:text-aura-accent transition-colors" />
          <span className="text-sm font-medium text-white/60 tracking-tight group-hover:text-white/90 transition-colors">
            Model Router
          </span>
        </div>
        <div className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
          {isModelRouterExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-aura-muted" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-aura-muted" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModelRouterExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {roleConfig.map((role, index) => {
              const Icon = role.icon;
              const selectedModel = modelRouter[role.type as TaskType];
              const isActive = currentTaskType === role.type;
              const isDropdownOpen = openDropdown === role.type;

              return (
                <motion.div
                  key={role.type}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  ref={el => { buttonRefs.current[role.type] = el; }}
                  className={cn(
                    'relative glass rounded-xl transition-all duration-200',
                    isActive && 'ring-1 ring-aura-accent/30 bg-aura-accent/5'
                  )}
                >
                  <div 
                    onClick={() => setCurrentTaskType(role.type)}
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.02] rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('p-1.5 rounded-lg bg-white/5', role.color)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-medium text-white/80">{role.label}</span>
                        <span className="text-[10px] text-aura-muted/50 ml-2">→</span>
                        <span className="text-[10px] font-mono text-aura-accent ml-1">
                          {selectedModel}
                        </span>
                      </div>
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdown(isDropdownOpen ? null : role.type);
                      }}
                      className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <ChevronDown className={cn('w-3 h-3 text-aura-muted transition-transform', isDropdownOpen && 'rotate-180')} />
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <DropdownPortal 
                        buttonRef={{ current: buttonRefs.current[role.type] }}
                        onClose={() => setOpenDropdown(null)}
                      >
                        <div className="p-1 max-h-40 overflow-y-auto custom-scrollbar">
                          {allModels.map((model) => (
                            <button
                              key={model}
                              onClick={() => {
                                setModelForTask(role.type, model);
                                setOpenDropdown(null);
                              }}
                              className={cn(
                                'w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors',
                                selectedModel === model 
                                  ? 'bg-aura-accent/20 text-aura-accent' 
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              )}
                            >
                              <span className="font-mono text-[10px]">{model}</span>
                              {selectedModel === model && (
                                <Check className="w-3 h-3" />
                              )}
                            </button>
                          ))}
                        </div>
                      </DropdownPortal>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            <div className="flex flex-col gap-2 pt-2 border-t border-white/5 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-aura-accent animate-pulse" />
                  <span className="text-[10px] text-aura-muted/80">
                    Active: {roleConfig.find(r => r.type === currentTaskType)?.label}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-aura-muted/60">
                   {((activeSessionContextUsage / (modelContextLimits[modelRouter[currentTaskType]] || 256000)) * 100).toFixed(1)}% Context
                </span>
              </div>
              
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                 <motion.div 
                   className="h-full bg-aura-accent shadow-[0_0_8px_rgba(45,212,191,0.4)]"
                   initial={{ width: 0 }}
                   animate={{ 
                     width: `${Math.min(100, (activeSessionContextUsage / (modelContextLimits[modelRouter[currentTaskType]] || 256000)) * 100)}%` 
                   }}
                   transition={{ duration: 0.5 }}
                 />
              </div>
              <div className="flex justify-between text-[8px] text-aura-muted/40 font-mono">
                <span>{activeSessionContextUsage.toLocaleString()} chars</span>
                <span>Limit: {(modelContextLimits[modelRouter[currentTaskType]] || 256000).toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
