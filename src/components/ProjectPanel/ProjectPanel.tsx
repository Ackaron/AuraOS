import { motion, AnimatePresence } from 'framer-motion';
import { FolderKanban, Play, Pause, CheckCircle2, Plus, Trash2, FolderOpen, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useAuraStore, type FileNode } from '@/stores';
import { cn } from '@/lib/utils';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { getProjects, saveProject, deleteProject as deleteProjectDB } from '@/lib/database';
import { invoke } from '@tauri-apps/api/core';
import { FileTree } from '@/components/FileTree/FileTree';

const statusColors = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const statusIcons = {
  active: Play,
  paused: Pause,
  completed: CheckCircle2,
};

interface ProjectPanelProps {
  onFileDoubleClick?: (path: string) => void;
  isCollapsed?: boolean;
}

export function ProjectPanel({ onFileDoubleClick, isCollapsed = false }: ProjectPanelProps) {
  const { 
    projects, 
    addProject, 
    removeProject, 
    activeProjectId,
    setActiveProject,
    setProjectFileTree,
    setProjectContext,
    projectFileTree,
    setTerminalCwd,
    isTerminalOpen,
    toggleTerminal,
    isProjectExpanded,
    setProjectExpanded,
    activeProjectPath
  } = useAuraStore();
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [loadingTree, setLoadingTree] = useState<string | null>(null);

  const refreshTree = useCallback(async (path: string) => {
    try {
      const tree = await invoke<FileNode[]>('get_directory_tree', { path });
      setProjectFileTree(tree);
    } catch (e) {
      console.error('Failed to refresh tree:', e);
    }
  }, [setProjectFileTree]);

  useEffect(() => {
    const unlisten = listen('file-tree-update', () => {
      if (activeProjectPath) {
        refreshTree(activeProjectPath);
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [activeProjectPath, refreshTree]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const dbProjects = await getProjects();
        for (const p of dbProjects) {
          addProject({
            id: p.id,
            name: p.name,
            path: p.path,
            lastOpened: new Date(p.last_opened),
            tasks: 0,
            status: 'active',
          });
        }
      } catch (e) {
        console.log('No projects in DB');
      }
    };
    loadProjects();
  }, []);

  const handleProjectClick = async (projectId: string, projectPath: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
      return;
    }
    
    setExpandedProjectId(projectId);
    setActiveProject(projectId, projectPath);
    setTerminalCwd(projectPath);
    setLoadingTree(projectId);
    
    try {
      const [tree, context] = await Promise.all([
        invoke<FileNode[]>('get_directory_tree', { path: projectPath }),
        invoke<string>('get_project_context', { path: projectPath }),
        invoke('watch_project', { path: projectPath }),
      ]);
      setProjectFileTree(tree);
      setProjectContext(context);
    } catch (e) {
      console.error('Failed to load project:', e);
      setProjectFileTree([]);
      setProjectContext('');
    } finally {
      setLoadingTree(null);
    }
  };

  const handleTitleClick = (projectId: string, projectPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeProjectId === projectId) {
      setTerminalCwd(projectPath);
      if (!isTerminalOpen) toggleTerminal();
    } else {
      handleProjectClick(projectId, projectPath);
    }
  };

  const handleAddProject = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Project Root',
    });

    if (selected && typeof selected === 'string') {
      const name = selected.split('\\').pop() || selected.split('/').pop() || 'Untitled Project';
      
      try {
        // saveProject handles generating IDs internally
        await saveProject(name, selected);
        // We re-load projects to get the correct IDs from DB or just add it if we can trust it
        // For simplicity we reload from DB to ensure sync
        const dbProjects = await getProjects();
        const latest = dbProjects[0]; // SQLite returns newest first in our query
        if (latest) {
          addProject({
            id: latest.id,
            name: latest.name,
            path: latest.path,
            lastOpened: new Date(latest.last_opened),
            tasks: 0,
            status: 'active',
          });
          handleProjectClick(latest.id, latest.path);
          if (!isProjectExpanded) setProjectExpanded(true);
        }
      } catch (e) {
        console.error('Failed to save project:', e);
      }
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteProjectDB(id);
      removeProject(id);
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-3">
        <FolderKanban className="w-4 h-4 text-aura-accent" />
        <FolderOpen className="w-4 h-4 text-aura-muted" />
        <Plus className="w-4 h-4 text-aura-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div 
        className="flex items-center justify-between px-4 py-2 cursor-pointer group"
        onClick={() => setProjectExpanded(!isProjectExpanded)}
      >
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-aura-accent/80 group-hover:text-aura-accent transition-colors" />
          <span className="text-sm font-medium text-white/60 tracking-tight group-hover:text-white/90 transition-colors">
            Workspace
          </span>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddProject();
            }}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            title="Add Project Folder"
          >
            <Plus className="w-3.5 h-3.5 text-aura-accent" />
          </motion.button>
          
          <div className="p-1 rounded-lg hover:bg-white/5 transition-colors">
            {isProjectExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-aura-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-aura-muted" />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isProjectExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="text-center py-4">
                  <FolderOpen className="w-8 h-8 text-aura-muted/30 mx-auto mb-2" />
                  <p className="text-xs text-aura-muted/50">No projects yet</p>
                  <button 
                    onClick={handleAddProject}
                    className="text-[10px] text-aura-accent hover:underline mt-1"
                  >
                    Add your first project
                  </button>
                </div>
              ) : (
                projects.map((project, index) => {
                  const StatusIcon = statusIcons[project.status || 'active'];
                  const isExpanded = expandedProjectId === project.id;
                  const isActive = activeProjectId === project.id;
                  
                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                        delay: index * 0.08,
                      }}
                      className={cn(
                        'mx-2 my-1 glass rounded-xl transition-all group',
                        isActive && 'ring-1 ring-aura-accent/30'
                      )}
                    >
                      <div 
                        className="p-3 cursor-pointer hover:bg-white/[0.04] transition-all rounded-xl"
                        onClick={() => handleProjectClick(project.id, project.path)}
                      >
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center gap-2 truncate"
                            onClick={(e) => handleTitleClick(project.id, project.path, e)}
                          >
                            <ChevronRight 
                              className={cn(
                                'w-3.5 h-3.5 text-aura-muted transition-transform shrink-0',
                                isExpanded && 'rotate-90'
                              )} 
                            />
                            <span className="text-xs font-medium text-white truncate hover:underline underline-offset-2">
                              {project.name}
                            </span>
                            <span className={cn(
                              'inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono rounded border uppercase tracking-wider',
                              statusColors[project.status || 'active']
                            )}>
                              <StatusIcon className="w-2 h-2" />
                              {project.status || 'active'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => handleDeleteProject(project.id, e)}
                              className="p-1 rounded text-aura-muted hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </motion.button>
                          </div>
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
                              {loadingTree === project.id ? (
                                <div className="flex items-center gap-2 py-2 px-6 text-[10px] text-aura-muted/40">
                                  <div className="w-2 h-2 rounded-full border border-aura-accent/30 border-t-aura-accent animate-spin" />
                                  Indexing...
                                </div>
                              ) : (
                                <FileTree 
                                  tree={projectFileTree} 
                                  onFileClick={(p) => onFileDoubleClick?.(p)} 
                                />
                              )}
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