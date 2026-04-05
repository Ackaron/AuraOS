import { motion, AnimatePresence } from 'framer-motion';
import { FolderKanban, Play, Pause, CheckCircle2, Plus, Trash2, FolderOpen, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuraStore, type FileNode } from '@/stores';
import { cn } from '@/lib/utils';
import { open } from '@tauri-apps/plugin-dialog';
import { getProjects, saveProject, deleteProject as deleteProjectDB } from '@/lib/database';
import { invoke } from '@tauri-apps/api/core';
import { FileTree } from '@/components/FileTree/FileTree';

const statusColors = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  paused: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  completed: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
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
  } = useAuraStore();
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [loadingTree, setLoadingTree] = useState<string | null>(null);

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
    setLoadingTree(projectId);
    
    try {
      const [tree, context] = await Promise.all([
        invoke<FileNode[]>('get_directory_tree', { path: projectPath }),
        invoke<string>('get_project_context', { path: projectPath }),
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

  const handleAddProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Folder',
      });
      
      if (selected) {
        const path = selected as string;
        const name = path.split(/[/\\]/).pop() || 'Project';
        await saveProject(name, path);
        addProject({
          id: crypto.randomUUID(),
          name,
          path,
          lastOpened: new Date(),
          tasks: 0,
          status: 'active',
        });
      }
    } catch (e) {
      console.error('Failed to add project:', e);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteProjectDB(id);
      removeProject(id);
      if (activeProjectId === id) {
        setActiveProject('', '');
        setProjectFileTree([]);
      }
    } catch (e) {
      console.error('Failed to delete project:', e);
    }
  };

  const handleFileClick = (path: string) => {
    if (onFileDoubleClick) {
      onFileDoubleClick(path);
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <FolderKanban className="w-4 h-4 text-aura-accent" />
        <FolderOpen className="w-4 h-4 text-aura-muted" />
        <Plus className="w-4 h-4 text-aura-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-aura-accent" />
          <span className="text-sm font-medium text-white/80 tracking-tight">
            Workspace
          </span>
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddProject}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            title="Add Project Folder"
          >
            <Plus className="w-3.5 h-3.5 text-aura-accent" />
          </motion.button>
        </div>
      </div>

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
                  'glass rounded-xl transition-all group',
                  isActive && 'ring-1 ring-aura-accent/30'
                )}
              >
                <div 
                  className="p-3 cursor-pointer hover:bg-white/[0.06] transition-all"
                  onClick={() => handleProjectClick(project.id, project.path)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChevronRight 
                        className={cn(
                          'w-4 h-4 text-aura-muted transition-transform',
                          isExpanded && 'rotate-90'
                        )} 
                      />
                      <span className="text-sm font-medium text-white truncate">
                        {project.name}
                      </span>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border',
                        statusColors[project.status || 'active']
                      )}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {project.status || 'active'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-aura-muted hover:text-red-400 transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-6">
                    <span className="text-[10px] text-aura-muted/60 font-mono truncate max-w-[150px]">
                      {project.path}
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-3 overflow-y-auto" style={{ maxHeight: 'none' }}>
                        {loadingTree === project.id ? (
                          <div className="py-4 text-center">
                            <span className="text-xs text-aura-muted/50">Loading...</span>
                          </div>
                        ) : (
                          <FileTree tree={projectFileTree} onFileClick={handleFileClick} />
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
    </div>
  );
}