import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { saveModelAssignment } from '@/lib/database';

export interface ModelStatus {
  name: string;
  provider: 'ollama' | 'lm_studio';
  vramUsage: number;
  isActive: boolean;
}

export type TaskType = 'logic' | 'code' | 'docs' | 'fast';

export interface ModelConfig {
  id: number;
  taskType: TaskType;
  modelName: string;
  provider: 'ollama' | 'lm_studio';
  parameters: {
    temperature?: number;
    top_p?: number;
    context_window?: number;
  };
}

export interface SkillMethod {
  name: string;
  description: string;
  command: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  path: string;
  tags: string[];
  isActive: boolean;
  methods: SkillMethod[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: Date;
  tasks: number;
  status?: 'active' | 'paused' | 'completed';
}

export interface SystemStats {
  gpuName: string;
  vramUsed: number;
  vramTotal: number;
  ramTotal: number;
  ramUsed: number;
  cpuUsage: number;
  cpuTemp: number;
  gpuTemp: number;
}

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
}

export interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  isRunning: boolean;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface SessionState {
  sessionId: string;
  messages: SessionMessage[];
  compactHistory: Array<{
    timestamp: number;
    summary: string;
    actions_taken: string[];
    files_accessed: string[];
    decisions: string[];
    unfinished_tasks: string[];
  }>;
  totalTokens: number;
  contextLimit: number;
}

interface AuraState {
  models: ModelStatus[];
  skills: Skill[];
  projects: Project[];
  activeModel: string | null;
  isOllamaConnected: boolean;
  systemStats: SystemStats;
  
  // Model Router
  modelRouter: Record<TaskType, string>;
  currentTaskType: TaskType;
  
  // Ollama
  availableModels: string[];
  
  // Active Project
  activeProjectPath: string | null;
  activeProjectId: string | null;
  projectFileTree: FileNode[];
  
  // Terminal
  terminalCwd: string | null;
  terminalSessions: TerminalSession[];
  activeTerminalId: string | null;
  
  // Project Context (RAG Lite)
  projectContext: string;
  
  // File Viewer
  openFiles: OpenFile[];
  activeFilePath: string | null;
  
  // Context Monitoring
  activeSessionContextUsage: number;
  modelContextLimits: Record<string, number>;
  
  // UI State
  isSidebarCollapsed: boolean;
  isTerminalOpen: boolean;
  sidebarWidth: number;
  agentWidth: number;
  
  // Panel States
  isProjectExpanded: boolean;
  isSkillCoreExpanded: boolean;
  isModelRouterExpanded: boolean;
  
  // Session State (Phase 3: Infinite Memory)
  activeSessionId: string | null;
  sessions: SessionState[];
  
  setModelStatus: (model: ModelStatus) => void;
  setActiveModel: (modelName: string | null) => void;
  setOllamaConnection: (connected: boolean) => void;
  addSkill: (skill: Skill) => void;
  removeSkill: (skillId: string) => void;
  activateSkill: (skillId: string) => void;
  setSystemStats: (stats: SystemStats) => void;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  updateProjectStatus: (projectId: string, status: 'active' | 'paused' | 'completed') => void;
  setModelForTask: (taskType: TaskType, modelName: string) => void;
  setCurrentTaskType: (taskType: TaskType) => void;
  setAvailableModels: (models: string[]) => void;
  setActiveProject: (projectId: string, projectPath: string) => void;
  setProjectFileTree: (tree: FileNode[]) => void;
  setTerminalCwd: (cwd: string) => void;
  addTerminalSession: (cwd: string, name?: string) => string;
  removeTerminalSession: (id: string) => void;
  setActiveTerminalId: (id: string | null) => void;
  updateTerminalSession: (id: string, updates: Partial<TerminalSession>) => void;
  setProjectContext: (context: string) => void;
  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
  setSidebarWidth: (width: number) => void;
  setAgentWidth: (width: number) => void;
  setProjectExpanded: (expanded: boolean) => void;
  setSkillCoreExpanded: (expanded: boolean) => void;
      setModelRouterExpanded: (expanded: boolean) => void;
      setContextUsage: (usage: number) => void;
      
      // Session Actions
      setActiveSession: (sessionId: string | null) => void;
      addSession: (session: SessionState) => void;
      updateSession: (sessionId: string, updates: Partial<SessionState>) => void;
      removeSession: (sessionId: string) => void;
      addMessageToSession: (sessionId: string, message: SessionMessage) => void;
      compactSession: (sessionId: string) => void;
    }

