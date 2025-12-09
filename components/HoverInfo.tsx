
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Sparkles, Pin, X, AlertTriangle, ExternalLink, Lock, Lightbulb } from 'lucide-react';
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
  
  // Ref for auto-positioning
  const cardRef = useRef<HTMLDivElement>(null);
  const smartPos = useSmartPopupPosition(cardRef, position, 15);

  // Schema can be ElementSchema or SegmentSchema depending on token type
  const schema = token.schema as (ElementSchema & SegmentSchema) | undefined;
  
  // Determine Type
  const isSegment = token.type === 'SEGMENT_ID';
  const title = isSegment ? `${token.value} Segment` : `${token.fullId}`;
  
  // Construct a safe description
  let description = schema?.name || "Unknown Element";
  if (!schema?.name && isSegment) description = "Unknown Segment";

  // Qualifier Lookup
  let qualifierDesc = null;
  if (!isSegment && schema?.qualifiers && token.value) {
    qualifierDesc = schema.qualifiers[token.value];
  }

  // Generate Stedi Documentation Link
  const stediUrl = `https://www.stedi.com/edi/x12/segment/${segmentId}`;

  const handleAiExplain = async () => {
    // 0. Check API Key
    if (!hasValidApiKey()) {
        setIsLocked(true);
        return;
    }
    
    setIsLocked(false);
    const cacheKey = `${segmentId}:${token.fullId || 'SEG'}:${token.value}`;
    
    // 1. Check Cache First for Instant Response
    if (explanationCache.has(cacheKey)) {
        setAiExplanation(explanationCache.get(cacheKey)!);
        return;
    }

    // Abort previous request if active
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
      
      // IMPROVED PROMPT
      const prompt = `
      Act as an expert EDI Business Analyst. 
      Provide a **detailed business explanation (2-3 sentences)** of this specific data element or segment.
      
      Rules:
      1. Explain what the value "${token.value}" represents in a REAL-WORLD business context.
      2. If it is a code (e.g., '00', 'EA', 'CA'), translate it to its full meaning using standard X12/EDIFACT definitions.
      3. Contextualize it within the Segment ${segmentId} (${isSegment ? description : 'Parent Segment'}).
      4. Use professional language suitable for a supply chain manager.
      
      Example Output: "This date element indicates the Purchase Order Date is March 1st, 2024. It establishes the official creation date of the order contract, which serves as the baseline for delivery windows and payment terms."
      
      Context:
      - Standard: ${token.schema ? 'X12/EDIFACT' : 'Unknown'}
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
          explanationCache.set(cacheKey, text); // Cache result
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
    
    // Trigger automatically on hover with slightly longer delay to avoid flickering
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

  // Use Portal to escape stacking contexts. Z-Index increased to 99999.
  // Updated to Dark Theme for premium look and high contrast.
  return createPortal(
    <div 
      ref={cardRef}
      className={`fixed z-[99999] bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-700 text-sm font-sans 
        ${isPinned ? 'pointer-events-auto ring-2 ring-indigo-500/50' : 'pointer-events-none'}
        popup--${smartPos.placement} transition-all duration-200 ease-out
        w-[30rem] max-w-[calc(100vw-2rem)]
      `}
      style={{ 
        top: smartPos.top, 
        left: smartPos.left,
        opacity: smartPos.isCalculated ? 1 : 0,
        transform: smartPos.isCalculated ? 'scale(1)' : 'scale(0.95)',
      }}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b border-slate-700 rounded-t-xl flex justify-between items-start ${validationError ? 'bg-red-950/30' : 'bg-slate-800/50'}`}>
        <div>
          <h4 className={`font-bold font-mono flex items-center gap-2 ${validationError ? 'text-red-400' : 'text-slate-100'}`}>
            {title}
            {isPinned && <Pin size={12} className="text-indigo-400 rotate-45" />}
          </h4>
          <p className="text-xs text-slate-400 font-medium mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {schema?.min && (
             <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-700">
               {schema.type} {schema.min}-{schema.max}
             </span>
          )}
          {isPinned && onClose && (
            <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar text-slate-300">
        
        {/* Critical Validation Error Section */}
        {validationError && (
          <div className="bg-red-950/30 border border-red-500/30 p-3 rounded-lg text-xs animate-in slide-in-from-top-1">
             <div className="flex items-center gap-1.5 font-bold text-red-400 mb-1">
               <AlertTriangle size={14} /> Critical Error
             </div>
             <p className="text-red-200 leading-relaxed">{validationError}</p>
          </div>
        )}

        {/* Qualifier Info */}
        {qualifierDesc && (
          <div className="bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-lg text-emerald-300 text-xs">
            <span className="font-semibold block mb-1 text-emerald-400 uppercase tracking-wider text-[10px]">Standard Code</span>
            {qualifierDesc}
          </div>
        )}

        {/* Value Check */}
        {!isSegment && token.value && !qualifierDesc && (
           <div className="flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-800 p-2 rounded border border-slate-700">
             <span className="opacity-50 select-none">VAL</span>
             <span className="font-bold text-slate-200 break-all">{token.value}</span>
           </div>
        )}

        {/* AI Insight Section */}
        <div className="pt-1">
           <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                 <Sparkles size={12} className={loadingAi ? "animate-spin" : "text-indigo-400"} fill={loadingAi ? "currentColor" : "currentColor"} /> 
                 <span>Smart Insight</span>
              </div>
           </div>
           
           {isLocked ? (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-xs text-slate-500 flex items-center gap-2">
                 <Lock size={14} /> <span>Add API Key for explanations</span>
              </div>
           ) : loadingAi ? (
              <div className="space-y-2 p-1">
                 <div className="flex items-center gap-2 text-xs text-indigo-400 animate-pulse">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                    Analyzing business context...
                 </div>
              </div>
           ) : aiExplanation ? (
             <div className="bg-gradient-to-br from-indigo-900/20 to-blue-900/10 border border-indigo-500/30 p-3.5 rounded-xl text-xs text-slate-300 shadow-sm leading-relaxed relative overflow-hidden group">
               <div className="relative z-10 flex gap-2">
                  <Lightbulb size={16} className="text-indigo-400 flex-none mt-0.5" />
                  <span className="leading-5">{aiExplanation}</span>
               </div>
             </div>
           ) : (
             <div className="text-xs text-slate-500 italic pl-1">Hover to generate insight...</div>
           )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 mt-1 border-t border-slate-700 flex justify-between items-center">
           <span className="text-[10px] text-slate-500">{isSegment ? 'Segment' : 'Element'} Definition</span>
           <a 
             href={stediUrl} 
             target="_blank" 
             rel="noreferrer"
             className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors bg-blue-500/10 px-2 py-1 rounded-full hover:bg-blue-500/20 border border-blue-500/20"
           >
             View Spec <ExternalLink size={10} />
           </a>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default HoverInfo;
