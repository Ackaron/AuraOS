import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, Tag, Check, Zap, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useAuraStore, type Skill } from '@/stores';
import { cn } from '@/lib/utils';

interface SkillPanelProps {
  isCollapsed?: boolean;
}

export function SkillPanel({ isCollapsed = false }: SkillPanelProps) {
  const { skills, activateSkill } = useAuraStore();
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [lastActivated, setLastActivated] = useState<string | null>(null);

  const handleSkillClick = async (skill: Skill) => {
    if (expandedSkill === skill.id) {
      setExpandedSkill(null);
      return;
    }
    
    activateSkill(skill.id);
    setLastActivated(skill.id);
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('add_skill', {
        id: skill.id,
        name: skill.name,
        path: skill.path,
        tags: skill.tags,
      });
    } catch (error) {
      console.log('Skill selected:', skill.name);
    }
  };

  const activeSkill = skills.find(s => s.isActive);
  const showSuccess = activeSkill !== undefined && lastActivated === activeSkill.id;

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <Zap className="w-4 h-4 text-aura-accent" />
        <FolderOpen className="w-4 h-4 text-aura-muted" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 flex-1 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-aura-accent" />
          <span className="text-sm font-medium text-white/80 tracking-tight">
            Skill Core
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-aura-muted" />
        </motion.button>
      </div>

      <div className="space-y-2 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2"
            >
              <div className="glass rounded-lg p-3 bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                  </motion.div>
                  <span className="text-xs text-emerald-400 font-medium">
                    Skill loaded to context
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {skills.map((skill, index) => (
          <motion.div
            key={skill.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
              delay: index * 0.08,
            }}
            className="space-y-2"
          >
            <div
              onClick={() => handleSkillClick(skill)}
            className={cn(
                'glass rounded-xl p-4 cursor-pointer transition-all duration-200 group',
                skill.isActive
                  ? 'ring-1 ring-aura-accent/50 bg-aura-accent/5'
                  : 'hover:bg-white/[0.06] hover:border-white/[0.1]'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <motion.div 
                    className="flex items-center gap-2"
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-sm font-medium text-white truncate">
                      {skill.name}
                    </span>
                  </motion.div>
                  <div className="text-[11px] text-aura-muted/70 truncate mt-1 font-mono">
                    {skill.path}
                  </div>
                </div>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedSkill(expandedSkill === skill.id ? null : skill.id);
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <ChevronRight 
                    className={cn(
                      'w-4 h-4 text-aura-muted transition-transform',
                      expandedSkill === skill.id && 'rotate-90'
                    )} 
                  />
                </motion.button>
              </div>

              <p className="text-[11px] text-aura-muted/60 mt-2 line-clamp-1">
                {skill.description}
              </p>

              {skill.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {skill.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-white/5 rounded-full text-aura-muted/80 group-hover:text-aura-muted transition-colors"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <AnimatePresence>
              {expandedSkill === skill.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pl-2 space-y-1"
                >
                  {skill.methods.map((method, mIndex) => (
                    <motion.div
                      key={method.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: mIndex * 0.05 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer group"
                    >
                      <Zap className="w-3 h-3 text-aura-accent/60" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-white/80 block">
                          {method.name}
                        </span>
                        <span className="text-[10px] text-aura-muted/60">
                          {method.description}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-aura-accent/60 px-1.5 py-0.5 bg-aura-accent/10 rounded">
                        {method.command}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}