export const useAuraStore = create<AuraState>()(
  devtools(
    (set) => ({
      models: [],
      skills: [],
      projects: [],
      activeModel: null,
      isOllamaConnected: false,
      systemStats: {
        gpuName: 'NVIDIA GeForce RTX 5080',
        vramUsed: 4.2,
        vramTotal: 16.0,
        ramTotal: 64.0,
        ramUsed: 28.4,
        cpuUsage: 23,
        cpuTemp: 54,
        gpuTemp: 67,
      },
      
      // Model Router
      modelRouter: {
        logic: 'deepseek-r1:8b',
        code: 'qwen2.5:14b',
        docs: 'phi4:latest',
        fast: 'llama3.1:8b',
      },
      currentTaskType: 'code',
      availableModels: [],
      
      activeProjectPath: null,
      activeProjectId: null,
      projectFileTree: [],
      // Terminal
      terminalCwd: null,
      terminalSessions: [],
      activeTerminalId: null,
      projectContext: '',
      
      // File Viewer
      openFiles: [],
      activeFilePath: null,
      
      // Context Monitoring
      activeSessionContextUsage: 0,
      modelContextLimits: {
        'deepseek-r1:8b': 64000 * 4, 
        'qwen2.5:14b': 64000 * 4,
        'phi4:latest': 64000 * 4,
        'llama3.1:8b': 64000 * 4,
        'default': 64000 * 4
      },
      
      // UI State
      isSidebarCollapsed: localStorage.getItem('auraos-sidebar-collapsed') === 'true',
      isTerminalOpen: false,
      sidebarWidth: Number(localStorage.getItem('auraos-sidebar-width')) || 280,
      agentWidth: Number(localStorage.getItem('auraos-agent-panel-width')) || 320,

      // Panel States - Collapsed by default on startup
      isProjectExpanded: false,
      isSkillCoreExpanded: false,
      isModelRouterExpanded: false,
      
      // Session State (Phase 3)
      activeSessionId: null,
      sessions: [],

      setModelStatus: (model) =>
        set((state) => ({
          models: state.models.some((m) => m.name === model.name)
            ? state.models.map((m) => (m.name === model.name ? model : m))
            : [...state.models, model],
        })),

      setActiveModel: (modelName) => set((state) => ({
        activeModel: modelName,
        models: state.models.map(m => ({
          ...m,
          isActive: m.name === modelName
        }))
      })),

      setOllamaConnection: (connected) => set({ isOllamaConnected: connected }),

      addSkill: (skill) =>
        set((state) => ({
          skills: state.skills.some((s) => s.id === skill.id)
            ? state.skills
            : [...state.skills, skill],
        })),

      removeSkill: (skillId) =>
        set((state) => ({
          skills: state.skills.filter((s) => s.id !== skillId),
        })),

      activateSkill: (skillId) =>
        set((state) => ({
          skills: state.skills.map((s) => ({
            ...s,
            isActive: s.id === skillId ? !s.isActive : s.isActive,
          })),
        })),

      setSystemStats: (stats) => set({ systemStats: stats }),

      addProject: (project) =>
        set((state) => ({
          projects: state.projects.some((p) => p.id === project.id)
            ? state.projects
            : [...state.projects, project],
        })),

      updateProjectStatus: (projectId, status) =>
        set((state) => ({
          projects: state.projects.map(p => 
            p.id === projectId ? { ...p, status } : p
          ),
        })),

      removeProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter(p => p.id !== projectId),
        })),

      setModelForTask: (taskType, modelName) => {
        saveModelAssignment(taskType, modelName).catch(console.error);
        set((state) => ({
          modelRouter: {
            ...state.modelRouter,
            [taskType]: modelName,
          },
        }));
      },

      setCurrentTaskType: (taskType) => set({ currentTaskType: taskType }),
      setAvailableModels: (models) => set({ availableModels: models }),
      
      setActiveProject: (projectId, projectPath) => set({ 
        activeProjectId: projectId,
        activeProjectPath: projectPath,
        terminalCwd: projectPath,
        projectContext: '',
      }),
      
      setProjectFileTree: (tree) => set({ projectFileTree: tree }),
      setTerminalCwd: (cwd) => set((state) => {
        if (state.activeTerminalId) {
          return {
            terminalCwd: cwd,
            terminalSessions: state.terminalSessions.map(s => 
              s.id === state.activeTerminalId ? { ...s, cwd } : s
            )
          };
        }
        return { terminalCwd: cwd };
      }),

      addTerminalSession: (cwd, name) => {
        const id = crypto.randomUUID();
        const newSession: TerminalSession = {
          id,
          name: name || 'Terminal',
          cwd,
          isRunning: false,
        };
        set((state) => ({
          terminalSessions: [...state.terminalSessions, newSession],
          activeTerminalId: id,
          isTerminalOpen: true,
        }));
        return id;
      },

      removeTerminalSession: (id) => set((state) => {
        const newSessions = state.terminalSessions.filter(s => s.id !== id);
        return {
          terminalSessions: newSessions,
          activeTerminalId: state.activeTerminalId === id 
            ? (newSessions[newSessions.length - 1]?.id || null)
            : state.activeTerminalId
        };
      }),

      setActiveTerminalId: (id) => set({ activeTerminalId: id }),

      updateTerminalSession: (id, updates) => set((state) => ({
        terminalSessions: state.terminalSessions.map(s => 
          s.id === id ? { ...s, ...updates } : s
        )
      })),
      setProjectContext: (context) => set({ projectContext: context }),
      
      openFile: (file) => set((state) => {
        const exists = state.openFiles.some(f => f.path === file.path);
        if (exists) {
          return { activeFilePath: file.path };
        }
        return {
          openFiles: [...state.openFiles, file],
          activeFilePath: file.path,
        };
      }),
      
      closeFile: (path) => set((state) => {
        const newFiles = state.openFiles.filter(f => f.path !== path);
        return {
          openFiles: newFiles,
          activeFilePath: state.activeFilePath === path 
            ? (newFiles[0]?.path || null)
            : state.activeFilePath,
        };
      }),
      
      setActiveFile: (path) => set({ activeFilePath: path }),
      
      toggleSidebar: () => set((state) => { 
        const newState = !state.isSidebarCollapsed;
        localStorage.setItem('auraos-sidebar-collapsed', String(newState));
        return { isSidebarCollapsed: newState };
      }),
      
      toggleTerminal: () => set((state) => ({ 
        isTerminalOpen: !state.isTerminalOpen 
      })),
      
      setSidebarWidth: (width) => {
        localStorage.setItem('auraos-sidebar-width', String(width));
        set({ sidebarWidth: width });
      },
      setAgentWidth: (width) => {
        localStorage.setItem('auraos-agent-panel-width', String(width));
        set({ agentWidth: width });
      },

      // Panel States
      setProjectExpanded: (expanded) => set({ isProjectExpanded: expanded }),
      setSkillCoreExpanded: (expanded) => set({ isSkillCoreExpanded: expanded }),
      setModelRouterExpanded: (expanded) => set({ isModelRouterExpanded: expanded }),
      setContextUsage: (usage) => set({ activeSessionContextUsage: usage }),
      
      // Session Actions (Phase 3: Infinite Memory)
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
      
      addSession: (session) => set((state) => ({
        sessions: state.sessions.some(s => s.sessionId === session.sessionId)
          ? state.sessions
          : [...state.sessions, session],
        activeSessionId: session.sessionId,
      })),
      
      updateSession: (sessionId, updates) => set((state) => ({
        sessions: state.sessions.map(s => 
          s.sessionId === sessionId ? { ...s, ...updates } : s
        )
      })),
      
      removeSession: (sessionId) => set((state) => {
        const newSessions = state.sessions.filter(s => s.sessionId !== sessionId);
        return {
          sessions: newSessions,
          activeSessionId: state.activeSessionId === sessionId 
            ? (newSessions[0]?.sessionId || null)
            : state.activeSessionId
        };
      }),
      
      addMessageToSession: (sessionId, message) => set((state) => ({
        sessions: state.sessions.map(s => 
          s.sessionId === sessionId 
            ? { 
                ...s, 
                messages: [...s.messages, message],
                totalTokens: s.totalTokens + Math.ceil(message.content.length / 4)
              } 
            : s
        )
      })),
      
      compactSession: (sessionId) => set((state) => ({
        sessions: state.sessions.map(s => {
          if (s.sessionId !== sessionId) return s;
          
          const tailSize = 10;
          const tail = s.messages.slice(-tailSize);
          const summary = {
            timestamp: Date.now(),
            summary: `Compacted ${s.messages.length - tailSize} messages`,
            actions_taken: ['Previous actions summarized'],
            files_accessed: ['Previous files summarized'],
            decisions: ['Previous decisions summarized'],
            unfinished_tasks: ['Previous tasks summarized'],
          };
          
          return {
            ...s,
            messages: tail,
            compactHistory: [...s.compactHistory, summary],
            totalTokens: tail.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
          };
        })
      })),
    }),
    { name: 'AuraStore' }
  )
);