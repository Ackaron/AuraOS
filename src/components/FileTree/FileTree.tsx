import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  FileText, 
  FileJson, 
  FileImage,
  ChevronRight,
  File
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type FileNode } from '@/stores';

const getFileIcon = (name: string, isDir: boolean) => {
  if (isDir) return Folder;
  
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
    case 'markdown':
      return FileText;
    case 'json':
      return FileJson;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
      return FileImage;
    default:
      return File;
  }
};

const getFileColor = (name: string, isDir: boolean) => {
  if (isDir) return 'text-amber-400';
  
  const ext = name.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'text-blue-400';
    case 'js':
    case 'jsx':
      return 'text-yellow-400';
    case 'rs':
      return 'text-orange-400';
    case 'md':
      return 'text-green-400';
    case 'json':
      return 'text-purple-400';
    default:
      return 'text-zinc-400';
  }
};

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  onFileClick?: (path: string) => void;
  onDirectoryClick?: (path: string) => void;
}

function FileTreeNode({ node, depth, onFileClick, onDirectoryClick }: FileTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  
  const Icon = getFileIcon(node.name, node.is_dir);
  const colorClass = getFileColor(node.name, node.is_dir);
  
  const handleClick = () => {
    if (node.is_dir) {
      if (onDirectoryClick) {
        onDirectoryClick(node.path);
      }
    } else if (onFileClick) {
      onFileClick(node.path);
    }
  };

  const handleDoubleClick = () => {
    if (node.is_dir) {
      setIsOpen(!isOpen);
    }
  };
  
  return (
    <div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded-lg cursor-pointer transition-colors',
          'hover:bg-white/[0.05]'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {node.is_dir && (
          <ChevronRight 
            className={cn(
              'w-3 h-3 text-aura-muted transition-transform',
              isOpen && 'rotate-90'
            )} 
          />
        )}
        {!node.is_dir && <div className="w-3" />}
        
        {node.is_dir ? (
          isOpen ? (
            <FolderOpen className={cn('w-4 h-4', colorClass)} />
          ) : (
            <Folder className={cn('w-4 h-4', colorClass)} />
          )
        ) : (
          <Icon className={cn('w-4 h-4', colorClass)} />
        )}
        
        <span className="text-xs text-white/70 truncate">
          {node.name}
        </span>
      </motion.div>
      
      <AnimatePresence>
        {node.is_dir && isOpen && node.children && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {node.children.map((child, index) => (
              <FileTreeNode
                key={`${child.path}-${index}`}
                node={child}
                depth={depth + 1}
                onFileClick={onFileClick}
                onDirectoryClick={onDirectoryClick}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FileTreeProps {
  tree: FileNode[];
  onFileClick?: (path: string) => void;
  onDirectoryClick?: (path: string) => void;
}

export function FileTree({ tree, onFileClick, onDirectoryClick }: FileTreeProps) {
  if (tree.length === 0) {
    return (
      <div className="py-4 text-center">
        <span className="text-xs text-aura-muted/50">No files</span>
      </div>
    );
  }
  
  return (
    <div className="py-2">
      {tree.map((node, index) => (
        <FileTreeNode
          key={`${node.path}-${index}`}
          node={node}
          depth={0}
          onFileClick={onFileClick}
          onDirectoryClick={onDirectoryClick}
        />
      ))}
    </div>
  );
}