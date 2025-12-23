import React, { useLayoutEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, AlertOctagon, ShieldCheck, ArrowUpRight, Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { OrchestratedResult, ValidationIssue, FixResult } from '../types';
import { generateEdiFix } from '../services/geminiService';

interface HealthDashboardProps {
  result: OrchestratedResult | null;
  isValidating: boolean;
  activeFileContent?: string;
  onJumpToLine?: (line: number) => void;
  onApplyFix?: (line: number, newSegment: string) => void;
  onRefresh?: () => void;
}

const HealthDashboard: React.FC<HealthDashboardProps> = ({ 
  result, 
  isValidating, 
  activeFileContent = '', 
  onJumpToLine, 
  onApplyFix,
  onRefresh
}) => {
  const scoreRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  
  const [fixingIssueIndex, setFixingIssueIndex] = useState<number | null>(null);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);

  useLayoutEffect(() => {
    if (result && scoreRef.current && window.gsap) {
      window.gsap.fromTo(scoreRef.current, 
        { innerText: 0 }, 
        { 
          innerText: result.score, 
          duration: 1.5, 
          snap: { innerText: 1 }, 
          ease: "power2.out" 
        }
      );
      
      if (barRef.current) {
          window.gsap.fromTo(barRef.current,
            { width: "0%" },
            { width: `${result.score}%`, duration: 1.2, ease: "power2.out" }
          );
      }
    }
  }, [result]);

  const handleFixClick = async (idx: number, issue: ValidationIssue) => {
    if (!activeFileContent || !issue.line) return;
    
    if (fixingIssueIndex === idx) {
        setFixingIssueIndex(null);
        setFixResult(null);
        return;
    }

    setFixingIssueIndex(idx);
    setIsGeneratingFix(true);
    setFixResult(null);

    try {
        const lines = activeFileContent.split(/\r?\n/);
        const lineIndex = issue.line - 1;
        const segment = lines[lineIndex];
        
        const start = Math.max(0, lineIndex - 5);
        const end = Math.min(lines.length, lineIndex + 5);
        const context = lines.slice(start, end).join('\n');

        const fix = await generateEdiFix(segment, issue.message, context);
        setFixResult(fix);
    } catch (e) {
        console.error(e);
    } finally {
        setIsGeneratingFix(false);
    }
  };

  const handleApply = (line: number, newSegment: string) => {
      if (onApplyFix) {
          onApplyFix(line, newSegment);
          setFixingIssueIndex(null);
          setFixResult(null);
      }
  };

  if (isValidating) {
    return (
      <div className="p-6 bg-slate-900/50 rounded-xl border border-white/5 flex flex-col items-center justify-center h-64 text-center">
         <div className="relative mb-4">
             <Activity className="text-blue-500 animate-spin relative z-10" size={48} />
             <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
         </div>
         <span className="text-sm font-bold text-slate-200">Running Comprehensive Validation</span>
         <p className="text-xs text-slate-500 mt-2 max-w-[200px]">Checking envelopes, segment order, data types, and AI insights...</p>
      </div>
    );
  }

  if (!result) return null;

  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-emerald-400';
    if (s >= 70) return 'text-amber-400';
    return 'text-red-400';
  };

  const getBarColor = (s: number) => {
    if (s >= 90) return 'bg-emerald-500';
    if (s >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck size={120} />
         </div>
         
         <div className="flex items-center gap-6 relative z-10">
            <div className="relative w-24 h-24 flex items-center justify-center">
               <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path
                    className="text-slate-700"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className={getScoreColor(result.score)}
                    strokeDasharray={`${result.score}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span ref={scoreRef} className={`text-2xl font-bold ${getScoreColor(result.score)}`}>0</span>
                  <span className="text-[8px] text-slate-500 uppercase tracking-wider">Score</span>
               </div>
            </div>

            <div className="flex-1">
               <div className="flex items-center justify-between mb-1">
                   <h3 className="text-lg font-bold text-white">
                     {result.score === 100 ? "Valid Document" : (result.score > 70 ? "Minor Issues" : "Critical Failures")}
                   </h3>
                   <button onClick={onRefresh} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-blue-400 transition-all" title="Re-validate">
                        <RefreshCw size={14} />
                   </button>
               </div>
               <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                 {result.metrics.errorCount} structural errors and {result.metrics.warningCount} data warnings detected.
               </p>
               
               <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div ref={barRef} className={`h-full ${getBarColor(result.score)} rounded-full`} style={{ width: '0%' }}></div>
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
         <div className="bg-red-950/20 border border-red-500/20 p-3 rounded-xl flex flex-col items-center text-center">
            <AlertOctagon size={20} className="text-red-500 mb-1" />
            <span className="text-xl font-bold text-red-400">{result.metrics.errorCount}</span>
            <span className="text-[10px] text-red-300 uppercase font-bold">Errors</span>
         </div>
         <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-xl flex flex-col items-center text-center">
            <AlertTriangle size={20} className="text-amber-500 mb-1" />
            <span className="text-xl font-bold text-amber-400">{result.metrics.warningCount}</span>
            <span className="text-[10px] text-amber-300 uppercase font-bold">Warnings</span>
         </div>
         <div className="bg-slate-800 border border-white/10 p-3 rounded-xl flex flex-col items-center text-center">
            <Activity size={20} className="text-blue-400 mb-1" />
            <span className="text-xl font-bold text-slate-200">{result.metrics.segmentCount}</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold">Segments</span>
         </div>
      </div>

      <div className="space-y-2">
         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
             Detailed Findings
             <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">{result.issues.length} Issues</span>
         </h4>
         
         {result.issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                <CheckCircle size={32} className="text-emerald-500 mb-3" />
                <p className="text-sm font-bold text-emerald-400">Compliance Verified</p>
                <p className="text-xs text-slate-500 mt-1">No structural or syntax issues found.</p>
            </div>
         ) : (
            result.issues.filter(i => i.severity !== 'INFO').map((issue, idx) => (
               <div key={idx} className={`group p-3 rounded-xl border text-xs transition-all ${issue.severity === 'ERROR' ? 'bg-red-900/10 border-red-500/20 hover:border-red-500/40' : 'bg-amber-900/10 border-amber-500/20 hover:border-amber-500/40'}`}>
                  <div className="flex gap-3">
                    <div className={`mt-0.5 flex-none ${issue.severity === 'ERROR' ? 'text-red-500' : 'text-amber-500'}`}>
                        {issue.severity === 'ERROR' ? <AlertOctagon size={16} /> : <AlertTriangle size={16} />}
                    </div>
                    <div className="flex-1">
                        <div className="font-bold mb-1 flex justify-between items-start gap-2">
                            <span className={`${issue.severity === 'ERROR' ? 'text-red-100' : 'text-amber-100'} leading-snug`}>{issue.message}</span>
                            <div className="flex items-center gap-1 flex-none">
                                {issue.severity === 'ERROR' && issue.line && (
                                    <button
                                        onClick={() => handleFixClick(idx, issue)}
                                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-all ${
                                            fixingIssueIndex === idx 
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-lg' 
                                            : 'bg-slate-800 text-blue-400 border-blue-500/20 hover:border-blue-500/50'
                                        }`}
                                    >
                                        <Sparkles size={10} /> {fixingIssueIndex === idx ? 'Close' : 'AI Fix'}
                                    </button>
                                )}
                                {issue.line && (
                                    <button 
                                        onClick={() => onJumpToLine && onJumpToLine(issue.line!)}
                                        className="flex items-center gap-1 text-[10px] font-mono bg-white/5 px-2 py-1 rounded border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
                                    >
                                        Ln {issue.line} <ArrowUpRight size={10} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-2 opacity-50 font-medium">
                            <span className="bg-black/30 px-2 py-0.5 rounded text-[10px] text-slate-300 uppercase tracking-tighter">{issue.source}</span>
                            {issue.code && <span className="text-slate-400">ID: {issue.code}</span>}
                            {issue.segmentId && <span className="text-slate-400">Seg: {issue.segmentId}</span>}
                        </div>
                    </div>
                  </div>

                  {fixingIssueIndex === idx && (
                      <div className="mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2">
                          {isGeneratingFix ? (
                              <div className="flex flex-col items-center justify-center py-6 text-blue-400 gap-3">
                                  <Loader2 size={24} className="animate-spin" />
                                  <span className="text-[11px] font-bold uppercase tracking-widest animate-pulse">EDI Copilot Analysing...</span>
                              </div>
                          ) : fixResult ? (
                              <div className="space-y-4">
                                  <div>
                                      <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Recommended Segment Update:</div>
                                      <div className="bg-black/60 p-3 rounded-xl font-mono text-[11px] text-emerald-400 border border-emerald-500/20 flex items-center justify-between shadow-inner">
                                          <span className="break-all">{fixResult.segment}</span>
                                          <button 
                                            onClick={() => handleApply(issue.line!, fixResult.segment)}
                                            className="ml-4 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-lg shadow-emerald-900/40 active:scale-95 flex-none"
                                          >
                                            Apply
                                          </button>
                                      </div>
                                  </div>
                                  <div className="flex items-start gap-3 bg-blue-500/10 p-3 rounded-xl text-[11px] text-blue-200 border border-blue-500/10 leading-relaxed shadow-sm">
                                      <Sparkles size={14} className="text-blue-400 flex-none mt-0.5" />
                                      <p>{fixResult.explanation}</p>
                                  </div>
                              </div>
                          ) : (
                              <div className="text-center py-4 text-slate-500 italic text-[11px]">Assistant could not resolve this specific structural gap.</div>
                          )}
                      </div>
                  )}
               </div>
            ))
         )}
      </div>
    </div>
  );
};

export default HealthDashboard;
