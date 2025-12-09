
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, CaseSensitive, WholeWord, Regex, AlertOctagon, ChevronRight, ChevronDown } from 'lucide-react';
import { parseEdiToLines } from '../utils/ediParser';
import { ParsedLine, EdiToken, AppSettings, EditorValidationResult, LineError } from '../types';
import { validateRealTime } from '../utils/ediValidator';
import { warpEdi, unwarpEdi } from '../utils/ediFormatter';
import HoverInfo from './HoverInfo';
import { animatePanelEnter } from '../utils/gsapAnimations';

export interface EditorHandle {
  undo: () => void;
  redo: () => void;
  toggleEditMode: () => void;
  toggleVisualWrap: () => void;
  copy: () => void;
  download: (ext?: string) => void;
  toggleFind: () => void;
  insertSnippet: (text: string) => void;
  warp: () => void;
  unwarp: () => void;
}

export interface EditorState {
  canUndo: boolean;
  canRedo: boolean;
  isEditing: boolean;
  isVisualWrap: boolean;
  isEdiMode: boolean;
  isFindOpen: boolean;
}

interface EditorProps {
  content: string;
  onChange: (val: string) => void;
  fileName?: string;
  searchTerm?: string;
  settings?: AppSettings;
  onSave?: (customName?: string) => void;
  onStateChange?: (state: EditorState) => void;
}

interface EditorPopupState {
  token: EdiToken;
  x: number;
  y: number;
  segmentId: string;
  rawSegment: string;
  isPinned: boolean;
  validationError?: string; 
}

