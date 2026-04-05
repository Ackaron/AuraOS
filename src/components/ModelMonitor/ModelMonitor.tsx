import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, HardDrive, MemoryStick, Zap, ChevronDown, ChevronRight, CpuIcon } from 'lucide-react';
import { useAuraStore } from '@/stores';
import { cn } from '@/lib/utils';

interface ModelMonitorProps {
  isCollapsed?: boolean;
}

export function ModelMonitor({ isCollapsed = false }: ModelMonitorProps) {
  const { systemStats, isOllamaConnected, availableModels, models } = useAuraStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const vramPercent = (systemStats.vramUsed / systemStats.vramTotal) * 100;
  const ramPercent = (systemStats.ramUsed / systemStats.ramTotal) * 100;

  const allModels = [...models, ...availableModels.map(name => ({ name, provider: 'ollama' as const, vramUsage: 0, isActive: false }))];
  const uniqueModels = Array.from(new Map(allModels.map(m => [m.name, m])).values());

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <motion.div
          animate={{ 
            boxShadow: isOllamaConnected 
              ? '0 0 8px rgba(20, 184, 166, 0.5)' 
              : '0 0 0px rgba(239, 68, 68, 0.5)'
          }}
          transition={{ duration: 1, repeat: Infinity }}
          className={cn(
            'w-3 h-3 rounded-full',
            isOllamaConnected ? 'bg-emerald-400' : 'bg-red-400'
          )}
        />
        <Zap className="w-4 h-4 text-aura-accent" />
        <HardDrive className="w-4 h-4 text-aura-muted" />
        <MemoryStick className="w-4 h-4 text-aura-muted" />
        <Cpu className="w-4 h-4 text-aura-muted" />
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ 
              boxShadow: isOllamaConnected 
                ? '0 0 8px rgba(20, 184, 166, 0.5)' 
                : '0 0 0px rgba(239, 68, 68, 0.5)'
            }}
            transition={{ duration: 1, repeat: Infinity }}
            className={cn(
              'w-2 h-2 rounded-full',
              isOllamaConnected ? 'bg-emerald-400' : 'bg-red-400'
            )}
          />
          <span className="text-sm font-medium text-white/80 tracking-tight">
            System Monitor
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-aura-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-aura-muted" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3 h-3 text-aura-accent" />
              <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                GPU — RTX 5080
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-aura-muted">VRAM</span>
                <span className="text-xs font-mono text-white">
                  {systemStats.vramUsed.toFixed(1)}/{systemStats.vramTotal.toFixed(1)} GB
                </span>
              </div>
              
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${vramPercent}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-to-r from-aura-accent to-cyan-400 rounded-full"
                />
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <MemoryStick className="w-3 h-3 text-aura-accent" />
              <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                RAM — 64GB
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-aura-muted">System</span>
                <span className="text-xs font-mono text-white">
                  {systemStats.ramUsed.toFixed(1)}/{systemStats.ramTotal.toFixed(0)} GB
                </span>
              </div>
              
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${ramPercent}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                />
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-3 h-3 text-aura-accent" />
              <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                CPU — 9950x3d
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-aura-muted">Usage</span>
                <span className="text-xs font-mono text-white">{systemStats.cpuUsage}%</span>
              </div>
              
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${systemStats.cpuUsage}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                />
              </div>
            </div>
          </div>

          {uniqueModels.length > 0 && (
            <div className="glass rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <CpuIcon className="w-3 h-3 text-aura-accent" />
                <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                  Ollama Models
                </span>
                <span className="text-[10px] text-aura-muted/50">({uniqueModels.length})</span>
              </div>
              
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {uniqueModels.map((model) => (
                  <div 
                    key={model.name}
                    className="flex items-center justify-between text-[10px] py-1 px-2 rounded hover:bg-white/5"
                  >
                    <span className="font-mono text-white/70 truncate flex-1">
                      {model.name}
                    </span>
                    <span className="text-aura-muted/50 ml-2">
                      {model.isActive ? '●' : '○'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}