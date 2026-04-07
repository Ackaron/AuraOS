import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Code, FileText, Zap, ChevronDown, ChevronUp, Check, Settings } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuraStore, type TaskType } from '@/stores';
import { cn } from '@/lib/utils';

const roleConfig: { type: TaskType; label: string; icon: typeof Brain; color: string }[] = [
  { type: 'logic', label: 'Logic', icon: Brain, color: 'text-purple-400' },
  { type: 'code', label: 'Code', icon: Code, color: 'text-blue-400' },
  { type: 'docs', label: 'Docs', icon: FileText, color: 'text-green-400' },
  { type: 'fast', label: 'Fast', icon: Zap, color: 'text-amber-400' },
];

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
    setModelRouterExpanded
  } = useAuraStore();
  const [openDropdown, setOpenDropdown] = useState<TaskType | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allModels = availableModels.length > 0 
    ? availableModels 
    : ['deepseek-r1:8b', 'qwen2.5:14b', 'llama3.1:70b', 'phi4:latest'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
    <div className="px-4 py-2 space-y-4">
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
            className="space-y-2 overflow-hidden"
            ref={dropdownRef}
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
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-0 right-0 mb-1 bg-black/90 rounded-lg border border-white/10 shadow-xl z-[9999] overflow-hidden"
                        style={{ minWidth: '200px' }}
                      >
                        <div className="p-1 max-h-40 overflow-y-auto">
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
                              <span className="font-mono">{model}</span>
                              {selectedModel === model && (
                                <Check className="w-3 h-3" />
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            <div className="flex items-center gap-2 pt-2">
              <div className="w-2 h-2 rounded-full bg-aura-accent animate-pulse" />
              <span className="text-[10px] text-aura-muted/60">
                Active: {roleConfig.find(r => r.type === currentTaskType)?.label}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}