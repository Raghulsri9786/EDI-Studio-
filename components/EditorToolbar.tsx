
import React, { useMemo } from 'react';
import { Edit3, Eye, Settings2 } from 'lucide-react';
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

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editorRef, editorState, isBusinessView, ediContent }) => {
  
  const delimiters = useMemo(() => {
    if (!ediContent) return null;
    return detectDelimiters(ediContent);
  }, [ediContent]);

  const handleInteraction = (e: React.MouseEvent<HTMLButtonElement>) => {
    animateButtonPress(e.currentTarget);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    animateButtonHover(e.currentTarget, true);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    animateButtonHover(e.currentTarget, false);
  };

  // Helper to display invisible chars like newline
  const formatChar = (char: string) => {
    if (char === '\n' || char === '\r\n') return '↵';
    if (char === '\r') return 'CR';
    if (char === ' ') return '␣';
    if (char === '\t') return 'TAB';
    return char;
  };

  const ActionButton = ({ onClick, disabled, active, title, children }: any) => (
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
        `}
    >
        {children}
    </button>
  );

  return (
    <div className="flex items-center gap-3">
      {/* Delimiter Info Badge */}
      {!isBusinessView && delimiters && delimiters.standard !== 'UNKNOWN' && (
        <div className="group relative cursor-help hidden md:block">
            <div className="flex items-center gap-2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-400 hover:border-slate-500 transition-colors">
                <span className={`font-bold ${delimiters.standard === 'X12' ? 'text-blue-400' : 'text-purple-400'}`}>
                    {delimiters.standard}
                </span>
                <div className="w-px h-3 bg-slate-700"></div>
                <div className="flex gap-1.5">
                    <span title="Element Separator" className="text-slate-300 bg-white/5 px-1 rounded">{formatChar(delimiters.element)}</span>
                    <span title="Segment Terminator" className="text-slate-500">{formatChar(delimiters.segment)}</span>
                </div>
            </div>
            
            {/* Minimal Tooltip */}
            <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 text-xs">
                <div className="font-bold text-slate-300 mb-2 border-b border-white/5 pb-1 flex items-center gap-2">
                    <Settings2 size={12} /> Structure
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-y-1.5">
                    <span className="text-slate-500">Element:</span>
                    <code className="text-blue-300 bg-black/20 px-1.5 rounded">{formatChar(delimiters.element)}</code>
                    <span className="text-slate-500">Component:</span>
                    <code className="text-purple-300 bg-black/20 px-1.5 rounded">{formatChar(delimiters.component)}</code>
                    <span className="text-slate-500">Segment:</span>
                    <code className="text-emerald-300 bg-black/20 px-1.5 rounded">{formatChar(delimiters.segment)}</code>
                </div>
            </div>
        </div>
      )}

      {/* Primary View Toggles - Only essential controls remain */}
      <div className="bg-slate-800/50 rounded-lg p-0.5 border border-white/5 flex">
         <ActionButton onClick={() => editorRef.current?.toggleEditMode()} active={editorState.isEditing && !isBusinessView} title="Edit Source" disabled={isBusinessView}>
            <Edit3 size={14} />
         </ActionButton>
         <ActionButton onClick={() => editorRef.current?.toggleEditMode()} active={!editorState.isEditing && !isBusinessView} title="Visual Parser" disabled={!editorState.isEdiMode || isBusinessView}>
            <Eye size={14} />
         </ActionButton>
      </div>
    </div>
  );
};

export default EditorToolbar;
