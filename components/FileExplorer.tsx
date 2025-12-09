
import React, { useLayoutEffect, useRef } from 'react';
import { FileText, Plus, FolderOpen, HardDrive, Check, GitCompare, Sparkles, Code, FileCode, Trash2 } from 'lucide-react';
import { EdiFile } from '../types';
import { staggerListItems, animateButtonHover, animateButtonPress } from '../utils/gsapAnimations';

interface FileExplorerProps {
  files: EdiFile[];
  activeFileId: string | null;
  selectedFileIds: Set<string>;
  onSelectFile: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onCompareSelected: () => void;
  onAiSummarizeSelected: () => void;
  onNewFile: () => void;
  onDeleteFile: (id: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ 
  files, 
  activeFileId, 
  selectedFileIds,
  onSelectFile, 
  onToggleSelection,
  onCompareSelected,
  onAiSummarizeSelected,
  onNewFile, 
  onDeleteFile,
  onUpload 
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectionCount = selectedFileIds.size;

  // Stagger animation on mount or file list change
  useLayoutEffect(() => {
    if (listRef.current) {
      staggerListItems('.file-item', listRef.current);
    }
  }, [files.length]); 

  const filteredFiles = files.filter(f => {
    const name = f.name.toLowerCase();
    if (name === 'token.txt') return false;
    const junkExtensions = ['.cs', '.dll', '.pdb', '.cache', '.sln', '.csproj', '.user', '.config', '.exe', '.md', '.gitignore', '.yml', '.html', '.css', '.ts', '.tsx', '.js'];
    if (junkExtensions.some(ext => name.endsWith(ext))) {
        if (name.endsWith('.json') && (name === 'metadata.json' || name === 'tsconfig.json' || name === 'package.json')) return false;
        if (name.endsWith('.ts')) return false; 
        return false;
    }
    return true;
  });

  const getFileIcon = (file: EdiFile) => {
    if (file.isCompareView) return <GitCompare size={14} className="text-purple-400" />;
    const name = file.name;
    if (name.endsWith('.xml') || name.endsWith('.xslt') || name.endsWith('.xsm')) return <Code size={14} className="text-orange-400" />;
    if (name.endsWith('.json')) return <FileCode size={14} className="text-yellow-400" />;
    if (name.endsWith('.out') || name.endsWith('.log')) return <FileText size={14} className="text-slate-500" />;
    return <FileText size={14} className="text-blue-400" />;
  };

  return (
    <div className="h-full flex flex-col text-slate-400 w-[260px] min-w-[260px]">
      {/* Header - Aligned to h-10 to match Editor Toolbar */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 bg-slate-900/50 backdrop-blur-sm flex-none">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Explorer</span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar" ref={listRef}>
        <div className="px-4 py-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <FolderOpen size={14} />
          OPEN FILES
        </div>
        
        <div className="space-y-1 px-2">
          {filteredFiles.map(file => (
            <div 
              key={file.id}
              className={`file-item group flex items-center px-3 py-2 text-sm transition-all rounded-lg cursor-pointer relative overflow-hidden ${
                activeFileId === file.id 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                  : 'text-slate-400 border border-transparent hover:bg-white/5 hover:text-slate-200'
              }`}
              onClick={() => onSelectFile(file.id)}
              onMouseEnter={(e) => animateButtonHover(e.currentTarget, true)}
              onMouseLeave={(e) => animateButtonHover(e.currentTarget, false)}
            >
              {/* Selection Checkbox */}
              <div 
                onClick={(e) => { e.stopPropagation(); onToggleSelection(file.id); }}
                className={`w-4 h-4 mr-3 rounded flex items-center justify-center cursor-pointer transition-all ${
                  selectedFileIds.has(file.id) 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-slate-800 border border-slate-600 group-hover:border-slate-400'
                }`}
              >
                {selectedFileIds.has(file.id) && <Check size={10} strokeWidth={4} />}
              </div>

              {/* Icon & Name */}
              <div className="flex-1 flex items-center gap-3 overflow-hidden">
                {getFileIcon(file)}
                <div className="flex flex-col min-w-0">
                  <span className="truncate leading-tight font-medium">{file.name}</span>
                  {file.analysis?.transactionSet && (
                     <span className="text-[10px] text-slate-600 font-mono leading-tight">
                       {file.analysis.transactionSet} v{file.analysis.version?.substring(2,5) || '???'}
                     </span>
                  )}
                </div>
              </div>
              
              {/* Delete Action */}
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteFile(file.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all absolute right-2"
                title="Close File"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {filteredFiles.length === 0 && (
             <div className="px-6 py-8 text-center">
                <p className="text-xs text-slate-600 italic">No files open</p>
             </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-white/5 space-y-3 bg-slate-900/80 backdrop-blur-md z-10 flex-none">
        <button 
          onClick={(e) => { animateButtonPress(e.currentTarget); onNewFile(); }}
          className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/5 hover:border-white/10"
        >
          <Plus size={14} /> New File
        </button>
        <div className="relative w-full group">
           <div className="flex items-center justify-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 py-2.5 rounded-xl text-xs font-bold transition-all border border-blue-500/20 group-hover:border-blue-500/40 cursor-pointer">
              <HardDrive size={14} /> Open Files
           </div>
           <input 
              type="file" 
              multiple 
              onChange={onUpload} 
              className="absolute inset-0 opacity-0 cursor-pointer" 
            />
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectionCount >= 2 && (
        <div className="absolute bottom-32 left-4 right-4 bg-blue-600 text-white p-3 rounded-xl shadow-2xl shadow-blue-900/50 z-50 border border-blue-400/20 animate-in slide-in-from-bottom-4">
           <div className="flex justify-between items-center mb-2">
             <span className="text-xs font-bold tracking-wide">{selectionCount} Files Selected</span>
           </div>
           <div className="grid grid-cols-2 gap-2">
             <button 
               onClick={onCompareSelected}
               className="flex items-center justify-center gap-1.5 bg-black/20 hover:bg-black/30 py-2 rounded-lg text-xs font-semibold transition-colors"
             >
               <GitCompare size={14} /> Compare
             </button>
             <button 
               onClick={onAiSummarizeSelected}
               className="flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 py-2 rounded-lg text-xs font-semibold transition-colors"
             >
               <Sparkles size={14} /> AI Summary
             </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
