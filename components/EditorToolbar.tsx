
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Copy, Check, AlignLeft, Download, Edit3, Eye, Undo, Redo, Search, Minimize2, WrapText, ChevronDown, FileCode, FileJson, FileText, File, Code, BookOpen, Settings2 } from 'lucide-react';
import { EditorHandle, EditorState } from './Editor';
import { animateButtonPress, animateButtonHover } from '../utils/gsapAnimations';
import { detectDelimiters } from '../utils/ediDetection';

interface EditorToolbarProps {
  editorRef: React.RefObject<EditorHandle>;
  editorState: EditorState;
  isBusinessView?: boolean;
  onToggleBusinessView?: () => void;
  ediContent?: string;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editorRef, editorState, isBusinessView, onToggleBusinessView, ediContent }) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Analyze delimiters for display
  const delimiters = useMemo(() => {
    if (!ediContent) return null;
    return detectDelimiters(ediContent);
  }, [ediContent]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Keyboard Shortcuts for Download
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        switch(e.key.toLowerCase()) {
          case 'e': e.preventDefault(); e.stopPropagation(); editorRef.current?.download('edi'); break;
          case 't': e.preventDefault(); e.stopPropagation(); editorRef.current?.download('txt'); break;
          case 'o': e.preventDefault(); e.stopPropagation(); editorRef.current?.download('out'); break;
          case 'j': e.preventDefault(); e.stopPropagation(); editorRef.current?.download('json'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInteraction = (e: React.MouseEvent<HTMLButtonElement>) => {
    animateButtonPress(e.currentTarget);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    animateButtonHover(e.currentTarget, true);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    animateButtonHover(e.currentTarget, false);
  };

  const handleCopy = () => {
    editorRef.current?.copy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to display invisible chars like newline
  const formatChar = (char: string) => {
    if (char === '\n' || char === '\r\n') return '↵';
    if (char === '\r') return 'CR';
    if (char === ' ') return '␣';
    if (char === '\t') return 'TAB';
    return char;
  };

  const ActionButton = ({ onClick, disabled, active, title, children, className }: any) => (
    <button 
        onClick={(e) => { onClick && onClick(); handleInteraction(e); }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        title={title}
        className={`
            p-1.5 rounded-lg transition-colors 
            ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'} 
            ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
            ${className || ''}
        `}
    >
        {children}
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      {/* Quick Insert Snippets */}
      {editorState.isEditing && !isBusinessView && (
        <div className="mr-3 flex items-center gap-1 hidden sm:flex">
           {['ISA*', 'GS*', 'ST*'].map(snip => (
               <button 
                 key={snip} 
                 onClick={(e) => { editorRef.current?.insertSnippet(snip); handleInteraction(e); }}
                 className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400 rounded transition-colors border border-white/5"
               >
                 {snip.replace('*','')}
               </button>
           ))}
        </div>
      )}

      {/* Delimiter Info Badge */}
      {!isBusinessView && delimiters && delimiters.standard !== 'UNKNOWN' && (
        <div className="group relative mr-2 cursor-help hidden md:block">
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-400 hover:border-slate-500 transition-colors">
                <span className={`font-bold ${delimiters.standard === 'X12' ? 'text-blue-400' : 'text-purple-400'}`}>
                    {delimiters.standard}
                </span>
                <div className="w-px h-3 bg-slate-700"></div>
                <div className="flex gap-1.5">
                    <span title="Element Separator" className="text-slate-300 bg-white/5 px-1 rounded">{formatChar(delimiters.element)}</span>
                    <span title="Component Separator" className="text-slate-500">{formatChar(delimiters.component)}</span>
                    <span title="Segment Terminator" className="text-slate-500">{formatChar(delimiters.segment)}</span>
                </div>
            </div>
            
            {/* Tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 text-xs">
                <div className="font-bold text-slate-300 mb-2 border-b border-white/5 pb-1 flex items-center gap-2">
                    <Settings2 size={12} /> Detected Delimiters
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-y-1.5">
                    <span className="text-slate-500">Element:</span>
                    <code className="text-blue-300 bg-black/20 px-1.5 rounded">{formatChar(delimiters.element)}</code>
                    
                    <span className="text-slate-500">Component:</span>
                    <code className="text-purple-300 bg-black/20 px-1.5 rounded">{formatChar(delimiters.component)}</code>
                    
                    <span className="text-slate-500">Segment:</span>
                    <code className="text-emerald-300 bg-black/20 px-1.5 rounded">{formatChar(delimiters.segment)}</code>
                    
                    {delimiters.release && (
                        <>
                            <span className="text-slate-500">Release:</span>
                            <code className="text-orange-300 bg-black/20 px-1.5 rounded">{formatChar(delimiters.release)}</code>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Mode Toggle Group */}
      <div className="bg-slate-800/50 rounded-lg p-0.5 border border-white/5 mr-2 flex">
         <ActionButton onClick={() => editorRef.current?.toggleEditMode()} active={editorState.isEditing && !isBusinessView} title="Edit Mode" disabled={isBusinessView}>
            <Edit3 size={14} />
         </ActionButton>
         <ActionButton onClick={() => editorRef.current?.toggleEditMode()} active={!editorState.isEditing && !isBusinessView} title="Visual Mode" disabled={!editorState.isEdiMode || isBusinessView}>
            <Eye size={14} />
         </ActionButton>
         {onToggleBusinessView && (
             <ActionButton onClick={onToggleBusinessView} active={isBusinessView} title="Business View (Human Readable)">
                <BookOpen size={14} />
             </ActionButton>
         )}
      </div>
      
      {!isBusinessView && (
        <>
          {/* Actions */}
          <ActionButton onClick={() => editorRef.current?.toggleFind()} active={editorState.isFindOpen} title="Find/Replace">
            <Search size={16} />
          </ActionButton>
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <ActionButton onClick={() => editorRef.current?.undo()} disabled={!editorState.canUndo}>
            <Undo size={16} />
          </ActionButton>
          <ActionButton onClick={() => editorRef.current?.redo()} disabled={!editorState.canRedo}>
            <Redo size={16} />
          </ActionButton>
          
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <ActionButton onClick={() => editorRef.current?.toggleVisualWrap()} active={editorState.isVisualWrap} title="Wrap Text">
            <WrapText size={16} />
          </ActionButton>

          <ActionButton onClick={() => editorRef.current?.warp()} title="Warp (Single Line)">
            <Minimize2 size={16} />
          </ActionButton>

          <ActionButton onClick={() => editorRef.current?.unwarp()} title="Unwarp (Pretty Print)">
            <AlignLeft size={16} />
          </ActionButton>

          <div className="w-px h-4 bg-white/10 mx-1"></div>
          
          <ActionButton onClick={handleCopy}>
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </ActionButton>
        </>
      )}
      
      <div className="relative ml-1" ref={downloadMenuRef}>
        <div className="flex bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">
          <button 
            onClick={(e) => { editorRef.current?.download(); handleInteraction(e); }} 
            className="p-1.5 text-white border-r border-blue-500/50 rounded-l-lg"
            title="Download (Default)"
          >
            <Download size={16} />
          </button>
          <button 
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            className="p-1 text-white hover:bg-blue-400/20 rounded-r-lg"
          >
            <ChevronDown size={12} />
          </button>
        </div>

        {showDownloadMenu && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 rounded-xl shadow-2xl border border-white/10 z-50 text-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-2 border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase bg-slate-950/50 tracking-wider">Save As</div>
            <div className="p-1">
              {[
                { ext: 'edi', label: 'EDI File', icon: <FileCode size={14} className="text-blue-400"/>, shortcut: 'Shift+E' },
                { ext: 'txt', label: 'Text File', icon: <FileText size={14} className="text-slate-400"/>, shortcut: 'Shift+T' },
                { ext: 'out', label: 'Output File', icon: <File size={14} className="text-emerald-400"/>, shortcut: 'Shift+O' },
                { ext: 'json', label: 'JSON Data', icon: <FileJson size={14} className="text-yellow-400"/>, shortcut: 'Shift+J' },
                { ext: 'xml', label: 'XML Document', icon: <Code size={14} className="text-orange-400"/>, shortcut: '' },
              ].map(item => (
                <button 
                  key={item.ext} 
                  onClick={() => { editorRef.current?.download(item.ext); setShowDownloadMenu(false); }} 
                  className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 hover:text-white font-medium transition-all flex items-center justify-between rounded-lg group"
                  title={`Download as .${item.ext}`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.shortcut && <span className="text-[9px] text-slate-600 group-hover:text-slate-500 border border-slate-700 rounded px-1">{item.shortcut}</span>}
                    <span className="text-[10px] text-slate-500 uppercase font-mono group-hover:text-slate-400">.{item.ext}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="h-px bg-white/5 mx-2 my-1"></div>
            <div className="p-1 pb-2">
                <button 
                    onClick={() => { 
                        const ext = prompt("Enter custom file extension (e.g. 'dat', 'log'):", "edi");
                        if (ext) {
                            editorRef.current?.download(ext.replace(/^\./, ''));
                        }
                        setShowDownloadMenu(false); 
                    }} 
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 hover:text-white font-medium transition-all text-blue-400 rounded-lg flex items-center gap-2"
                >
                    <SettingsIcon />
                    Custom Format...
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);

export default EditorToolbar;
