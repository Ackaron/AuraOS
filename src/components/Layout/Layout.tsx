import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuraStore } from '@/stores';

interface LayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  agentPanel?: ReactNode;
}

const MIN_SIDEBAR_WIDTH = 64;
const MAX_SIDEBAR_WIDTH = 600;
const MIN_AGENT_WIDTH = 200;
const MAX_AGENT_WIDTH = 1400;
const COLLAPSED_SIDEBAR_WIDTH = 64;

export function Layout({ children, sidebar, agentPanel }: LayoutProps) {
  const { 
    isSidebarCollapsed, 
    sidebarWidth, 
    agentWidth,
    toggleSidebar,
    setAgentWidth,
    setSidebarWidth 
  } = useAuraStore();
  
  const [isDraggingAgent, setIsDraggingAgent] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const sidebarAsideRef = useRef<HTMLDivElement>(null);
  const agentAsideRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSidebar(true);
  }, []);

  const handleAgentDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingAgent(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    
    if (isDraggingSidebar && !isSidebarCollapsed && sidebarAsideRef.current) {
      const newWidth = e.clientX - containerRect.left;
      const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
      sidebarAsideRef.current.style.width = `${clampedWidth}px`;
    }
    
    if (isDraggingAgent && agentAsideRef.current) {
      const newWidth = containerRect.right - e.clientX;
      const clampedWidth = Math.max(MIN_AGENT_WIDTH, Math.min(MAX_AGENT_WIDTH, newWidth));
      agentAsideRef.current.style.width = `${clampedWidth}px`;
    }
  }, [isDraggingAgent, isDraggingSidebar, isSidebarCollapsed]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingAgent && agentAsideRef.current) {
      const newWidth = parseInt(agentAsideRef.current.style.width) || agentWidth;
      setAgentWidth(newWidth);
      localStorage.setItem('auraos-agent-panel-width', newWidth.toString());
    }
    if (isDraggingSidebar && sidebarAsideRef.current) {
      const newWidth = parseInt(sidebarAsideRef.current.style.width) || sidebarWidth;
      setSidebarWidth(newWidth);
      localStorage.setItem('auraos-sidebar-width', newWidth.toString());
    }
    setIsDraggingAgent(false);
    setIsDraggingSidebar(false);
  }, [isDraggingAgent, isDraggingSidebar, agentWidth, sidebarWidth, setAgentWidth, setSidebarWidth]);

  useEffect(() => {
    if (isDraggingAgent || isDraggingSidebar) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingAgent, isDraggingSidebar, handleMouseMove, handleMouseUp]);

  const currentSidebarWidth = isSidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth;
  const currentAgentWidth = agentWidth;

  return (
    <div className="flex h-screen w-full bg-aura-black overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.aside
          ref={sidebarAsideRef}
          initial={{ x: -320, opacity: 0 }}
          animate={{ 
            x: 0, 
            opacity: 1,
            width: currentSidebarWidth 
          }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ 
            type: 'spring', 
            stiffness: 280, 
            damping: 28,
            mass: 0.8
          }}
          className="h-full flex flex-col bg-gradient-to-b from-white/[0.03] to-transparent border-r border-white/[0.06] relative shrink-0"
        >
          <button
            onClick={toggleSidebar}
            className="absolute top-1/2 -right-3 z-10 w-6 h-12 bg-aura-black/80 border border-white/[0.06] rounded-r-lg flex items-center justify-center hover:bg-aura-accent/20 transition-colors"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-aura-muted" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-aura-muted" />
            )}
          </button>
          {sidebar}
        </motion.aside>
      </AnimatePresence>

      {!isSidebarCollapsed && (
        <div 
          className={`w-1 h-full cursor-col-resize transition-colors border-l border-white/[0.06] ${
            isDraggingSidebar ? 'bg-aura-accent' : 'hover:bg-aura-accent/50'
          }`}
          onMouseDown={handleSidebarDragStart}
        />
      )}

      <div 
        ref={containerRef}
        className="flex-1 flex h-full overflow-hidden"
      >
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.5, 
            delay: 0.2,
            ease: [0.22, 1, 0.36, 1]
          }}
          className="flex-1 h-full overflow-hidden flex flex-col relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-aura-accent/[0.02] via-transparent to-transparent pointer-events-none" />
          {children}
        </motion.main>

        {agentPanel && (
          <>
            <div 
              className={`w-1 h-full cursor-col-resize transition-colors border-l border-white/[0.06] ${
                isDraggingAgent ? 'bg-aura-accent' : 'hover:bg-aura-accent/50'
              }`}
              onMouseDown={handleAgentDragStart}
            />
            <motion.aside
              ref={agentAsideRef}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1, width: currentAgentWidth }}
              exit={{ x: 50, opacity: 0 }}
              transition={{ 
                type: 'spring', 
                stiffness: 280, 
                damping: 28,
                mass: 0.8
              }}
              className="h-full bg-gradient-to-l from-white/[0.02] to-transparent border-l border-white/[0.06] shrink-0 overflow-hidden"
            >
              {agentPanel}
            </motion.aside>
          </>
        )}
      </div>
    </div>
  );
}