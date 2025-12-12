
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
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

// Simple Tokenizer for Non-EDI files (JSON, XML, CSV)
const genericTokenizer = (text: string, format: 'json' | 'xml' | 'csv' | 'text'): EdiToken[] => {
  const tokens: EdiToken[] = [];
  let index = 0;

  if (format === 'json') {
    const regex = /(".*?"|[-+]?[0-9]*\.?[0-9]+|true|false|null|[{}\[\],:])/g;
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({ type: 'ELEMENT', value: text.substring(lastIndex, match.index), index });
        index++;
      }
      const val = match[0];
      let type: any = 'ELEMENT';
      if (val.startsWith('"')) type = 'ELEMENT'; 
      else if (['{','}','[',']',','].includes(val)) type = 'DELIMITER';
      else if (val === ':') type = 'DELIMITER'; 
      else if (['true','false','null'].includes(val)) type = 'SEGMENT_ID'; 
      else if (!isNaN(Number(val))) type = 'TERMINATOR'; 
      tokens.push({ type: type, value: val, index });
      index++;
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) tokens.push({ type: 'ELEMENT', value: text.substring(lastIndex), index });
  } 
  else if (format === 'xml') {
    const regex = /(<\/?[a-zA-Z0-9_\-:]+[^>]*>|"[^"]*")/g;
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
       if (match.index > lastIndex) {
         tokens.push({ type: 'ELEMENT', value: text.substring(lastIndex, match.index), index });
         index++;
       }
       const val = match[0];
       let type: any = 'ELEMENT';
       if (val.startsWith('<')) type = 'SEGMENT_ID'; 
       else if (val.startsWith('"')) type = 'TERMINATOR'; 
       tokens.push({ type: type, value: val, index });
       index++;
       lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) tokens.push({ type: 'ELEMENT', value: text.substring(lastIndex), index });
  }
  else if (format === 'csv') {
      const parts = text.split(',');
      parts.forEach((p, i) => {
          if (i > 0) tokens.push({ type: 'DELIMITER', value: ',', index: -1 });
          tokens.push({ type: 'ELEMENT', value: p, index: i });
      });
  }
  else {
      tokens.push({ type: 'ELEMENT', value: text, index: 0 });
  }
  return tokens;
};

// Fixed row height for virtualization
const ROW_HEIGHT = 24;

// Color Logic
const getTokenColor = (token: EdiToken, format: string, isEdiMode: boolean) => {
    if (format === 'json') {
        if (token.type === 'SEGMENT_ID') return 'text-blue-400 font-bold'; 
        if (token.type === 'DELIMITER') return 'text-slate-500'; 
        if (token.type === 'TERMINATOR') return 'text-emerald-400'; 
        if (token.value.startsWith('"') && token.value.endsWith('":')) return 'text-sky-300 font-semibold'; 
        if (token.value.startsWith('"')) return 'text-amber-300'; 
    } 
    else if (format === 'xml') {
        if (token.type === 'SEGMENT_ID') return 'text-blue-400'; 
        if (token.type === 'TERMINATOR') return 'text-amber-300'; 
        if (token.value.includes('=')) return 'text-sky-300'; 
    }
    else if (format === 'csv') {
        if (token.type === 'DELIMITER') return 'text-slate-600 bg-slate-800/50';
        return 'text-slate-300 group-hover:text-white';
    }
    else if (isEdiMode) {
        // Minimal & Professional Theme
        if (token.type === 'SEGMENT_ID') return 'text-[#9FC5FF] font-semibold tracking-wide'; 
        if (token.type === 'DELIMITER') return 'text-slate-700'; 
        if (token.type === 'TERMINATOR') return 'text-slate-700'; 
        if (token.type === 'ELEMENT') return 'text-[#E0E5F0]'; 
    }
    
    return 'text-slate-300';
};

interface EditorRowProps {
  line: ParsedLine;
  style: React.CSSProperties;
  originalIndex: number;
  isFolded: boolean;
  errors: LineError[];
  settings: AppSettings;
  isEdiMode: boolean;
  fileFormat: string;
  findText: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
  popupToken: EdiToken | null;
  onToggleFold: (lineIndex: number, endLine: number) => void;
  onTokenEnter: (e: React.MouseEvent, token: EdiToken, line: ParsedLine, errorMsg?: string) => void;
  onTokenLeave: () => void;
  onTokenClick: (e: React.MouseEvent, token: EdiToken, line: ParsedLine, errorMsg?: string) => void;
  visualWrap: boolean;
}