const Editor = forwardRef<EditorHandle, EditorProps>(({ 
  content, 
  onChange, 
  fileName = 'Untitled.txt', 
  searchTerm: externalSearchTerm = '', 
  settings = { fontSize: 'medium', showLineNumbers: true, theme: 'dark', aiModel: 'speed' },
  onSave,
  onStateChange
}, ref) => {
  const [collapsedLines, setCollapsedLines] = useState<Set<number>>(new Set());
  const [popupState, setPopupState] = useState<EditorPopupState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [validationResult, setValidationResult] = useState<EditorValidationResult | null>(null);
  const [visualWrap, setVisualWrap] = useState(false);
  const [history, setHistory] = useState<string[]>([content]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // GSAP Entry Animation
  useLayoutEffect(() => {
    if (containerRef.current) {
      animatePanelEnter(containerRef.current);
    }
  }, [fileName]); // Re-animate when switching files

  useEffect(() => {
    if (externalSearchTerm) {
      setFindText(externalSearchTerm);
      setIsFindOpen(true);
    }
  }, [externalSearchTerm]);

  const isEdiMode = useMemo(() => {
    const lower = fileName.toLowerCase();
    const cleanContent = content.trim();
    const looksLikeEdi = 
      cleanContent.startsWith('ISA') || cleanContent.startsWith('UNA') || 
      cleanContent.startsWith('UNB') || cleanContent.startsWith('GS') || 
      cleanContent.startsWith('ST');

    const isEdiExtension = 
      lower.endsWith('.edi') || lower.endsWith('.dat') || lower.endsWith('.x12') || 
      lower.endsWith('.out') || lower.endsWith('.int') || lower.endsWith('.txt');

    return isEdiExtension && looksLikeEdi;
  }, [fileName, content]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
      isEditing,
      isVisualWrap: visualWrap,
      isEdiMode: !!isEdiMode,
      isFindOpen
    });
  }, [historyIndex, history.length, isEditing, visualWrap, isEdiMode, isFindOpen, onStateChange]);

  // Validation Logic
  useEffect(() => {
    if (isEdiMode) {
      // Pass full content string for robust parsing/validation
      const result = validateRealTime(content);
      setValidationResult(result);
    } else {
      setValidationResult(null);
    }
  }, [content, isEdiMode]);

  // Auto-switch to edit mode if not EDI
  useEffect(() => {
    if (!isEdiMode) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [isEdiMode]);

  const updateContentWithHistory = (newContent: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContent);
    if (newHistory.length > 50) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onChange(newContent);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onChange(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onChange(next);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    }
  };

  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
    toggleEditMode: () => {
      if (isEdiMode) setIsEditing(!isEditing);
    },
    toggleVisualWrap: () => setVisualWrap(!visualWrap),
    copy: () => {
      navigator.clipboard.writeText(content);
    },
    download: (ext?: string) => {
      if (onSave) {
        if (ext) {
          // Replace existing extension or append new one
          const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
          onSave(`${nameWithoutExt}.${ext}`);
        } else {
          onSave(fileName);
        }
      }
    },
    toggleFind: () => setIsFindOpen(!isFindOpen),
    insertSnippet: (snippet: string) => {
      updateContentWithHistory(content + (content ? '\n' : '') + snippet);
    },
    warp: () => {
      const newContent = warpEdi(content);
      updateContentWithHistory(newContent);
    },
    unwarp: () => {
      const newContent = unwarpEdi(content);
      updateContentWithHistory(newContent);
    }
  }));

  const handleReplace = () => {
    if (!findText) return;
    try {
      let regexFlags = '';
      if (!matchCase) regexFlags += 'i';
      let regexPattern = findText;
      if (!useRegex) regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (matchWholeWord) regexPattern = `\\b${regexPattern}\\b`;
      const regex = new RegExp(regexPattern, regexFlags);
      const newContent = content.replace(regex, replaceText);
      if (newContent !== content) updateContentWithHistory(newContent);
    } catch(e) {}
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    try {
      let regexFlags = 'g';
      if (!matchCase) regexFlags += 'i';
      let regexPattern = findText;
      if (!useRegex) regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (matchWholeWord) regexPattern = `\\b${regexPattern}\\b`;
      const regex = new RegExp(regexPattern, regexFlags);
      const newContent = content.replace(regex, replaceText);
      updateContentWithHistory(newContent);
    } catch(e) {}
  };

  const lines = useMemo(() => {
    if (isEdiMode && !isEditing) {
      return parseEdiToLines(content);
    } else {
      return content.split(/\r?\n/).map((raw, i) => ({
        lineNumber: i + 1,
        raw,
        segmentId: '',
        indent: 0,
        isLoopStart: false,
        tokens: [{ type: 'ELEMENT', value: raw, index: 0 }] as EdiToken[]
      } as ParsedLine));
    }
  }, [content, isEdiMode, isEditing]);

  const toggleFold = (lineNum: number, endLine?: number) => {
    if (!endLine) return;
    const newSet = new Set(collapsedLines);
    if (newSet.has(lineNum)) newSet.delete(lineNum);
    else newSet.add(lineNum);
    setCollapsedLines(newSet);
  };

  const isLineVisible = (lineIndex: number) => {
    for (const start of collapsedLines) {
      const lineObj = lines[start];
      if (lineObj.loopEndLine && lineIndex > start && lineIndex <= lineObj.loopEndLine) {
        return false;
      }
    }
    return true;
  };

  const handleTokenEnter = (e: React.MouseEvent, token: EdiToken, line: ParsedLine, errorMsg?: string) => {
    if (!isEdiMode || isEditing) return; 
    if (popupState?.isPinned) return;
    if (hoverTimeout) clearTimeout(hoverTimeout);
    if (token.type === 'DELIMITER' || token.type === 'TERMINATOR') return;

    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    // Position hint: Pass the bottom-left corner of the token as the anchor.
    // The HoverInfo component will use smart positioning to flip it if it doesn't fit below.
    setPopupState({
      token,
      segmentId: line.segmentId,
      rawSegment: line.raw,
      x: rect.left,
      y: rect.bottom, 
      isPinned: false,
      validationError: errorMsg
    });
  };

  const handleTokenLeave = () => {
    if (popupState?.isPinned) return;
    const timeout = setTimeout(() => {
      setPopupState(prev => prev?.isPinned ? prev : null);
    }, 300); 
    setHoverTimeout(timeout);
  };

  const handleTokenClick = (e: React.MouseEvent, token: EdiToken, line: ParsedLine, errorMsg?: string) => {
    if (!isEdiMode || isEditing) return;
    e.stopPropagation(); 
    if (token.type === 'DELIMITER' || token.type === 'TERMINATOR') return;
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();

    setPopupState({
      token,
      segmentId: line.segmentId,
      rawSegment: line.raw,
      x: rect.left,
      y: rect.bottom,
      isPinned: true,
      validationError: errorMsg
    });
  };

  const handleBackgroundClick = () => {
    if (popupState?.isPinned) setPopupState(null);
  };
  
  const handleDoubleClick = () => {
    if (isEdiMode && !isEditing) setIsEditing(true);
  };

  const fontSizeClass = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  }[settings.fontSize];

  // Visual Wrap: if true, standard wrapping. If false, no wrap (horizontal scroll)
  const wrapClass = visualWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre';

  return (
    <div 
      className="flex flex-col h-full bg-slate-950 text-slate-300 relative"
      onClick={handleBackgroundClick}
      ref={containerRef}
    >
      {isFindOpen && (
        <div className="absolute top-2 right-4 left-4 z-20 bg-slate-900 border border-slate-700 p-2 rounded-lg shadow-xl animate-in slide-in-from-top-2 max-w-2xl mx-auto">
           <div className="flex flex-col gap-2">
             <div className="flex gap-2">
                <div className="relative flex-1 group">
                   <div className="absolute left-2.5 top-2 text-slate-500"><Search size={14}/></div>
                   <input type="text" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Find..." className="w-full bg-slate-950 border border-slate-700 rounded pl-8 pr-20 py-1 text-xs text-white focus:border-blue-500 outline-none transition-all" autoFocus />
                   <div className="absolute right-1 top-0.5 flex gap-0.5">
                      <button onClick={() => setMatchCase(!matchCase)} className={`p-1 rounded ${matchCase ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`} title="Match Case"><CaseSensitive size={12}/></button>
                      <button onClick={() => setMatchWholeWord(!matchWholeWord)} className={`p-1 rounded ${matchWholeWord ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`} title="Match Whole Word"><WholeWord size={12}/></button>
                      <button onClick={() => setUseRegex(!useRegex)} className={`p-1 rounded ${useRegex ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`} title="Use Regex"><Regex size={12}/></button>
                   </div>
                </div>
                <div className="flex-1 flex gap-2">
                   <input type="text" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replace..." className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none transition-all" />
                   <button onClick={handleReplace} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded hover:bg-slate-700 hover:text-white border border-white/5 transition-colors">Replace</button>
                   <button onClick={handleReplaceAll} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded hover:bg-slate-700 hover:text-white border border-white/5 transition-colors">All</button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 horizontal-scroll font-mono ${fontSizeClass} leading-6 relative bg-slate-950`} onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => updateContentWithHistory(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full h-full bg-slate-950 text-slate-500 p-6 resize-none outline-none font-mono ${wrapClass} selection:bg-blue-500/30 horizontal-scroll`}
            spellCheck={false}
          />
        ) : (
          /* 
             Horizontal Scrolling Logic:
             We use `w-fit` and `min-w-full` on the inner container. 
             This forces the container to grow beyond the viewport width if content is long and no-wrap is active.
             The parent `overflow-auto` handles the scrollbars.
          */
          <div className={`min-h-full pb-10 pt-2 pl-2 ${!visualWrap ? 'w-fit min-w-full' : 'w-full'}`} title="Double-click to edit">
            {lines.map((line, idx) => {
              if (!isLineVisible(idx)) return null;
              const isFolded = collapsedLines.has(idx);
              const errorsForLine = validationResult?.errors.filter(e => e.line === line.lineNumber && e.severity === 'ERROR') || [];
              const primaryError = errorsForLine[0];

              return (
                <div key={idx} className={`flex hover:bg-white/[0.02] group transition-colors relative ${primaryError ? 'bg-red-500/5' : ''}`}>
                  {settings.showLineNumbers && (
                    /* Sticky Line Numbers: position: sticky, left: 0 ensure they float above the scrolling content */
                    <div className="sticky left-0 z-10 w-12 flex-none bg-slate-950 text-slate-500 text-right pr-3 select-none flex items-center justify-end gap-1 border-r border-slate-800/50 relative py-0.5">
                      {primaryError && (
                         <div className="absolute left-1 top-1.5 text-red-500" title={primaryError.message}>
                           <AlertOctagon size={10} fill="currentColor" className="text-red-900" />
                         </div>
                      )}
                      {line.isLoopStart && line.loopEndLine ? (
                        <button onClick={(e) => { e.stopPropagation(); toggleFold(idx, line.loopEndLine); }} className="text-slate-600 hover:text-blue-400 focus:outline-none transition-colors">
                          {isFolded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </button>
                      ) : <span className="w-3"></span>}
                      <span className="text-[10px] font-medium opacity-60">{line.lineNumber}</span>
                    </div>
                  )}

                  {/* Content Line */}
                  <div className={`flex-1 pl-3 ${!settings.showLineNumbers ? 'pl-6' : ''}`}>
                    <div style={{ paddingLeft: isEdiMode ? `${line.indent * 16}px` : '0px' }} className={`flex items-center ${wrapClass} py-0.5`}>
                      {isFolded ? (
                        <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-xs cursor-pointer select-none border border-slate-700 hover:border-slate-500 transition-colors" onClick={(e) => { e.stopPropagation(); toggleFold(idx, line.loopEndLine); }}>... Loop Collapsed ...</span>
                      ) : (
                        line.tokens.map((token, tIdx) => {
                          let colorClass = 'text-slate-300';
                          if (isEdiMode) {
                              if (token.type === 'SEGMENT_ID') colorClass = 'text-purple-400 font-bold';
                              else if (token.type === 'DELIMITER' || token.type === 'TERMINATOR') colorClass = 'text-slate-600';
                              else if (token.type === 'ELEMENT') colorClass = 'text-blue-300';
                          } else {
                              if (line.raw.trim().startsWith('<') && line.raw.includes('>')) colorClass = 'text-orange-300';
                              else if (line.raw.trim().startsWith('{') || line.raw.trim().startsWith('"')) colorClass = 'text-emerald-300';
                          }

                          let isSearchMatch = false;
                          if (findText) {
                             if (!useRegex && !matchWholeWord && !matchCase) isSearchMatch = token.value.toLowerCase().includes(findText.toLowerCase());
                             else isSearchMatch = token.value.includes(findText);
                          }
                          
                          const tokenError = errorsForLine.find(e => e.tokenIndex === token.index || e.tokenIndex === -1);
                          let errorDecoration = '';
                          if (tokenError) {
                              errorDecoration = 'underline decoration-red-500 decoration-wavy underline-offset-2';
                          }

                          const searchClass = isSearchMatch ? 'bg-yellow-500/20 text-yellow-200 ring-1 ring-yellow-500/50 rounded-sm' : '';
                          const isActive = popupState && popupState.token === token;

                          return (
                            <span
                              key={tIdx}
                              className={`${colorClass} ${searchClass} ${isActive ? 'bg-white/10 ring-1 ring-white/20 rounded' : ''} ${errorDecoration} hover:text-white transition-colors duration-100 relative select-none cursor-pointer`}
                              onMouseEnter={(e) => handleTokenEnter(e, token, line, tokenError ? tokenError?.message : undefined)}
                              onMouseLeave={handleTokenLeave}
                              onClick={(e) => handleTokenClick(e, token, line, tokenError ? tokenError?.message : undefined)}
                            >
                              {token.value}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {popupState && (
        <HoverInfo 
          token={popupState.token} 
          position={{ x: popupState.x, y: popupState.y }} 
          segmentId={popupState.segmentId}
          rawSegment={popupState.rawSegment}
          isPinned={popupState.isPinned}
          validationError={popupState.validationError}
          onClose={() => setPopupState(null)}
        />
      )}
    </div>
  );
});

export default Editor;
