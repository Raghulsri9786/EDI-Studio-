
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Search, CaseSensitive, WholeWord, Regex, AlertOctagon, ChevronRight, ChevronDown, XCircle, Sparkles, Loader2, Check, AlertTriangle, Lock } from 'lucide-react';
import { parseEdiToLines } from '../utils/ediParser';
import { ParsedLine, EdiToken, AppSettings, EditorValidationResult, LineError, ElementSchema } from '../types';
import { validateRealTime } from '../utils/ediValidator';
import { warpEdi, unwarpEdi } from '../utils/ediFormatter';
import { generateEdiFix, hasValidApiKey } from '../services/geminiService';
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
  scrollToLine: (line: number) => void;
  jumpToNextError: () => void;
  jumpToPrevError: () => void;
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

// Simple Tokenizer for Non-EDI files
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
  else {
      tokens.push({ type: 'ELEMENT', value: text, index: 0 });
  }
  return tokens;
};

// Fixed row height for virtualization (only used when no errors present)
const ROW_HEIGHT = 24;

/**
 * REFINED SYNTAX HIGHLIGHTING LOGIC
 * Optimized for Dark Mode (Slate 950 Background)
 */
const getTokenColor = (token: EdiToken, format: string, isEdiMode: boolean) => {
    if (format === 'json') {
        if (token.type === 'SEGMENT_ID') return 'text-purple-400 font-bold'; // true, false, null
        if (token.type === 'DELIMITER') return 'text-slate-500'; // brackets, commas
        if (token.type === 'TERMINATOR') return 'text-orange-300 font-mono'; // numbers
        if (token.value.startsWith('"') && token.value.endsWith('":')) return 'text-sky-300 font-semibold'; // Keys
        if (token.value.startsWith('"')) return 'text-emerald-300'; // String values
    } 
    
    if (isEdiMode) {
        if (token.type === 'SEGMENT_ID') {
            const val = token.value;
            // ENVELOPES & CONTROL (Rose/Red-ish)
            if (['ISA', 'GS', 'ST', 'UNB', 'UNG', 'UNH', 'IEA', 'GE', 'SE', 'UNZ', 'UNE', 'UNT'].includes(val)) {
                return 'text-rose-400 font-bold tracking-tight';
            }
            
            // LOOP STARTERS & KEY SEGMENTS (Vivid Blue)
            if (['N1', 'NM1', 'PO1', 'IT1', 'HL', 'LIN', 'LX', 'ENT', 'NAD', 'S5', 'R4', 'REF', 'CLM', 'BHT'].includes(val)) {
                 return 'text-sky-400 font-bold'; 
            }

            // COMMENTS & DOCUMENTATION SEGMENTS (Dimmed Gray)
            if (['MSG', 'NTE', 'PID', 'G69', 'FTX'].includes(val)) {
                return 'text-slate-500 italic font-medium';
            }

            // STANDARD SEGMENTS (Light Blue)
            return 'text-blue-300 font-semibold'; 
        }
        
        // STRUCTURAL DELIMITERS (Amber/Zinc - subtle but distinct)
        if (token.type === 'DELIMITER' || token.type === 'TERMINATOR') {
            return 'text-slate-500 font-bold opacity-60'; 
        }
        
        // DATA ELEMENTS (Typed Coloring)
        if (token.type === 'ELEMENT') {
            const schema = token.schema as ElementSchema | undefined;
            if (schema) {
                switch(schema.type) {
                    case 'DT': // DATE
                    case 'TM': // TIME
                        return 'text-emerald-400 font-mono';
                    case 'N0': // INTEGER
                    case 'N2': // DECIMAL
                    case 'R':  // REAL
                        return 'text-orange-300 font-mono';
                    case 'ID': // IDENTIFIER / QUALIFIER
                        return 'text-indigo-300 font-semibold';
                    case 'AN': // ALPHANUMERIC
                    default: 
                        return 'text-slate-100';
                }
            }
            // Default element color if no schema
            return 'text-slate-200'; 
        }
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
  onApplyFix: (line: number, newText: string) => void;
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
  visualWrap,
  onApplyFix
}: EditorRowProps) => {
  const [isErrorOpen, setIsErrorOpen] = useState(false);
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);
  const [aiFix, setAiFix] = useState<{ segment: string, explanation: string } | null>(null);

  const wrapClass = visualWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre';
  
  const hasCriticalError = errors.some(e => e.severity === 'ERROR');
  const hasWarning = errors.some(e => e.severity === 'WARNING');
  const hasError = hasCriticalError || hasWarning;

  // Fix property access errors by using hasValidApiKey helper
  const hasApiKey = hasValidApiKey(settings.aiProvider);

  let rowBgClass = 'hover:bg-white/[0.03]';
  if (hasCriticalError) {
      rowBgClass = 'bg-red-500/10';
  } else if (hasWarning) {
      rowBgClass = 'bg-amber-500/10';
  } else if (isEdiMode && line.isLoopStart) {
      rowBgClass = 'bg-sky-500/[0.03] hover:bg-sky-500/[0.06]';
  }

  // We override fixed height if there are errors to display the block
  const containerStyle = (hasError && isErrorOpen) ? { ...style, height: 'auto' } : style;

  const handleAiFix = async () => {
      if (!hasApiKey) return;
      const targetError = errors.find(e => e.severity === 'ERROR') || errors[0];
      if (!targetError) return;
      setIsGeneratingFix(true);
      try {
          const context = line.raw; // Simple context for now
          const result = await generateEdiFix(line.raw, targetError.message, context);
          if (result) setAiFix(result);
      } catch (error) {
          console.error("Fix failed", error);
      } finally {
          setIsGeneratingFix(false);
      }
  };

  return (
    <div className={`group transition-colors relative flex flex-col ${rowBgClass}`} style={containerStyle}>
      <div className="flex relative">
        {/* Gutter */}
        {settings.showLineNumbers && (
            <div className="sticky left-0 z-20 w-12 flex-none bg-slate-900/40 text-slate-500 text-right pr-3 select-none flex items-center justify-end gap-1 border-r border-white/5 relative py-0.5 self-stretch">
            {hasError && (
                <div 
                    onClick={(e) => { e.stopPropagation(); setIsErrorOpen(!isErrorOpen); }}
                    className="absolute left-1 top-1.5 cursor-pointer hover:scale-110 transition-transform" 
                    title={`${errors.length} Issues - Click to view`}
                >
                  {hasCriticalError ? (
                      <XCircle size={12} fill="currentColor" className="text-red-500" />
                  ) : (
                      <AlertTriangle size={12} fill="currentColor" className="text-amber-500" />
                  )}
                </div>
            )}
            {line.isLoopStart && line.loopEndLine ? (
                <button onClick={(e) => { e.stopPropagation(); onToggleFold(originalIndex, line.loopEndLine!); }} className="text-slate-500 hover:text-white focus:outline-none transition-colors">
                {isFolded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
            ) : <span className="w-3"></span>}
            <span className="text-[10px] font-medium opacity-60">{line.lineNumber}</span>
            </div>
        )}

        {/* Content Line */}
        <div className={`flex-1 pl-3 ${!settings.showLineNumbers ? 'pl-6' : ''} relative`}>
            {/* Indentation Guides */}
            {isEdiMode && line.indent > 0 && (
                <div className="absolute top-0 bottom-0 left-3 flex select-none pointer-events-none z-0">
                    {Array.from({ length: line.indent }).map((_, i) => (
                        <div key={i} className="w-4 border-l border-white/[0.04] h-full" />
                    ))}
                </div>
            )}

            <div 
                style={{ paddingLeft: isEdiMode ? `${line.indent * 16}px` : '0px' }} 
                className={`flex items-center ${visualWrap ? 'flex-wrap' : ''} ${wrapClass} py-0.5 relative z-10`}
            >
            {isFolded ? (
                <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold cursor-pointer select-none border border-white/5 hover:border-white/20 transition-colors" onClick={(e) => { e.stopPropagation(); onToggleFold(originalIndex, line.loopEndLine!); }}>Folding Loop...</span>
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
                
                const tokenIssue = errors.find(e => e.tokenIndex === token.index || e.tokenIndex === -1);
                let errorDecoration = '';
                if (tokenIssue) {
                    if (tokenIssue.severity === 'ERROR') {
                        errorDecoration = 'underline decoration-red-500/50 decoration-wavy underline-offset-4';
                    } else {
                        errorDecoration = 'underline decoration-amber-500/50 decoration-wavy underline-offset-4';
                    }
                }

                const searchClass = isSearchMatch ? 'bg-yellow-500/40 text-white ring-1 ring-yellow-500/50 rounded-sm' : '';
                const isActive = popupToken === token;

                return (
                    <span
                    key={tIdx}
                    className={`${colorClass} ${searchClass} ${isActive ? 'bg-white/10 ring-1 ring-white/20 rounded' : ''} ${errorDecoration} hover:brightness-125 transition-all duration-150 relative select-none cursor-pointer`}
                    onMouseEnter={(e) => onTokenEnter(e, token, line, tokenIssue?.message)}
                    onMouseLeave={onTokenLeave}
                    onClick={(e) => onTokenClick(e, token, line, tokenIssue?.message)}
                    >
                    {token.value}
                    </span>
                );
                })
            )}
            </div>
        </div>
      </div>

      {/* Inline Error Block (Expanded) */}
      {!isFolded && hasError && isErrorOpen && (
        <div className="pl-12 pr-4 pb-4 pt-2 relative z-0">
            {errors.map((err, idx) => (
                <div key={idx} className={`border rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 mb-2 ${err.severity === 'ERROR' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                    <div className="flex gap-4">
                        <div className={`flex-none pt-0.5 ${err.severity === 'ERROR' ? 'text-red-500' : 'text-amber-500'}`}>
                            {err.severity === 'ERROR' ? <AlertOctagon size={18} /> : <AlertTriangle size={18} />}
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-xs font-bold mb-1 uppercase tracking-wider ${err.severity === 'ERROR' ? 'text-red-400' : 'text-amber-400'}`}>
                                {err.code ? `${err.code}: ` : ''}{err.severity === 'ERROR' ? 'Structural Error' : 'Validation Warning'}
                            </h4>
                            <p className={`text-sm font-sans leading-relaxed mb-4 ${err.severity === 'ERROR' ? 'text-slate-200' : 'text-slate-300'}`}>
                                {err.message}
                            </p>
                            
                            {/* AI Fix Section */}
                            {(aiFix || err.fix) ? (
                                <div className="mt-2 bg-black/40 rounded-xl p-3 border border-white/5 shadow-inner">
                                    <div className="text-[10px] text-emerald-400 font-bold mb-2 flex items-center gap-1.5 uppercase tracking-widest">
                                        <Sparkles size={12} /> AI Proposed Fix
                                    </div>
                                    <div className="font-mono text-xs text-emerald-100 bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/20 mb-3 overflow-x-auto">
                                        {aiFix?.segment || err.fix}
                                    </div>
                                    {aiFix?.explanation && (
                                        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                                            {aiFix.explanation}
                                        </p>
                                    )}
                                    <button 
                                        onClick={() => onApplyFix(line.lineNumber, aiFix?.segment || err.fix!)}
                                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                                    >
                                        <Check size={14} /> Apply Change
                                    </button>
                                </div>
                            ) : (
                                err.severity === 'ERROR' && (
                                    <button 
                                        onClick={handleAiFix}
                                        disabled={isGeneratingFix}
                                        className={`px-4 py-2 border text-xs font-bold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 ${
                                            hasApiKey 
                                            ? 'bg-blue-600/10 hover:bg-blue-600 border-blue-500/30 text-blue-200 hover:text-white shadow-lg' 
                                            : 'bg-slate-800 border-slate-700 text-slate-500'
                                        }`}
                                        title={hasApiKey ? "Generate fix with AI" : "API Key Required"}
                                    >
                                        {isGeneratingFix ? <Loader2 size={14} className="animate-spin" /> : (hasApiKey ? <Sparkles size={14} /> : <Lock size={14} />)}
                                        {hasApiKey ? "Request AI Repair" : "AI Fix Locked"}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
});

const Editor = forwardRef<EditorHandle, EditorProps>(({ 
  content, 
  onChange, 
  fileName = 'Untitled.txt', 
  searchTerm: externalSearchTerm = '', 
  settings = { fontSize: 'medium', showLineNumbers: true, theme: 'dark', aiModel: 'speed', aiProvider: 'gemini' },
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
      if (lower.endsWith('.pdf')) return 'pdf';
      return 'text';
  }, [fileName]);

  const isEdiMode = useMemo(() => {
    const lower = fileName.toLowerCase();
    const cleanContent = content.trim();
    if (fileFormat === 'pdf') return false;

    const looksLikeEdi = 
      cleanContent.startsWith('ISA') || cleanContent.startsWith('UNA') || 
      cleanContent.startsWith('UNB') || cleanContent.startsWith('GS') || 
      cleanContent.startsWith('ST') || cleanContent.match(/^[A-Z0-9]{2,3}[*|]/);

    const isEdiExtension = 
      lower.endsWith('.edi') || lower.endsWith('.dat') || lower.endsWith('.x12') || 
      lower.endsWith('.out') || lower.endsWith('.int') || lower.endsWith('.txt');

    return (isEdiExtension && !!looksLikeEdi) || lower.endsWith('.edi');
  }, [fileName, content, fileFormat]);

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
    if (!isEdiMode && !fileName.endsWith('.json') && !fileName.endsWith('.xml') && !fileName.endsWith('.pdf')) {
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

  const handleJumpToNextError = () => {
      if (!validationResult || validationResult.errors.length === 0 || !scrollContainerRef.current) return;
      
      const currentLine = Math.floor(scrollTop / ROW_HEIGHT) + 1;
      // Find next error line > currentLine
      let nextError = validationResult.errors.find(e => e.line > currentLine);
      
      // If none, loop back to first
      if (!nextError) {
          nextError = validationResult.errors[0];
      }
      
      if (nextError) {
          const targetScroll = Math.max(0, (nextError.line - 1) * ROW_HEIGHT);
          scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
  };

  const handleJumpToPrevError = () => {
      if (!validationResult || validationResult.errors.length === 0 || !scrollContainerRef.current) return;
      
      const currentLine = Math.floor(scrollTop / ROW_HEIGHT) + 1;
      // Find prev error line < currentLine (search backwards)
      const reversedErrors = [...validationResult.errors].reverse();
      let prevError = reversedErrors.find(e => e.line < currentLine);
      
      // If none, loop to last
      if (!prevError) {
          prevError = reversedErrors[0];
      }
      
      if (prevError) {
          const targetScroll = Math.max(0, (prevError.line - 1) * ROW_HEIGHT);
          scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
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
    unwarp: () => updateContentWithHistory(unwarpEdi(content)),
    scrollToLine: (line: number) => {
      if (scrollContainerRef.current) {
        const targetScroll = Math.max(0, (line - 1) * ROW_HEIGHT);
        scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
    },
    jumpToNextError: handleJumpToNextError,
    jumpToPrevError: handleJumpToPrevError
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
    if (fileFormat === 'pdf') return [];
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

  // Disable virtualization when errors exist to allow dynamic row heights
  // OR when visual wrap is on (which makes row height variable)
  const hasErrors = validationResult?.errors && validationResult.errors.length > 0;
  const isVirtualizationEnabled = !visualWrap && !hasErrors && visibleLines.length > 2000;
  
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

  const handleApplyFix = useCallback((lineNumber: number, newText: string) => {
      const lines = content.split(/\r?\n/);
      if (lineNumber > 0 && lineNumber <= lines.length) {
          lines[lineNumber - 1] = newText;
          updateContentWithHistory(lines.join('\n'));
      }
  }, [content]);

  const handlePopupMouseEnter = () => clearHoverTimeout();
  const handlePopupMouseLeave = () => { if (!popupState?.isPinned) setPopupState(null); };
  const handleBackgroundClick = () => { if (popupState?.isPinned) setPopupState(null); };
  const handleDoubleClick = () => { if (isEdiMode && !isEditing) setIsEditing(true); };
  const handlePinPopup = () => setPopupState(prev => prev ? { ...prev, isPinned: !prev.isPinned } : null);

  const fontSizeClass = { small: 'text-xs', medium: 'text-sm', large: 'text-base' }[settings.fontSize];
  const wrapClass = visualWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre';

  // --- PDF Viewer Mode ---
  if (fileFormat === 'pdf') {
      return (
        <div className="flex flex-col h-full bg-[#020617] relative">
            <iframe 
                src={`data:application/pdf;base64,${content}`} 
                className="w-full h-full border-none"
                title="PDF Viewer"
            />
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-[#020617] text-slate-300 relative" onClick={handleBackgroundClick} ref={containerRef}>
      {isFindOpen && (
        <div className="absolute top-2 right-4 left-4 z-20 bg-slate-900 border border-white/10 p-2 rounded-xl shadow-2xl animate-in slide-in-from-top-2 max-w-2xl mx-auto ring-1 ring-black/40">
           <div className="flex flex-col gap-2">
             <div className="flex gap-2">
                <div className="relative flex-1 group">
                   <div className="absolute left-2.5 top-2 text-slate-500"><Search size={14}/></div>
                   <input type="text" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Find content..." className="w-full bg-slate-950 border border-white/10 rounded-lg pl-8 pr-20 py-1.5 text-xs text-white focus:border-blue-500 outline-none transition-all shadow-inner" autoFocus />
                   <div className="absolute right-1 top-1 flex gap-0.5">
                      <button onClick={() => setMatchCase(!matchCase)} className={`p-1 rounded ${matchCase ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-white'}`} title="Match Case"><CaseSensitive size={12}/></button>
                      <button onClick={() => setMatchWholeWord(!matchWholeWord)} className={`p-1 rounded ${matchWholeWord ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-white'}`} title="Match Whole Word"><WholeWord size={12}/></button>
                      <button onClick={() => setUseRegex(!useRegex)} className={`p-1 rounded ${useRegex ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-500 hover:text-white'}`} title="Use Regex"><Regex size={12}/></button>
                   </div>
                </div>
                <div className="flex-1 flex gap-2">
                   <input type="text" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replace with..." className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none transition-all shadow-inner" />
                   <button onClick={handleReplace} className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700 hover:text-white border border-white/5 transition-all shadow-sm">Replace</button>
                   <button onClick={handleReplaceAll} className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-700 hover:text-white border border-white/5 transition-all shadow-sm">All</button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* Editor Content */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className={`flex-1 horizontal-scroll font-mono ${fontSizeClass} leading-6 relative bg-[#020617]`} onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => updateContentWithHistory(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full h-full bg-[#020617] text-slate-200 p-6 resize-none outline-none font-mono ${wrapClass} selection:bg-blue-500/30 horizontal-scroll custom-scrollbar`}
            spellCheck={false}
          />
        ) : (
          <div className={`pb-10 pt-2 pl-2 ${!visualWrap ? 'w-fit min-w-full' : 'w-full'}`} title="Double-click to edit" style={{ height: isVirtualizationEnabled ? totalHeight : 'auto', position: 'relative' }}>
            <div style={{ transform: `translateY(${translateY}px)` }}>
                {virtualItems.map((line) => {
                  const originalIndex = line.lineNumber - 1; 
                  const isFolded = collapsedLines.has(originalIndex);
                  const errorsForLine = validationResult?.errors.filter(e => e.line === line.lineNumber) || [];
                  
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
                      onApplyFix={handleApplyFix}
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
