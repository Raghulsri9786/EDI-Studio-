
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Sparkles, Pin, X, AlertTriangle, ExternalLink, Lock, Lightbulb, Info } from 'lucide-react';
import { ElementSchema, SegmentSchema, EdiToken } from '../types';
import { GoogleGenAI } from "@google/genai";
import { useSmartPopupPosition } from '../hooks/useSmartPopupPosition';
import { hasValidApiKey, getGeminiKey } from '../services/geminiService';

// Static cache to store AI explanations during the session for instant recall
const explanationCache = new Map<string, string>();

interface HoverInfoProps {
  token: EdiToken;
  position: { x: number; y: number };
  segmentId: string;
  rawSegment: string;
  isPinned?: boolean;
  validationError?: string;
  onClose?: () => void;
}

const HoverInfo: React.FC<HoverInfoProps> = ({ token, position, segmentId, rawSegment, isPinned, validationError, onClose }) => {
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const smartPos = useSmartPopupPosition(cardRef, position, 15);

  const schema = token.schema as (ElementSchema & SegmentSchema) | undefined;
  
  const isSegment = token.type === 'SEGMENT_ID';
  const title = isSegment ? `${token.value} Segment` : `${token.fullId}`;
  
  let description = schema?.name || "Unknown Element";
  if (!schema?.name && isSegment) description = "Unknown Segment";

  let qualifierDesc = null;
  if (!isSegment && schema?.qualifiers && token.value) {
    qualifierDesc = schema.qualifiers[token.value];
  }

  const stediUrl = `https://www.stedi.com/edi/x12/segment/${segmentId}`;

  const handleAiExplain = async () => {
    if (!hasValidApiKey()) {
        setIsLocked(true);
        return;
    }
    
    setIsLocked(false);
    const cacheKey = `${segmentId}:${token.fullId || 'SEG'}:${token.value}`;
    
    if (explanationCache.has(cacheKey)) {
        setAiExplanation(explanationCache.get(cacheKey)!);
        return;
    }

    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingAi(true);
    setAiExplanation(null);
    
    try {
      const apiKey = getGeminiKey();
      if (!apiKey) throw new Error("Key Missing");

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
      Act as an expert EDI Business Analyst. 
      Provide a **detailed business explanation (2-3 sentences)** of this specific data element or segment.
      
      Context:
      - Segment: ${segmentId}
      - Element: ${token.fullId || 'N/A'}
      - Description: ${description}
      - Value: "${token.value}"
      ${qualifierDesc ? `- Qualifier: "${qualifierDesc}"` : ''}
      - Full Line: "${rawSegment}"
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      if (!controller.signal.aborted) {
          const text = response.text?.trim() || "No explanation available.";
          setAiExplanation(text);
          explanationCache.set(cacheKey, text); 
      }
    } catch (e) {
      if (!controller.signal.aborted) {
         console.warn("AI Explanation failed", e);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingAi(false);
      }
    }
  };

  useEffect(() => { 
    setAiExplanation(null); 
    setLoadingAi(false); 
    setIsLocked(false);
    
    const timer = setTimeout(() => {
      handleAiExplain(); 
    }, 500); 
    
    return () => {
        clearTimeout(timer);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };
  }, [token, rawSegment]); 

  return createPortal(
    <div 
      ref={cardRef}
      className={`fixed z-[99999] 
        bg-slate-900/80 backdrop-blur-xl 
        border border-white/10 rounded-2xl 
        shadow-[0_20px_50px_rgba(0,0,0,0.5)] 
        text-sm font-sans 
        ${isPinned ? 'pointer-events-auto ring-1 ring-blue-500/50' : 'pointer-events-none'}
        popup--${smartPos.placement} transition-all duration-300 ease-out
        w-[28rem] max-w-[calc(100vw-2rem)] overflow-hidden
      `}
      style={{ 
        top: smartPos.top, 
        left: smartPos.left,
        opacity: smartPos.isCalculated ? 1 : 0,
        transform: smartPos.isCalculated ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(5px)',
      }}
    >
      {/* Decorative Top Line */}
      <div className={`h-1 w-full ${validationError ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500'}`} />

      {/* Header */}
      <div className="px-5 py-4 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className={`font-bold font-mono text-base ${validationError ? 'text-red-400' : 'text-white'}`}>
                {title}
             </span>
             {schema?.min && (
               <span className="text-[10px] bg-white/5 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-white/5">
                 {schema.type} {schema.min}-{schema.max}
               </span>
             )}
          </div>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {isPinned && (
             <Pin size={14} className="text-blue-400 fill-blue-400/20" />
          )}
          {isPinned && onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/5 mx-5" />

      {/* Body */}
      <div className="p-5 space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar text-slate-300">
        
        {/* Critical Validation Error Section */}
        {validationError && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-xs animate-in slide-in-from-left-2 duration-300">
             <div className="flex items-center gap-2 font-bold text-red-400 mb-1">
               <AlertTriangle size={14} /> Compliance Error
             </div>
             <p className="text-red-200/80 leading-relaxed">{validationError}</p>
          </div>
        )}

        {/* Qualifier Info */}
        {qualifierDesc && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-emerald-200/90 text-xs">
            <span className="font-bold block mb-1 text-emerald-400 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
               <Info size={12} /> Standard Code Definition
            </span>
            {qualifierDesc}
          </div>
        )}

        {/* Value Display */}
        {!isSegment && token.value && !qualifierDesc && (
           <div className="flex items-center gap-3 text-xs bg-white/5 p-3 rounded-lg border border-white/5">
             <span className="text-slate-500 font-mono select-none uppercase text-[10px]">Value</span>
             <span className="font-mono text-white text-sm font-bold break-all">{token.value}</span>
           </div>
        )}

        {/* AI Insight Section */}
        <div>
           <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                 <Sparkles size={12} className={loadingAi ? "animate-spin text-indigo-400" : "text-indigo-400"} /> 
                 <span>Business Insight</span>
              </div>
           </div>
           
           {isLocked ? (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-white/5 text-xs text-slate-500 flex items-center gap-2">
                 <Lock size={14} /> <span>Add API Key for AI insights</span>
              </div>
           ) : loadingAi ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse pl-1">
                 <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                 Analyzing context...
              </div>
           ) : aiExplanation ? (
             <div className="p-0 text-xs text-slate-300 leading-relaxed relative group">
               <div className="flex gap-3">
                  <div className="mt-0.5 min-w-[3px] bg-indigo-500/50 rounded-full"></div>
                  <span>{aiExplanation}</span>
               </div>
             </div>
           ) : (
             <div className="text-xs text-slate-600 italic pl-1">Hover longer to generate insight...</div>
           )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
         <span className="text-[10px] text-slate-500 font-medium">Standard Reference</span>
         <a 
           href={stediUrl} 
           target="_blank" 
           rel="noreferrer"
           className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors group"
         >
           View Schema <ExternalLink size={10} className="opacity-50 group-hover:opacity-100 transition-opacity" />
         </a>
      </div>
    </div>,
    document.body
  );
};

export default HoverInfo;
