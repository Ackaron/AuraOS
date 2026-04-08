import { useEffect } from 'react';
import { Layout, ModelMonitor, SkillPanel, ProjectPanel, ModelRouterPanel, FileViewer, AgentPanel, SessionsPanel } from '@/components';
import { BottomTerminal } from '@/components/Terminal/BottomTerminal';
import { useAuraStore, type TaskType, type OpenFile } from '@/stores';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { initDatabase, getModelAssignments } from '@/lib/database';

interface OllamaModel {
  name: string;
}

interface OllamaStatus {
  available: boolean;
  models: OllamaModel[];
}

function App() {
  const { 
    setOllamaConnection, 
    setModelStatus, 
    setSystemStats, 
    setAvailableModels, 
    setModelForTask, 
    openFile, 
    isSidebarCollapsed, 
    toggleTerminal,
    isTerminalOpen,
    setDiscoveredAgents,
    setCurrentTaskType
  } = useAuraStore();

  const getLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript',
      js: 'javascript', jsx: 'javascript',
      rs: 'rust',
      py: 'python',
      json: 'json',
      md: 'markdown',
      html: 'html',
      css: 'css',
      sql: 'sql',
      toml: 'toml',
      yml: 'yaml',
    };
    return langMap[ext] || 'plaintext';
  };

  const handleFileDoubleClick = async (path: string) => {
    try {
      const content = await invoke<string>('read_file_content', { path });
      const name = path.split('\\').pop() || path.split('/').pop() || 'unknown';
      const file: OpenFile = {
        path,
        name,
        content,
        language: getLanguage(name),
      };
      openFile(file);
    } catch (_e) {
      console.error('Error opening file:', _e);
    }
  };

