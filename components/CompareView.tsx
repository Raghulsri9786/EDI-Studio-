
import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { RefreshCw, ArrowLeft, CheckCircle, XCircle, AlertTriangle, Info, FileDiff, Layers, Hash, Code, Layout, Eye, EyeOff, ChevronsUpDown, FileText, Pin, Filter, Sparkles, Download, ArrowRight, BrainCircuit, Columns, List } from 'lucide-react';
import { EdiFile } from '../types';
import { calculateDiff } from '../utils/diffEngine';
import { performStructuralDiff, StructuralResult, AlignedSegment } from '../utils/ediStructuralDiff';
import { DiffResult, DiffLine } from '../types';
import { explainEdiDiff, hasValidApiKey } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { useSyncScroll } from '../hooks/useSyncScroll';

interface CompareViewProps {
  files?: EdiFile[];
}

type CompareMode = 'SELECT' | 'TEXT' | 'EDI';
type ViewFilter = 'ALL' | 'DIFFS_ONLY';
type ViewLayout = 'SPLIT' | 'INLINE';

// --- Styles for Diff Types ---
const DIFF_STYLES = {
  ADDED:    "bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-100",
  REMOVED:  "bg-red-500/10 border-l-2 border-red-500 text-red-100",
  MODIFIED: "bg-amber-500/10 border-l-2 border-amber-500 text-amber-100",
  SAME:     "bg-transparent border-l-2 border-transparent text-slate-400 hover:bg-white/5",
  EMPTY:    "bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 bg-slate-900 border-l-2 border-transparent",
  COLLAPSED: "bg-slate-800/50 border-y border-white/5 text-slate-500 text-center text-xs py-2 italic cursor-pointer hover:bg-slate-800 hover:text-slate-300 transition-colors"
};

const CollapsedRow: React.FC<{ count: number, onClick: () => void }> = ({ count, onClick }) => (
  <div onClick={onClick} className={DIFF_STYLES.COLLAPSED}>
     <ChevronsUpDown size={12} className="inline mr-2" />
     {count} unchanged lines hidden. Click to expand full file.
  </div>
);