const EditorRow = React.memo(({
  line,
  style,
  originalIndex,
  isFolded,
  errors,
  settings,
  isEdiMode,
  fileFormat,
  findText,
  matchCase,
  matchWholeWord,
  useRegex,
  popupToken,
  onToggleFold,
  onTokenEnter,
  onTokenLeave,
  onTokenClick,
  visualWrap
}: EditorRowProps) => {
  const wrapClass = visualWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre';
  const primaryError = errors[0];

  return (
    <div className={`flex hover:bg-[#2a2d2e] group transition-colors relative ${primaryError ? 'bg-red-500/10' : ''}`} style={style}>
      {settings.showLineNumbers && (
        <div className="sticky left-0 z-10 w-12 flex-none bg-[#1e1e1e] text-[#858585] text-right pr-3 select-none flex items-center justify-end gap-1 border-r border-[#333333] relative py-0.5">
          {primaryError && (
            <div className="absolute left-1 top-1.5 text-red-500" title={primaryError.message}>
              <AlertOctagon size={10} fill="currentColor" className="text-red-900" />
            </div>
          )}
          {line.isLoopStart && line.loopEndLine ? (
            <button onClick={(e) => { e.stopPropagation(); onToggleFold(originalIndex, line.loopEndLine!); }} className="text-[#858585] hover:text-white focus:outline-none transition-colors">
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
            <span className="bg-[#333333] text-[#cccccc] px-2 py-0.5 rounded text-xs cursor-pointer select-none border border-[#444444] hover:border-[#666666] transition-colors" onClick={(e) => { e.stopPropagation(); onToggleFold(originalIndex, line.loopEndLine!); }}>...</span>
          ) : (
            line.tokens.map((token, tIdx) => {
              const colorClass = getTokenColor(token, isEdiMode ? 'edi' : fileFormat, isEdiMode);

              let isSearchMatch = false;
              if (findText) {
                const text = token.value;
                if (!useRegex && !matchWholeWord && !matchCase) {
                    isSearchMatch = text.toLowerCase().includes(findText.toLowerCase());
                } else if (!useRegex && !matchWholeWord && matchCase) {
                    isSearchMatch = text.includes(findText);
                } else if (!useRegex && matchWholeWord) {
                    isSearchMatch = text === findText;
                } else {
                    try {
                        const regex = new RegExp(findText, matchCase ? '' : 'i');
                        isSearchMatch = regex.test(text);
                    } catch (e) {}
                }
              }
              
              const tokenError = errors.find(e => e.tokenIndex === token.index || e.tokenIndex === -1);
              let errorDecoration = '';
              if (tokenError) {
                  errorDecoration = 'underline decoration-red-500 decoration-wavy underline-offset-2';
              }

              const searchClass = isSearchMatch ? 'bg-yellow-500/40 text-white ring-1 ring-yellow-500/50 rounded-sm' : '';
              const isActive = popupToken === token;

              return (
                <span
                  key={tIdx}
                  className={`${colorClass} ${searchClass} ${isActive ? 'bg-white/10 ring-1 ring-white/20 rounded' : ''} ${errorDecoration} hover:brightness-110 transition-colors duration-75 relative select-none cursor-pointer`}
                  onMouseEnter={(e) => onTokenEnter(e, token, line, tokenError?.message)}
                  onMouseLeave={onTokenLeave}
                  onClick={(e) => onTokenClick(e, token, line, tokenError?.message)}
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
});

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
  
  // Virtualization State
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600); 
  
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const updateHeight = () => {
        if(scrollContainerRef.current) setContainerHeight(scrollContainerRef.current.clientHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(scrollContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (containerRef.current) animatePanelEnter(containerRef.current);
  }, [fileName]);

  useEffect(() => {
    if (externalSearchTerm) {
      setFindText(externalSearchTerm);
      setIsFindOpen(true);
    }
  }, [externalSearchTerm]);

  const fileFormat = useMemo(() => {
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.json')) return 'json';
      if (lower.endsWith('.xml') || lower.endsWith('.xsd') || lower.endsWith('.xslt')) return 'xml';
      if (lower.endsWith('.csv')) return 'csv';
      return 'text';
  }, [fileName]);

  const isEdiMode = useMemo(() => {
    const lower = fileName.toLowerCase();
    const cleanContent = content.trim();
    const looksLikeEdi = 
      cleanContent.startsWith('ISA') || cleanContent.startsWith('UNA') || 
      cleanContent.startsWith('UNB') || cleanContent.startsWith('GS') || 
      cleanContent.startsWith('ST') || cleanContent.match(/^[A-Z0-9]{2,3}[*|]/);

    const isEdiExtension = 
      lower.endsWith('.edi') || lower.endsWith('.dat') || lower.endsWith('.x12') || 
      lower.endsWith('.out') || lower.endsWith('.int') || lower.endsWith('.txt');

    return (isEdiExtension && !!looksLikeEdi) || lower.endsWith('.edi');
  }, [fileName, content]);

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

  useEffect(() => {
    if (isEdiMode) {
      const result = validateRealTime(content);
      setValidationResult(result);
    } else {
      setValidationResult(null);
    }
  }, [content, isEdiMode]);

  useEffect(() => {
    if (!isEdiMode && !fileName.endsWith('.json') && !fileName.endsWith('.xml')) {
      setIsEditing(true); 
    } else {
      setIsEditing(false);
    }
  }, [fileName, isEdiMode]);

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
        if (e.shiftKey) handleRedo(); else handleUndo();
      } else if (e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    }
  };

  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    redo: handleRedo,
    toggleEditMode: () => setIsEditing(!isEditing),
    toggleVisualWrap: () => setVisualWrap(!visualWrap),
    copy: () => navigator.clipboard.writeText(content),
    download: (ext?: string) => {
      if (onSave) {
        if (ext) {
          const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
          onSave(`${nameWithoutExt}.${ext}`);
        } else {
          onSave(fileName);
        }
      }
    },
    toggleFind: () => setIsFindOpen(!isFindOpen),
    insertSnippet: (snippet: string) => updateContentWithHistory(content + (content ? '\n' : '') + snippet),
    warp: () => updateContentWithHistory(warpEdi(content)),
    unwarp: () => updateContentWithHistory(unwarpEdi(content))
  }));

  const handleReplace = () => {
    if (!findText) return;
    try {
      let regexFlags = matchCase ? '' : 'i';
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
      let regexFlags = matchCase ? 'g' : 'gi';
      let regexPattern = findText;
      if (!useRegex) regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (matchWholeWord) regexPattern = `\\b${regexPattern}\\b`;
      const regex = new RegExp(regexPattern, regexFlags);
      const newContent = content.replace(regex, replaceText);
      updateContentWithHistory(newContent);
    } catch(e) {}
  };

  const lines = useMemo(() => {
    if (isEdiMode && !isEditing) return parseEdiToLines(content);
    return content.split(/\r?\n/).map((raw, i) => ({
      lineNumber: i + 1,
      raw,
      segmentId: '',
      indent: 0,
      isLoopStart: false,
      tokens: genericTokenizer(raw, fileFormat)
    } as ParsedLine));
  }, [content, isEdiMode, isEditing, fileFormat]);

  const toggleFold = useCallback((lineNum: number, endLine?: number) => {
    if (!endLine) return;
    setCollapsedLines(prev => {
        const newSet = new Set(prev);
        if (newSet.has(lineNum)) newSet.delete(lineNum);
        else newSet.add(lineNum);
        return newSet;
    });
  }, []);

  const visibleLines = useMemo(() => {
    if (collapsedLines.size === 0) return lines;
    const hiddenIndices = new Set<number>();
    for (const start of collapsedLines) {
        const lineObj = lines[start];
        if (lineObj?.loopEndLine) {
            for (let k = start + 1; k <= lineObj.loopEndLine; k++) hiddenIndices.add(k);
        }
    }
    if (hiddenIndices.size === 0) return lines;
    return lines.filter((_, idx) => !hiddenIndices.has(idx));
  }, [lines, collapsedLines]);

  const isVirtualizationEnabled = !visualWrap && visibleLines.length > 50;
  
  const { virtualItems, totalHeight, translateY } = useMemo(() => {
      if (!isVirtualizationEnabled) {
          return { virtualItems: visibleLines, totalHeight: 'auto', translateY: 0 };
      }
      const count = visibleLines.length;
      const total = count * ROW_HEIGHT;
      const buffer = 15; // Increased buffer for smoother scroll
      const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - buffer);
      const endIndex = Math.min(count, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + buffer);
      const items = visibleLines.slice(startIndex, endIndex);
      const offsetY = startIndex * ROW_HEIGHT;
      return { virtualItems: items, totalHeight: total, translateY: offsetY };
  }, [visibleLines, scrollTop, containerHeight, isVirtualizationEnabled, visualWrap]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
  };

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
    }
  };

  const handleTokenEnter = useCallback((e: React.MouseEvent, token: EdiToken, line: ParsedLine, errorMsg?: string) => {
    if (popupState?.isPinned) return; // Note: popupState is in closure, use ref if needed for latest state in callback
    clearHoverTimeout();
    if (token.type === 'DELIMITER' || token.type === 'TERMINATOR') return;
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    setPopupState({
      token,
      segmentId: line.segmentId,
      rawSegment: line.raw,
      x: rect.left,
      y: rect.bottom, 
      isPinned: false,
      validationError: errorMsg
    });
  }, [popupState?.isPinned]);

  const handleTokenLeave = useCallback(() => {
    if (popupState?.isPinned) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setPopupState(null);
    }, 300);
  }, [popupState?.isPinned]);

  const handleTokenClick = useCallback((e: React.MouseEvent, token: EdiToken, line: ParsedLine, errorMsg?: string) => {
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
  }, []);

  const handlePopupMouseEnter = () => clearHoverTimeout();
  const handlePopupMouseLeave = () => { if (!popupState?.isPinned) setPopupState(null); };
  const handleBackgroundClick = () => { if (popupState?.isPinned) setPopupState(null); };
  const handleDoubleClick = () => { if (isEdiMode && !isEditing) setIsEditing(true); };
  const handlePinPopup = () => setPopupState(prev => prev ? { ...prev, isPinned: !prev.isPinned } : null);

  const fontSizeClass = { small: 'text-xs', medium: 'text-sm', large: 'text-base' }[settings.fontSize];
  const wrapClass = visualWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre';

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-slate-300 relative" onClick={handleBackgroundClick} ref={containerRef}>
      {isFindOpen && (
        <div className="absolute top-2 right-4 left-4 z-20 bg-[#252526] border border-[#3e3e42] p-2 rounded-lg shadow-xl animate-in slide-in-from-top-2 max-w-2xl mx-auto ring-1 ring-black/20">
           <div className="flex flex-col gap-2">
             <div className="flex gap-2">
                <div className="relative flex-1 group">
                   <div className="absolute left-2.5 top-2 text-slate-500"><Search size={14}/></div>
                   <input type="text" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Find..." className="w-full bg-[#1e1e1e] border border-[#3e3e42] rounded pl-8 pr-20 py-1 text-xs text-white focus:border-blue-500 outline-none transition-all" autoFocus />
                   <div className="absolute right-1 top-0.5 flex gap-0.5">
                      <button onClick={() => setMatchCase(!matchCase)} className={`p-1 rounded ${matchCase ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`} title="Match Case"><CaseSensitive size={12}/></button>
                      <button onClick={() => setMatchWholeWord(!matchWholeWord)} className={`p-1 rounded ${matchWholeWord ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`} title="Match Whole Word"><WholeWord size={12}/></button>
                      <button onClick={() => setUseRegex(!useRegex)} className={`p-1 rounded ${useRegex ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-white'}`} title="Use Regex"><Regex size={12}/></button>
                   </div>
                </div>
                <div className="flex-1 flex gap-2">
                   <input type="text" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replace..." className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none transition-all" />
                   <button onClick={handleReplace} className="px-2 py-1 bg-[#333333] text-slate-300 text-xs font-medium rounded hover:bg-[#444444] hover:text-white border border-white/5 transition-colors">Replace</button>
                   <button onClick={handleReplaceAll} className="px-2 py-1 bg-[#333333] text-slate-300 text-xs font-medium rounded hover:bg-[#444444] hover:text-white border border-white/5 transition-colors">All</button>
                </div>
             </div>
           </div>
        </div>
      )}

      <div ref={scrollContainerRef} onScroll={handleScroll} className={`flex-1 horizontal-scroll font-mono ${fontSizeClass} leading-6 relative bg-[#1e1e1e]`} onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => updateContentWithHistory(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full h-full bg-[#1e1e1e] text-[#d4d4d4] p-6 resize-none outline-none font-mono ${wrapClass} selection:bg-blue-500/30 horizontal-scroll`}
            spellCheck={false}
          />
        ) : (
          <div className={`pb-10 pt-2 pl-2 ${!visualWrap ? 'w-fit min-w-full' : 'w-full'}`} title="Double-click to edit" style={{ height: isVirtualizationEnabled ? totalHeight : 'auto', position: 'relative' }}>
            <div style={{ transform: `translateY(${translateY}px)` }}>
                {virtualItems.map((line) => {
                  const originalIndex = line.lineNumber - 1; 
                  const isFolded = collapsedLines.has(originalIndex);
                  const errorsForLine = validationResult?.errors.filter(e => e.line === line.lineNumber && e.severity === 'ERROR') || [];
                  
                  return (
                    <EditorRow 
                      key={line.lineNumber}
                      line={line}
                      style={{ height: ROW_HEIGHT }}
                      originalIndex={originalIndex}
                      isFolded={isFolded}
                      errors={errorsForLine}
                      settings={settings}
                      isEdiMode={isEdiMode}
                      fileFormat={fileFormat}
                      findText={findText}
                      matchCase={matchCase}
                      matchWholeWord={matchWholeWord}
                      useRegex={useRegex}
                      popupToken={popupState?.token || null}
                      onToggleFold={toggleFold}
                      onTokenEnter={handleTokenEnter}
                      onTokenLeave={handleTokenLeave}
                      onTokenClick={handleTokenClick}
                      visualWrap={visualWrap}
                    />
                  );
                })}
            </div>
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
          onPin={handlePinPopup}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        />
      )}
    </div>
  );
});

export default Editor;