useEffect(() => {
    const initApp = async () => {
      try {
        await initDatabase();
        console.log('Database initialized');
        
        // Load model assignments
        const assignments = await getModelAssignments();
        for (const [taskType, modelName] of Object.entries(assignments)) {
          setModelForTask(taskType as TaskType, modelName);
        }
        
        // Load discovered agents from .claude/agents/
        try {
          console.log('[APP] Before invoke get_discovered_agents...');
          const agents = await invoke<Array<{
            name: string;
            role: string;
            description: string;
            goals: string[];
            rules: string[];
            capabilities: string[];
          }>>('get_discovered_agents');
          
          console.log('[APP] Agents loaded:', agents);
          setDiscoveredAgents(agents);
          
          // Set first agent as current task type
          if (agents.length > 0) {
            setCurrentTaskType(agents[0].name);
          }
        } catch (agentError) {
          console.log('[APP] Agent discovery FAILED:', agentError);
        }
      } catch (_e) {
        console.log('DB init skipped:', _e);
      }
    };
    
    initApp();
  }, [setModelForTask, setDiscoveredAgents, setCurrentTaskType]);

  useEffect(() => {
    const checkOllama = async () => {
      try {
        const status = await invoke<OllamaStatus>('check_ollama_status');
        setOllamaConnection(status.available);
        
        if (status.models) {
          const modelNames = status.models.map(m => m.name);
          setAvailableModels(modelNames);
          
          modelNames.forEach((name: string) => {
            setModelStatus({
              name,
              provider: 'ollama',
              vramUsage: 0,
              isActive: false,
            });
          });
        }
      } catch {
        setOllamaConnection(false);
      }
    };

    checkOllama();
    const interval = setInterval(checkOllama, 15000);

    const unlistenStats = listen<{
      gpu: { vram_used: number; vram_total: number; utilization: number; temperature: number | null };
      cpu: { usage: number; temperature: number };
    }>('system-stats', (event) => {
      const { gpu, cpu } = event.payload;
      setSystemStats({
        gpuName: 'NVIDIA GeForce RTX 5080',
        vramUsed: gpu.vram_used / 1024,
        vramTotal: gpu.vram_total / 1024,
        ramTotal: 64,
        ramUsed: 28.4 + (Math.random() * 2),
        cpuUsage: Math.round(cpu.usage),
        cpuTemp: Math.round(cpu.temperature),
        gpuTemp: gpu.temperature ? Math.round(gpu.temperature) : 67,
      });
    });

    return () => {
      clearInterval(interval);
      unlistenStats.then((fn) => fn());
    };
  }, [setOllamaConnection, setModelStatus, setSystemStats, setAvailableModels]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (response.ok) {
          const data = await response.json();
          if (data.models) {
            data.models.forEach((model: { name: string }) => {
              setModelStatus({
                name: model.name,
                provider: 'ollama',
                vramUsage: 0,
                isActive: false,
              });
            });
          }
        }
      } catch {
        // Ollama not running
      }
    };

    fetchModels();
  }, [setModelStatus]);

  useEffect(() => {
    const unlistenPromise = listen('toggle-terminal', () => {
      useAuraStore.getState().toggleTerminal();
    });
    
    return () => {
      unlistenPromise.then(unlistenFn => unlistenFn());
    };
  }, []);

  return (
    <Layout
      sidebar={
        <div className={`flex flex-col h-full overflow-hidden ${isSidebarCollapsed ? 'items-center' : ''}`}>
          <div className={`border-b border-white/[0.06] shrink-0 ${isSidebarCollapsed ? 'p-2' : 'p-6'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aura-accent to-cyan-400 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-black">A</span>
              </div>
              {!isSidebarCollapsed && (
                <div>
                  <h1 className="text-base font-semibold text-white tracking-tight">
                    AuraOS
                  </h1>
                  <p className="text-[11px] text-aura-muted font-mono">
                    Cognitive IDE
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className={`flex-1 overflow-y-auto custom-scrollbar ${isSidebarCollapsed ? 'px-1' : ''}`}>
            <div className={`${isSidebarCollapsed ? 'py-2' : 'pb-2'}`}>
              <ModelMonitor isCollapsed={isSidebarCollapsed} />
            </div>
            {!isSidebarCollapsed && <div className="mx-4 border-t border-white/[0.06]" />}
            <div className={`${isSidebarCollapsed ? 'py-2' : 'py-2'}`}>
              <ModelRouterPanel isCollapsed={isSidebarCollapsed} />
            </div>
            {!isSidebarCollapsed && <div className="mx-4 border-t border-white/[0.06]" />}
            <div className={`${isSidebarCollapsed ? 'py-2' : 'py-2'}`}>
              <SkillPanel isCollapsed={isSidebarCollapsed} />
            </div>
            {!isSidebarCollapsed && <div className="mx-4 border-t border-white/[0.06]" />}
            <div className={`${isSidebarCollapsed ? 'py-2' : 'py-2'}`}>
              <ProjectPanel onFileDoubleClick={handleFileDoubleClick} isCollapsed={isSidebarCollapsed} />
            </div>
            {!isSidebarCollapsed && <div className="mx-4 border-t border-white/[0.06]" />}
            <div className={`${isSidebarCollapsed ? 'py-2' : 'py-2'}`}>
              <SessionsPanel isCollapsed={isSidebarCollapsed} />
            </div>
          </div>

          <div className={`border-t border-white/[0.06] ${isSidebarCollapsed ? 'p-2' : 'p-4'}`}>
            <div className={`flex items-center justify-between text-[10px] ${isSidebarCollapsed ? 'flex-col gap-1' : ''}`}>
              <span className="text-aura-muted/60 font-mono">v0.1.0</span>
              {!isSidebarCollapsed && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-aura-muted/60">System Ready</span>
                </div>
              )}
            </div>
          </div>
        </div>
      }
      agentPanel={<AgentPanel />}
    >
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-white/80">
                Workspace
              </h2>
              <p className="text-[11px] text-aura-muted/60 mt-0.5">
                Double-click files to open in editor
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[11px] text-aura-muted/60">
                <span className="font-mono">0 tasks</span>
                <span>·</span>
                <span>No context loaded</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <FileViewer />
          <BottomTerminal 
            isOpen={isTerminalOpen} 
            onClose={toggleTerminal} 
          />
        </div>
      </div>
    </Layout>
  );
}

export default App;