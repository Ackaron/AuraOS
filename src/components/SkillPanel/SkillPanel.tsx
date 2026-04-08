import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, Zap, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useAuraStore } from '@/stores';
import { cn } from '@/lib/utils';

interface SkillPanelProps {
  isCollapsed?: boolean;
}

export function SkillPanel({ isCollapsed = false }: SkillPanelProps) {
  const { 
    activeProjectId,
    isSkillCoreExpanded,
    setSkillCoreExpanded
  } = useAuraStore();
  const [installedSkills, setInstalledSkills] = useState<{ id: string; name: string; path: string; github_url: string | null }[]>([]);
  const [activeSkillIds, setActiveSkillIds] = useState<Set<string>>(new Set());
  
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [newSkillUrl, setNewSkillUrl] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);

  // Load skills
  const loadSkills = useCallback(async () => {
    try {
      const { getAvailableSkills, getProjectSkills } = await import('@/lib/database');
      const skills = await getAvailableSkills();
      setInstalledSkills(skills);

      if (activeProjectId) {
        const pSkills = await getProjectSkills(activeProjectId);
        setActiveSkillIds(new Set(pSkills.filter(s => s.is_active).map(s => s.skill_id)));
      } else {
        setActiveSkillIds(new Set());
      }
    } catch (_e) {
      console.error('Failed to load skills:', _e);
    }
  }, [activeProjectId]);

  useEffect(() => {
    loadSkills();
    const interval = setInterval(loadSkills, 2000);
    return () => clearInterval(interval);
  }, [loadSkills]);

  const handleToggleSkill = async (skillId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProjectId) return;
    
    const isCurrentlyActive = activeSkillIds.has(skillId);
    const newState = !isCurrentlyActive;
    
    try {
      const { toggleProjectSkill } = await import('@/lib/database');
      await toggleProjectSkill(activeProjectId, skillId, newState);
      
      setActiveSkillIds(prev => {
        const next = new Set(prev);
        if (newState) next.add(skillId);
        else next.delete(skillId);
        return next;
      });
      
      if (newState) {
        const skill = installedSkills.find(s => s.id === skillId);
        if (skill) {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('add_skill', {
            id: skill.id,
            name: skill.name,
            path: skill.path,
            tags: [],
          }).catch(console.warn);
        }
      }
    } catch (error) {
      console.error('Failed to toggle skill:', error);
    }
  };

  const handleDeleteSkill = async (skillId: string, path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_skill_folder', { path });
      
      const { deleteAvailableSkill } = await import('@/lib/database');
      await deleteAvailableSkill(skillId);
      
      loadSkills();
    } catch (error) {
      console.error('Failed to delete skill:', error);
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-3">
        <Zap className="w-4 h-4 text-aura-accent" />
        <FolderOpen className="w-4 h-4 text-aura-muted" />
      </div>
    );
  }

  return (
    <div className="px-4 py-2 space-y-4 flex flex-col">
      <div 
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setSkillCoreExpanded(!isSkillCoreExpanded)}
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-aura-accent/80 group-hover:text-aura-accent transition-colors" />
          <span className="text-sm font-medium text-white/60 tracking-tight group-hover:text-white/90 transition-colors">
            Skill Core
          </span>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsAddingSkill(!isAddingSkill);
              setInstallError(null);
              setNewSkillUrl('');
            }}
            className={cn(
              "p-1 rounded-lg transition-colors",
              isAddingSkill ? "bg-aura-accent/20 text-aura-accent" : "bg-white/5 hover:bg-white/10 text-aura-muted"
            )}
          >
            <Plus className={cn("w-3.5 h-3.5 transition-transform", isAddingSkill && "rotate-45")} />
          </motion.button>
          
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
            className="space-y-4 overflow-hidden"
          >
            {/* Add Skill Form */}
            <AnimatePresence>
              {isAddingSkill && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newSkillUrl || isInstalling) return;
                      
                      setIsInstalling(true);
                      setInstallError(null);
                      
                      try {
                        const url = newSkillUrl.trim();
                        const fullUrl = url.startsWith('http') ? url : `https://github.com/${url.replace('obsidian@', '')}`;
                        
                        const { invoke } = await import('@tauri-apps/api/core');
                        const result = await invoke<{ id: string; name: string; path: string; tags: string[]; is_indexed: boolean; source_url: string | null; version: string | null }>('clone_skill_from_github', { 
                          url: fullUrl,
                          branch: null
                        });
                        
                        if (result && result.id) {
                          const { addAvailableSkill } = await import('@/lib/database');
                          await addAvailableSkill(result.id, result.name, result.path, result.source_url || undefined);
                          await loadSkills();
                          setIsAddingSkill(false);
                          setNewSkillUrl('');
                        }
                      } catch (err) {
                        setInstallError(String(err));
                      } finally {
                        setIsInstalling(false);
                      }
                    }}
                    className="flex flex-col gap-2 p-3 glass rounded-xl bg-white/[0.02]"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="github.com/user/repo"
                      value={newSkillUrl}
                      onChange={(e) => setNewSkillUrl(e.target.value)}
                      disabled={isInstalling}
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aura-accent/50"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-red-400 max-w-[150px] truncate">
                        {installError}
                      </span>
                      <button
                        type="submit"
                        disabled={isInstalling || !newSkillUrl}
                        className="px-3 py-1 bg-aura-accent/20 hover:bg-aura-accent/30 text-aura-accent disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] font-medium transition-colors"
                      >
                        {isInstalling ? 'Installing...' : 'Install Skill'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2 pb-2">
              {installedSkills.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-aura-muted/50">No skills installed.</p>
                </div>
              ) : (
                installedSkills.map((skill, index) => {
                  const isActive = activeSkillIds.has(skill.id);
                  
                  return (
                    <motion.div
                      key={skill.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'glass rounded-xl p-3 cursor-pointer transition-all duration-200 group relative',
                        isActive
                          ? 'ring-1 ring-aura-accent/30 bg-aura-accent/5'
                          : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <span className="text-sm font-medium text-white/90 block truncate">
                            {skill.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div 
                            onClick={(e) => handleToggleSkill(skill.id, e)}
                            className={cn(
                              "w-7 h-3.5 rounded-full flex items-center transition-all px-0.5 relative",
                              isActive ? "bg-aura-accent/40" : "bg-white/10",
                              !activeProjectId && "opacity-30 cursor-not-allowed"
                            )}
                          >
                            <motion.div 
                              layout 
                              animate={{ x: isActive ? 12 : 0 }}
                              className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" 
                            />
                          </div>
                          
                          <motion.button
                            onClick={(e) => handleDeleteSkill(skill.id, skill.path, e)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-1 rounded text-aura-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </motion.button>
                        </div>
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