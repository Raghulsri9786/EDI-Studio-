
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, AlertOctagon, ShieldCheck, ArrowUpRight, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { OrchestratedResult, ValidationIssue, FixResult } from '../types';
import { generateEdiFix, hasValidApiKey } from '../services/geminiService';

interface HealthDashboardProps {
  result: OrchestratedResult | null;
  isValidating: boolean;
  activeFileContent?: string;
  onJumpToLine?: (line: number) => void;
  onApplyFix?: (line: number, newSegment: string) => void;
}

const HealthDashboard: React.FC<HealthDashboardProps> = ({ 
  result, 
  isValidating, 
  activeFileContent = '', 
  onJumpToLine, 
  onApplyFix 
}) => {
  const scoreRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  
  // Fix State
  const [fixingIssueIndex, setFixingIssueIndex] = useState<number | null>(null);
  const [fixResult, setFixResult] = useState<FixResult | null>(null);
  const [isGeneratingFix, setIsGeneratingFix] = useState(false);

  useLayoutEffect(() => {
    if (result && scoreRef.current && window.gsap) {
      // Animate Score Counter
      window.gsap.fromTo(scoreRef.current, 
        { innerText: 0 }, 
        { 
          innerText: result.score, 
          duration: 1.5, 
          snap: { innerText: 1 }, 
          ease: "power2.out" 
        }
      );
      
      // Animate Progress Bar
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
    
    // Toggle off if clicking same
    if (fixingIssueIndex === idx) {
        setFixingIssueIndex(null);
        setFixResult(null);
        return;
    }

    setFixingIssueIndex(idx);
    setIsGeneratingFix(true);
    setFixResult(null);

    try {
        // Extract context lines
        const lines = activeFileContent.split(/\r?\n/);
        const lineIndex = issue.line - 1;
        const segment = lines[lineIndex];
        
        // Context: 5 lines before and after
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
      <div className="p-6 bg-slate-900/50 rounded-xl border border-white/5 animate-pulse flex flex-col items-center justify-center h-48">
         <Activity className="text-blue-500 mb-2 animate-spin" size={32} />
         <span className="text-sm text-slate-400">Running Comprehensive Validation...</span>
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

  const canUseAi = hasValidApiKey();

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 border border-white/5 shadow-xl relative overflow-hidden">
         <div className="absolute top-0 right-0 p-4 opacity-10">
            <ShieldCheck size={120} />
         </div>
         
         <div className="flex items-center gap-6 relative z-10">
            {/* Score Circle */}
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
               <h3 className="text-lg font-bold text-white mb-1">
                 {result.score === 100 ? "Excellent Compliance" : (result.score > 70 ? "Needs Attention" : "Critical Issues Found")}
               </h3>
               <p className="text-xs text-slate-400 mb-4">
                 Validation complete. Found {result.metrics.errorCount} errors and {result.metrics.warningCount} warnings across {result.metrics.segmentCount} segments.
               </p>
               
               <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div ref={barRef} className={`h-full ${getBarColor(result.score)} rounded-full`} style={{ width: '0%' }}></div>
               </div>
            </div>
         </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3">
         <div className="bg-red-950/20 border border-red-500/20 p-3 rounded-xl flex flex-col items-center text-center">
            <AlertOctagon size={20} className="text-red-500 mb-1" />
            <span className="text-xl font-bold text-red-400">{result.metrics.errorCount}</span>
            <span className="text-[10px] text-red-300 uppercase">Critical</span>
         </div>
         <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-xl flex flex-col items-center text-center">
            <AlertTriangle size={20} className="text-amber-500 mb-1" />
            <span className="text-xl font-bold text-amber-400">{result.metrics.warningCount}</span>
            <span className="text-[10px] text-amber-300 uppercase">Warnings</span>
         </div>
         <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl flex flex-col items-center text-center">
            <CheckCircle size={20} className="text-emerald-500 mb-1" />
            <span className="text-xl font-bold text-emerald-400">{result.issues.filter(i => i.severity === 'INFO').length}</span>
            <span className="text-[10px] text-emerald-300 uppercase">Passed Checks</span>
         </div>
      </div>

      {/* Issue List */}
      <div className="space-y-2">
         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Detailed Findings</h4>
         {result.issues.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs italic bg-slate-800/30 rounded-lg">No issues detected.</div>
         ) : (
            result.issues.filter(i => i.severity !== 'INFO').map((issue, idx) => (
               <div key={idx} className={`p-3 rounded-lg border text-xs transition-all ${issue.severity === 'ERROR' ? 'bg-red-900/10 border-red-500/20' : 'bg-amber-900/10 border-amber-500/20'}`}>
                  <div className="flex gap-3">
                    <div className={`mt-0.5 flex-none ${issue.severity === 'ERROR' ? 'text-red-500' : 'text-amber-500'}`}>
                        {issue.severity === 'ERROR' ? <AlertOctagon size={14} /> : <AlertTriangle size={14} />}
                    </div>
                    <div className="flex-1">
                        <div className="font-semibold mb-0.5 flex justify-between items-start">
                            <span className={`${issue.severity === 'ERROR' ? 'text-red-200' : 'text-amber-200'}`}>{issue.message}</span>
                            <div className="flex items-center gap-1">
                                {issue.severity === 'ERROR' && canUseAi && issue.line && (
                                    <button
                                        onClick={() => handleFixClick(idx, issue)}
                                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all ${
                                            fixingIssueIndex === idx 
                                            ? 'bg-blue-600 text-white border-blue-500 shadow-md' 
                                            : 'bg-slate-800 text-blue-400 border-blue-500/30 hover:border-blue-400'
                                        }`}
                                    >
                                        <Sparkles size={10} /> Fix
                                    </button>
                                )}
                                {issue.line && (
                                    <button 
                                        onClick={() => onJumpToLine && onJumpToLine(issue.line!)}
                                        className="flex items-center gap-1 text-[10px] opacity-60 font-mono bg-white/10 px-1.5 py-0.5 rounded hover:bg-white/20 hover:opacity-100 transition-all cursor-pointer"
                                        title="Jump to line"
                                    >
                                        Ln {issue.line} <ArrowUpRight size={10} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 opacity-60">
                            <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px] text-slate-300">{issue.source}</span>
                            {issue.code && <span className="text-slate-400">Code: {issue.code}</span>}
                        </div>
                    </div>
                  </div>

                  {/* Fix Panel Expansion */}
                  {fixingIssueIndex === idx && (
                      <div className="mt-3 pt-3 border-t border-white/5 animate-in slide-in-from-top-1">
                          {isGeneratingFix ? (
                              <div className="flex items-center justify-center py-4 text-blue-400 gap-2">
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>Analyzing segment rules...</span>
                              </div>
                          ) : fixResult ? (
                              <div className="space-y-3">
                                  <div className="text-slate-300 font-medium">Proposed Fix:</div>
                                  <div className="bg-black/40 p-2 rounded font-mono text-[11px] text-emerald-300 border border-emerald-500/30 flex items-center justify-between">
                                      <span>{fixResult.segment}</span>
                                      <button 
                                        onClick={() => handleApply(issue.line!, fixResult.segment)}
                                        className="ml-4 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition-colors shadow-sm"
                                      >
                                        Apply
                                      </button>
                                  </div>
                                  <div className="flex items-start gap-2 bg-blue-500/10 p-2 rounded text-blue-200">
                                      <div className="mt-0.5"><Sparkles size={12} /></div>
                                      <p>{fixResult.explanation}</p>
                                  </div>
                              </div>
                          ) : (
                              <div className="text-center py-2 text-slate-500 italic">Could not generate a fix.</div>
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
