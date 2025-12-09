
import React, { useLayoutEffect, useRef } from 'react';
import { X, FileText, Code, FileCode, GitCompare } from 'lucide-react';
import { EdiFile } from '../types';
import { animateTabSwitch } from '../utils/gsapAnimations';

interface EditorTabsProps {
  files: EdiFile[];
  activeFileId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  className?: string;
}

const EditorTabs: React.FC<EditorTabsProps> = ({ files, activeFileId, onSelect, onClose, className }) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Animate newly added tab
  useLayoutEffect(() => {
    if (activeFileId && tabsContainerRef.current) {
        const activeTabEl = tabsContainerRef.current.querySelector(`[data-tab-id="${activeFileId}"]`);
        if (activeTabEl) {
            animateTabSwitch(activeTabEl as HTMLElement);
        }
    }
  }, [activeFileId]);

  if (files.length === 0) return null;

  const getIcon = (file: EdiFile) => {
    if (file.isCompareView) return <GitCompare size={12} className="text-purple-400" />;
    
    const name = file.name;
    if (name.endsWith('.xml') || name.endsWith('.xslt')) return <Code size={12} className="text-orange-400" />;
    if (name.endsWith('.json')) return <FileCode size={12} className="text-yellow-400" />;
    return <FileText size={12} className="text-blue-400" />;
  };

  return (
    <div 
        ref={tabsContainerRef} 
        className={`flex overflow-x-auto no-scrollbar select-none ${className}`}
    >
      {files.map(file => {
        const isActive = file.id === activeFileId;
        const hasError = file.analysis?.transactionSet === 'UNKNOWN' && !file.isCompareView;

        return (
          <div
            key={file.id}
            data-tab-id={file.id}
            onClick={() => onSelect(file.id)}
            className={`
              group flex items-center gap-2 px-4 py-2 text-xs font-medium cursor-pointer min-w-[120px] max-w-[200px] transition-all relative border-r border-white/5
              ${isActive ? 'bg-slate-800/80 text-blue-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}
            `}
            title={file.name}
          >
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            )}
            
            {getIcon(file)}
            <span className="truncate flex-1">{file.name}</span>
            
            {hasError && !isActive && <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />}
            
            <button
              onClick={(e) => { e.stopPropagation(); onClose(file.id); }}
              className={`opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-700/50 transition-all ${isActive ? 'text-blue-400' : 'text-slate-500 hover:text-red-400'}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default EditorTabs;