// --- Sub-component: File Header ---
const FileHeader: React.FC<{ filename: string, icon: React.ReactNode, count?: number, type: 'ADD'|'REM'|'MOD'|'NONE' }> = ({ filename, icon, count, type }) => {
    let statClass = "text-slate-500";
    if (type === 'ADD') statClass = "text-emerald-400 bg-emerald-500/10";
    if (type === 'REM') statClass = "text-red-400 bg-red-500/10";
    
    return (
        <div className="sticky top-0 z-20 bg-slate-900/95 border-b border-white/10 backdrop-blur-sm px-4 py-2 flex items-center justify-between shadow-sm min-w-max">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                {icon} <span className="truncate max-w-[200px]" title={filename}>{filename}</span>
            </div>
            {count !== undefined && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${statClass}`}>
                    {type === 'ADD' ? '+' : '-'}{count} lines
                </span>
            )}
        </div>
    );
};

// --- EDI Mode Rendering ---
const EdiSegmentRow: React.FC<{ 
    segment: any, 
    diffs?: number[], 
    showPin?: boolean, 
    pinned?: boolean, 
    onTogglePin?: () => void 
}> = ({ segment, diffs, showPin, pinned, onTogglePin }) => {
    
    if (!segment) return <div className={`h-8 w-full ${DIFF_STYLES.EMPTY}`}></div>;

    return (
        <div className={`flex items-center h-8 font-mono text-xs px-2 whitespace-nowrap transition-colors relative group`}>
            {showPin && (
                <button 
                    onClick={(e) => { e.stopPropagation(); onTogglePin && onTogglePin(); }}
                    className={`absolute left-0 top-1/2 -translate-y-1/2 p-1 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity ${pinned ? 'opacity-100 text-indigo-400' : 'text-slate-600 hover:text-slate-300'}`}
                >
                    <Pin size={10} fill={pinned ? "currentColor" : "none"} />
                </button>
            )}
            
            <span className={`font-bold text-slate-500 w-8 flex-none text-right mr-3 select-none opacity-50 ${showPin ? 'ml-4' : ''}`}>{segment.line}</span>
            <span className="font-bold text-purple-400 mr-1">{segment.id}</span>
            {segment.elements.map((el: string, i: number) => {
                const isDiff = diffs?.includes(i + 1);
                return (
                    <React.Fragment key={i}>
                        <span className="text-slate-600 mx-0.5">*</span>
                        <span className={`${isDiff ? 'bg-amber-500/40 text-amber-100 font-bold px-0.5 rounded ring-1 ring-amber-500/50' : 'text-slate-300'}`}>
                            {el}
                        </span>
                    </React.Fragment>
                );
            })}
            <span className="text-slate-600 ml-0.5">~</span>
        </div>
    );
};

// --- Helper: Diff Stats ---
const calculateStats = (segments: AlignedSegment[]) => {
    let added = 0, removed = 0, modified = 0;
    segments.forEach(s => {
        if (s.status === 'RIGHT_ONLY') added++;
        if (s.status === 'LEFT_ONLY') removed++;
        if (s.status === 'MODIFIED') modified++;
    });
    return { added, removed, modified };
};

type CompareItem = AlignedSegment | { status: 'COLLAPSED'; count: number };

const CompareView: React.FC<CompareViewProps> = ({ files = [] }) => {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [fileAName, setFileAName] = useState('Left File');
  const [fileBName, setFileBName] = useState('Right File');
  
  const [mode, setMode] = useState<CompareMode>('SELECT');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('ALL');
  const [viewLayout, setViewLayout] = useState<ViewLayout>('SPLIT');
  const [isComparing, setIsComparing] = useState(false);
  
  // Advanced Features
  const [pinnedSegments, setPinnedSegments] = useState<Set<string>>(new Set(['ISA', 'GS', 'ST', 'BEG', 'BGM', 'BIG']));
  const [segmentFilter, setSegmentFilter] = useState<string>('ALL');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  
  // Results
  const [textDiffResult, setTextDiffResult] = useState<DiffResult | null>(null);
  const [structDiffResult, setStructDiffResult] = useState<StructuralResult | null>(null);

  // Refs for Scroll Synchronization
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const inlinePanelRef = useRef<HTMLDivElement>(null);

  // Enable Smart Scroll Sync
  useSyncScroll(leftPanelRef, rightPanelRef);

  // Initialize from files if provided
  useEffect(() => {
    if (files.length >= 2) {
      setTextA(files[0].content);
      setFileAName(files[0].name);
      setTextB(files[1].content);
      setFileBName(files[1].name);
    } else if (files.length === 1) {
      setTextA(files[0].content);
      setFileAName(files[0].name);
    }
  }, [files]);

  // Auto-scroll to first difference on load
  useEffect(() => {
      const scrollTarget = leftPanelRef.current || inlinePanelRef.current;
      if (scrollTarget && (structDiffResult || textDiffResult)) {
          // Find first diff element
          setTimeout(() => {
             const firstDiff = scrollTarget.querySelector('.diff-modified, .diff-added, .diff-removed');
             if (firstDiff) {
                 firstDiff.scrollIntoView({ behavior: 'smooth', block: 'center' });
             }
          }, 500);
      }
  }, [structDiffResult, textDiffResult, mode]);

  const handleTextCompare = async () => {
    if (!textA && !textB) return;
    setIsComparing(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = calculateDiff(textA, textB);
    setTextDiffResult(result);
    setMode('TEXT');
    setIsComparing(false);
  };

  const handleStructuralCompare = async () => {
    if (!textA && !textB) return;
    setIsComparing(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = performStructuralDiff(textA, textB);
    setStructDiffResult(result);
    setMode('EDI');
    setIsComparing(false);
  };

  const handleAiExplain = async () => {
      if (!structDiffResult) return;
      setIsAnalyzingAi(true);
      
      // Extract differences
      let diffContext = '';
      structDiffResult.alignedSegments.forEach(row => {
          if (row.status !== 'MATCH') {
              if (row.left) diffContext += `- REMOVED: ${row.left.raw}\n`;
              if (row.right) diffContext += `+ ADDED: ${row.right.raw}\n`;
          }
      });

      try {
          const explanation = await explainEdiDiff(diffContext);
          setAiAnalysis(explanation);
      } catch (e) {
          setAiAnalysis("Could not generate analysis. Please check API Key.");
      } finally {
          setIsAnalyzingAi(false);
      }
  };

  const handleExport = () => {
      const content = `
Comparison Report
Left File: ${fileAName}
Right File: ${fileBName}
Date: ${new Date().toLocaleString()}

${structDiffResult ? 
    structDiffResult.alignedSegments.map(s => {
        if (s.status === 'MATCH') return `  ${s.left?.raw}`;
        if (s.status === 'MODIFIED') return `~ ${s.left?.raw}  ->  ${s.right?.raw}`;
        if (s.status === 'LEFT_ONLY') return `- ${s.left?.raw}`;
        if (s.status === 'RIGHT_ONLY') return `+ ${s.right?.raw}`;
        return '';
    }).join('\n')
: ''}
      `;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diff-${fileAName}-${fileBName}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  // --- Filtering & Processing ---
  const filteredSegments = useMemo((): CompareItem[] => {
    if (!structDiffResult) return [];
    
    let processed: CompareItem[] = structDiffResult.alignedSegments;

    // 1. Segment Filter
    if (segmentFilter !== 'ALL') {
        processed = processed.filter(s => 
            (s.status !== 'COLLAPSED' && ((s as AlignedSegment).left?.id === segmentFilter || (s as AlignedSegment).right?.id === segmentFilter))
        );
    }

    // 2. Diffs Only Filter (with context collapsing)
    if (viewFilter === 'DIFFS_ONLY') {
        const visible: CompareItem[] = [];
        const source = processed as AlignedSegment[]; // Prior to this step, processed is pure AlignedSegment[]
        const context = 2;
        let i = 0;
        while (i < source.length) {
            const isDiff = source[i].status !== 'MATCH' || pinnedSegments.has(source[i].left?.id || source[i].right?.id || '');
            
            if (isDiff) {
                const start = Math.max(0, i - context);
                // Spacer
                // We check if the last item in visible was an AlignedSegment and calculate gap
                // If the last item was COLLAPSED, we assume we are just appending another collapsed or adjacent block?
                // Logic: Find index of last added segment in source
                
                let lastSourceIndex = -1;
                for (let v = visible.length - 1; v >= 0; v--) {
                    if (visible[v].status !== 'COLLAPSED') {
                        lastSourceIndex = source.indexOf(visible[v] as AlignedSegment);
                        break;
                    }
                }

                if (lastSourceIndex !== -1 && lastSourceIndex < start - 1) {
                    const skipped = start - (lastSourceIndex + 1);
                    if (skipped > 0) visible.push({ status: 'COLLAPSED', count: skipped });
                } else if (visible.length === 0 && start > 0) {
                    visible.push({ status: 'COLLAPSED', count: start });
                }
                
                let j = i;
                while (j < source.length) {
                    const nextIsDiff = source[j].status !== 'MATCH' || pinnedSegments.has(source[j].left?.id || source[j].right?.id || '');
                    if (nextIsDiff) i = j;
                    else if (j > i + context) break;
                    j++;
                }
                
                for (let k = start; k < Math.min(source.length, j); k++) {
                    // Avoid duplicates if ranges overlap
                    if (!visible.includes(source[k])) visible.push(source[k]);
                }
                i = j;
            } else {
                i++;
            }
        }
        processed = visible;
    }

    return processed;
  }, [structDiffResult, viewFilter, segmentFilter, pinnedSegments]);

  const uniqueSegments = useMemo(() => {
      if (!structDiffResult) return [];
      const set = new Set<string>();
      structDiffResult.alignedSegments.forEach(s => {
          if (s.left) set.add(s.left.id);
          if (s.right) set.add(s.right.id);
      });
      return Array.from(set).sort();
  }, [structDiffResult]);

  const stats = useMemo(() => structDiffResult ? calculateStats(structDiffResult.alignedSegments) : { added:0, removed:0, modified:0 }, [structDiffResult]);

  // --- Render Functions ---

  const MiniMap = ({ items }: { items: AlignedSegment[] }) => (
      <div className="absolute right-0 top-0 bottom-0 w-3 bg-slate-900/50 border-l border-white/5 z-20 flex flex-col pointer-events-none">
          {items.map((item, i) => {
              let color = 'transparent';
              if (item.status === 'LEFT_ONLY') color = '#ef4444';
              if (item.status === 'RIGHT_ONLY') color = '#10b981';
              if (item.status === 'MODIFIED') color = '#f59e0b';
              return <div key={i} style={{ flex: 1, backgroundColor: color, opacity: color === 'transparent' ? 0 : 0.8 }} />;
          })}
      </div>
  );

  if (mode === 'SELECT') {
      return (
        <div className="h-full flex flex-col bg-slate-950 text-slate-200 p-6 items-center justify-center relative">
           <div className="flex-none w-full max-w-6xl mb-8 flex gap-4 h-64 z-10">
              <div className="flex-1 flex flex-col bg-slate-900/50 rounded-xl border border-white/5">
                  <div className="p-3 border-b border-white/5 text-xs font-bold text-slate-500 uppercase flex justify-between">
                      <span>Left Input</span>
                      <input className="bg-transparent text-right outline-none text-slate-400 focus:text-white" value={fileAName} onChange={e => setFileAName(e.target.value)} />
                  </div>
                  <textarea className="flex-1 bg-transparent p-4 text-xs font-mono text-slate-300 resize-none outline-none custom-scrollbar" placeholder="Paste content..." value={textA} onChange={(e) => setTextA(e.target.value)} />
              </div>
              <div className="flex-1 flex flex-col bg-slate-900/50 rounded-xl border border-white/5">
                  <div className="p-3 border-b border-white/5 text-xs font-bold text-slate-500 uppercase flex justify-between">
                      <span>Right Input</span>
                      <input className="bg-transparent text-right outline-none text-slate-400 focus:text-white" value={fileBName} onChange={e => setFileBName(e.target.value)} />
                  </div>
                  <textarea className="flex-1 bg-transparent p-4 text-xs font-mono text-slate-300 resize-none outline-none custom-scrollbar" placeholder="Paste content..." value={textB} onChange={(e) => setTextB(e.target.value)} />
              </div>
           </div>
           <div className="flex gap-6 z-10">
              <button onClick={handleTextCompare} disabled={!textA || !textB} className="group w-64 p-6 bg-slate-900 border border-white/10 rounded-2xl hover:border-blue-500/50 hover:bg-slate-800 transition-all text-left disabled:opacity-50">
                 <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-colors"><FileDiff size={24} /></div>
                 <h3 className="text-lg font-bold text-white mb-2">Text Compare</h3>
                 <p className="text-xs text-slate-400">Character-by-character diff.</p>
              </button>
              <button onClick={handleStructuralCompare} disabled={!textA || !textB} className="group w-64 p-6 bg-slate-900 border border-white/10 rounded-2xl hover:border-emerald-500/50 hover:bg-slate-800 transition-all text-left disabled:opacity-50">
                 <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-600/20 group-hover:text-emerald-400 transition-colors"><Layout size={24} /></div>
                 <h3 className="text-lg font-bold text-white mb-2">Smart EDI Compare</h3>
                 <p className="text-xs text-slate-400">Structural analysis & semantics.</p>
              </button>
           </div>
           {isComparing && <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center"><div className="text-blue-400 font-bold animate-pulse">Analyzing...</div></div>}
        </div>
      );
  }

  // --- Main Comparison UI ---
  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-200">
        {/* Toolbar */}
        <div className="flex-none h-14 bg-slate-900 border-b border-white/5 flex items-center justify-between px-4 shadow-md z-30">
            <div className="flex items-center gap-4">
                <button onClick={() => setMode('SELECT')} className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"><ArrowLeft size={14} /> Back</button>
                <div className="h-4 w-px bg-white/10"></div>
                
                {/* View Filters */}
                <div className="flex bg-slate-800 rounded-lg p-0.5 border border-white/5">
                    <button onClick={() => setViewFilter('ALL')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><Eye size={12} /> Full File</button>
                    <button onClick={() => setViewFilter('DIFFS_ONLY')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewFilter === 'DIFFS_ONLY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><EyeOff size={12} /> Diffs Only</button>
                </div>

                {/* Segment Filter Dropdown */}
                {mode === 'EDI' && (
                    <div className="relative group">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-white/5 rounded-lg text-xs cursor-pointer hover:bg-slate-700">
                            <Filter size={12} /> {segmentFilter === 'ALL' ? 'All Segments' : segmentFilter}
                        </div>
                        <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-white/10 rounded-lg shadow-xl overflow-hidden hidden group-hover:block z-50 max-h-64 overflow-y-auto custom-scrollbar">
                            <button onClick={() => setSegmentFilter('ALL')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5">All Segments</button>
                            {uniqueSegments.map(s => (
                                <button key={s} onClick={() => setSegmentFilter(s)} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-slate-300 font-mono">{s}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                {/* Stats Box */}
                {mode === 'EDI' && (
                    <div className="flex items-center gap-3 text-[10px] font-mono bg-slate-800/50 px-3 py-1.5 rounded-lg border border-white/5">
                        <span className="text-emerald-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> +{stats.added}</span>
                        <span className="text-red-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> -{stats.removed}</span>
                        <span className="text-amber-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> ~{stats.modified}</span>
                    </div>
                )}

                {/* Layout Toggle */}
                {mode === 'EDI' && (
                    <div className="flex bg-slate-800 rounded-lg p-0.5 border border-white/5">
                        <button onClick={() => setViewLayout('SPLIT')} className={`p-1.5 rounded-md transition-all ${viewLayout === 'SPLIT' ? 'bg-blue-600 text-white' : 'text-slate-400'}`} title="Split View"><Columns size={14} /></button>
                        <button onClick={() => setViewLayout('INLINE')} className={`p-1.5 rounded-md transition-all ${viewLayout === 'INLINE' ? 'bg-blue-600 text-white' : 'text-slate-400'}`} title="Inline View"><List size={14} /></button>
                    </div>
                )}

                {/* AI Actions */}
                {mode === 'EDI' && hasValidApiKey() && (
                    <button onClick={handleAiExplain} disabled={isAnalyzingAi} className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-xs font-bold hover:shadow-lg transition-all disabled:opacity-50">
                        {isAnalyzingAi ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />} 
                        {isAnalyzingAi ? "Analyzing..." : "Explain Diffs"}
                    </button>
                )}

                <button onClick={handleExport} className="p-2 text-slate-400 hover:text-white transition-colors" title="Export Report">
                    <Download size={16} />
                </button>
            </div>
        </div>

        {/* AI Analysis Panel */}
        {aiAnalysis && (
            <div className="bg-slate-900 border-b border-white/5 p-4 animate-in slide-in-from-top-2">
                <div className="max-w-4xl mx-auto flex gap-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg h-fit"><BrainCircuit size={20} className="text-indigo-400" /></div>
                    <div className="flex-1">
                        <h3 className="text-sm font-bold text-white mb-2">Semantic Analysis</h3>
                        <div className="prose prose-sm prose-invert max-w-none text-xs text-slate-300">
                            <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                        </div>
                        <button onClick={() => setAiAnalysis(null)} className="mt-2 text-[10px] text-slate-500 hover:text-white underline">Close Analysis</button>
                    </div>
                </div>
            </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
            {/* Minimap (Right Edge) */}
            {mode === 'EDI' && structDiffResult && <MiniMap items={structDiffResult.alignedSegments} />}

            {mode === 'EDI' && structDiffResult ? (
                viewLayout === 'SPLIT' ? (
                    // SPLIT VIEW
                    <>
                        <div ref={leftPanelRef} className="flex-1 horizontal-scroll border-r border-white/5 bg-[#0f111a] relative pb-20">
                            <FileHeader filename={fileAName} icon={<FileText size={14} className="text-blue-400" />} type="REM" count={stats.removed} />
                            {filteredSegments.map((row, i) => {
                                if (row.status === 'COLLAPSED') return <CollapsedRow key={i} count={(row as any).count} onClick={() => setViewFilter('ALL')} />;
                                const segRow = row as AlignedSegment;
                                const style = segRow.status === 'LEFT_ONLY' ? `diff-removed ${DIFF_STYLES.REMOVED}` : 
                                              segRow.status === 'MODIFIED' ? `diff-modified ${DIFF_STYLES.MODIFIED}` : 
                                              segRow.status === 'RIGHT_ONLY' ? DIFF_STYLES.EMPTY : DIFF_STYLES.SAME;
                                const isPinned = segRow.left && pinnedSegments.has(segRow.left.id);
                                return (
                                    <div key={i} className={`${style} min-w-max`}>
                                        <EdiSegmentRow 
                                            segment={segRow.left} 
                                            diffs={segRow.diffs} 
                                            showPin={!!segRow.left}
                                            pinned={isPinned}
                                            onTogglePin={() => segRow.left && setPinnedSegments(prev => {
                                                const next = new Set(prev);
                                                next.has(segRow.left!.id) ? next.delete(segRow.left!.id) : next.add(segRow.left!.id);
                                                return next;
                                            })}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div ref={rightPanelRef} className="flex-1 horizontal-scroll bg-[#0f111a] relative pb-20">
                            <FileHeader filename={fileBName} icon={<FileText size={14} className="text-emerald-400" />} type="ADD" count={stats.added} />
                            {filteredSegments.map((row, i) => {
                                if (row.status === 'COLLAPSED') return <CollapsedRow key={i} count={(row as any).count} onClick={() => setViewFilter('ALL')} />;
                                const segRow = row as AlignedSegment;
                                const style = segRow.status === 'RIGHT_ONLY' ? `diff-added ${DIFF_STYLES.ADDED}` : 
                                              segRow.status === 'MODIFIED' ? `diff-modified ${DIFF_STYLES.MODIFIED}` : 
                                              segRow.status === 'LEFT_ONLY' ? DIFF_STYLES.EMPTY : DIFF_STYLES.SAME;
                                return (
                                    <div key={i} className={`${style} min-w-max`}>
                                        <EdiSegmentRow segment={segRow.right} diffs={segRow.diffs} />
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    // INLINE VIEW
                    <div ref={inlinePanelRef} className="flex-1 horizontal-scroll bg-[#0f111a] relative pb-20 max-w-4xl mx-auto border-x border-white/5">
                        <div className="sticky top-0 z-20 bg-slate-900 border-b border-white/10 px-4 py-2 text-xs font-bold text-slate-400 min-w-max">Inline Comparison</div>
                        {filteredSegments.map((row, i) => {
                            if (row.status === 'COLLAPSED') return <CollapsedRow key={i} count={(row as any).count} onClick={() => setViewFilter('ALL')} />;
                            
                            const segRow = row as AlignedSegment;
                            return (
                                <div key={i} className="border-b border-white/5 min-w-max">
                                    {segRow.status === 'MATCH' && (
                                        <div className={DIFF_STYLES.SAME}><EdiSegmentRow segment={segRow.left} /></div>
                                    )}
                                    {(segRow.status === 'LEFT_ONLY' || segRow.status === 'MODIFIED') && segRow.left && (
                                        <div className={`diff-removed ${DIFF_STYLES.REMOVED}`}>
                                            <EdiSegmentRow segment={segRow.left} diffs={segRow.diffs} />
                                        </div>
                                    )}
                                    {(segRow.status === 'RIGHT_ONLY' || segRow.status === 'MODIFIED') && segRow.right && (
                                        <div className={`diff-added ${DIFF_STYLES.ADDED}`}>
                                            <EdiSegmentRow segment={segRow.right} diffs={segRow.diffs} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            ) : textDiffResult ? (
                // TEXT MODE FALLBACK
                <div className="flex-1 flex overflow-hidden font-mono text-xs leading-5 relative">
                    <div className="flex-1 horizontal-scroll p-4">
                        {textDiffResult.leftLines.map((l, i) => (
                            <div key={i} className={`${l.type === 'REMOVED' ? 'bg-red-900/20 text-red-200' : 'text-slate-400'} min-w-max`}>{l.content}</div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    </div>
  );
};

export default CompareView;
