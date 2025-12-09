
import React, { useLayoutEffect, useRef } from 'react';
import { Activity, AlertTriangle, CheckCircle, AlertOctagon, ShieldCheck } from 'lucide-react';
import { OrchestratedResult } from '../types';

interface HealthDashboardProps {
  result: OrchestratedResult | null;
  isValidating: boolean;
}

const HealthDashboard: React.FC<HealthDashboardProps> = ({ result, isValidating }) => {
  const scoreRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

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
               <div key={idx} className={`p-3 rounded-lg border flex gap-3 text-xs ${issue.severity === 'ERROR' ? 'bg-red-900/10 border-red-500/20 text-red-200' : 'bg-amber-900/10 border-amber-500/20 text-amber-200'}`}>
                  <div className={`mt-0.5 flex-none ${issue.severity === 'ERROR' ? 'text-red-500' : 'text-amber-500'}`}>
                     {issue.severity === 'ERROR' ? <AlertOctagon size={14} /> : <AlertTriangle size={14} />}
                  </div>
                  <div className="flex-1">
                     <div className="font-semibold mb-0.5 flex justify-between">
                        <span>{issue.message}</span>
                        {issue.line && <span className="text-[10px] opacity-60 font-mono">Ln {issue.line}</span>}
                     </div>
                     <div className="flex items-center gap-2 mt-1 opacity-60">
                        <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px]">{issue.source}</span>
                        {issue.code && <span>Code: {issue.code}</span>}
                     </div>
                  </div>
               </div>
            ))
         )}
      </div>
    </div>
  );
};

export default HealthDashboard;
