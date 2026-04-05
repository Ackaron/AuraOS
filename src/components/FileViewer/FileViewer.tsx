import { motion } from 'framer-motion';
import Editor from '@monaco-editor/react';
import { X, FileCode, FileText, FileJson, File } from 'lucide-react';
import { useAuraStore } from '@/stores';
import { cn } from '@/lib/utils';

const getLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    rs: 'rust',
    py: 'python',
    json: 'json',
    md: 'markdown',
    html: 'html',
    css: 'css',
    sql: 'sql',
    toml: 'toml',
    yml: 'yaml',
    yaml: 'yaml',
  };
  return langMap[ext] || 'plaintext';
};

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return FileCode;
    case 'rs':
      return FileCode;
    case 'md':
      return FileText;
    case 'json':
      return FileJson;
    default:
      return File;
  }
};

export function FileViewer() {
  const { openFiles, activeFilePath, closeFile, setActiveFile } = useAuraStore();

  if (openFiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-aura-accent/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="text-center space-y-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-aura-accent/20 to-transparent border border-aura-accent/20 flex items-center justify-center"
          >
            <FileCode className="w-8 h-8 text-aura-accent/60" />
          </motion.div>
          <div>
            <p className="text-sm text-aura-muted/80">
              Double-click a file to open
            </p>
            <p className="text-[11px] text-aura-muted/40 mt-1 font-mono">
              Files will appear here for editing
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeFile = openFiles.find(f => f.path === activeFilePath) || openFiles[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1 bg-white/[0.02] border-b border-white/[0.06] overflow-x-auto">
        {openFiles.map((file) => {
          const FileIcon = getFileIcon(file.name);
          return (
            <motion.button
              key={file.path}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setActiveFile(file.path)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-mono transition-colors',
                activeFilePath === file.path
                  ? 'bg-white/[0.05] text-white'
                  : 'text-aura-muted/60 hover:text-white/80 hover:bg-white/[0.02]'
              )}
            >
              <FileIcon className="w-3.5 h-3.5" />
              <span className="truncate max-w-[100px]">{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.path);
                }}
                className="ml-1 hover:text-red-400 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.button>
          );
        })}
      </div>

      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={getLanguage(activeFile.name)}
          value={activeFile.content}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: true },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16 },
          }}
        />
      </div>
    </div>
  );
}