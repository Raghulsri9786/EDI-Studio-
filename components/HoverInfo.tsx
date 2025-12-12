
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Pin, X, BookOpen, Copy, Check, RefreshCw } from 'lucide-react';
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
  onPin?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const HoverInfo: React.FC<HoverInfoProps> = ({ 
  token, 
  position, 
  segmentId, 
  rawSegment, 
  isPinned, 
  validationError, 
  onClose,
  onPin,
  onMouseEnter,
  onMouseLeave
}) => {
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);
  // Reduced offset for tighter feel
  const smartPos = useSmartPopupPosition(cardRef, position, 8);

  const schema = token.schema as (ElementSchema & SegmentSchema) | undefined;
  
  const isSegment = token.type === 'SEGMENT_ID';
  const displayId = isSegment ? segmentId : (token.fullId || schema?.id || 'UNK');
  
  let description = schema?.name || "Unknown Element";
  if (!schema?.name && isSegment) description = "Unknown Segment Definition";

  let qualifierDesc = null;
  if (!isSegment && schema?.qualifiers && token.value) {
    qualifierDesc = schema.qualifiers[token.value];
  }

  const stediUrl = `https://www.stedi.com/edi/x12/segment/${segmentId}`;

  const handleAiExplain = async (force: boolean = false) => {
    if (!hasValidApiKey()) return;
    
    // Create a unique key for caching based on the element and its value
    const cacheKey = `${segmentId}:${token.fullId || 'SEG'}:${token.value}`;
    
    // Check cache first
    if (!force && explanationCache.has(cacheKey)) {
        setAiExplanation(explanationCache.get(cacheKey)!);
        return;
    }

    // Abort previous request if hovering quickly
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoadingAi(true);
    if(force) setAiExplanation(null);
    
    try {
      const apiKey = getGeminiKey();
      if (!apiKey) throw new Error("Key Missing");

      const ai = new GoogleGenAI({ apiKey });
      
      // Strict prompt for speed and brevity
      const prompt = `
      Write exactly ONE short sentence (under 12 words) explaining the BUSINESS meaning of this EDI value.
      
      Context: Segment ${segmentId}, Element ${token.fullId || 'N/A'}
      Description: ${description}
      Value: "${token.value}"
      ${qualifierDesc ? `Qualifier: "${qualifierDesc}"` : ''}
      
      NO filler words. NO "This element represents". Just the insight.
      Example: "Shipment total weight in pounds."
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      
      if (!controller.signal.aborted) {
          const text = response.text?.trim() || "No insight available.";
          // Cache the result
          explanationCache.set(cacheKey, text); 
          setAiExplanation(text);
      }
    } catch (e) {
      if (!controller.signal.aborted) {
         // Silently fail or show minimal error
         console.warn("AI Explanation failed", e);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingAi(false);
      }
    }
  };

  const handleCopyValue = () => {
    if (token.value) {
        navigator.clipboard.writeText(token.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => { 
    setAiExplanation(null); 
    setLoadingAi(false); 
    
    // Very fast debounce to trigger AI almost instantly but allow cursor transit
    const timer = setTimeout(() => {
      handleAiExplain(); 
    }, 50); 
    
    return () => {
        clearTimeout(timer);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };
  }, [token, rawSegment]); 

  // Don't render until position is calculated to avoid jump
  const opacity = smartPos.isCalculated ? 1 : 0;

  return createPortal(
    <div 
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`fixed z-[99999] 
        bg-[#0f172a] 
        border border-blue-500/20 rounded-lg 
        shadow-2xl shadow-black/50
        font-sans text-slate-200
        w-[280px] overflow-hidden
        pointer-events-auto
        transition-opacity duration-150 ease-out
      `}
      style={{ 
        top: smartPos.top, 
        left: smartPos.left,
        opacity: opacity,
      }}
    >
      {/* 1. Compact Header */}
      <div className="px-3 py-2 bg-slate-900/80 border-b border-white/5 flex items-start justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-0.5">
             <span className="font-bold text-sm text-white font-mono tracking-tight">{displayId}</span>
             {schema?.type && (
               <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-px rounded font-mono border border-white/5">
                 {schema.type} {schema.min}-{schema.max}
               </span>
             )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium leading-tight truncate w-full" title={description}>
            {description}
          </p>
        </div>
        
        <div className="flex items-center gap-1 -mr-1 flex-none">
          <button 
            onClick={onPin}
            className={`p-1 rounded transition-colors ${isPinned ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
          >
            <Pin size={12} className={isPinned ? "fill-current" : ""} />
          </button>
          {isPinned && onClose && (
            <button onClick={onClose} className="p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        
        {/* 2. Ultra-Compact Value Row */}
        {!isSegment && token.value && (
           <div 
             className="bg-[#1e293b] rounded-md px-3 py-2 border border-white/5 flex items-center justify-between group cursor-pointer hover:border-blue-500/30 transition-colors"
             onClick={handleCopyValue}
             title="Click to Copy"
           >
              <span className="font-mono text-sm text-white font-semibold truncate mr-4">
                {token.value}
              </span>
              <div className="flex items-center gap-1.5 flex-none">
                 {copied ? <Check size={10} className="text-emerald-500" /> : null}
                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">VALUE</span>
              </div>
           </div>
        )}

        {/* 3. Qualifier (if exists) */}
        {qualifierDesc && (
           <div className="flex items-start gap-2 px-1">
              <div className="mt-1 w-1 h-1 rounded-full bg-emerald-500 flex-none"></div>
              <span className="text-[10px] text-emerald-300 leading-tight">{qualifierDesc}</span>
           </div>
        )}

        {/* 4. AI Insight (Minimalist) */}
        <div className="relative pl-2.5 pt-0.5">
           <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
           
           <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                 <Sparkles size={8} /> Business Insight
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleAiExplain(true); }}
                className="text-slate-600 hover:text-indigo-400 transition-colors"
                title="Regenerate"
              >
                <RefreshCw size={8} className={loadingAi ? "animate-spin" : ""} />
              </button>
           </div>
           
           <div className="text-[11px] text-slate-300 leading-snug min-h-[16px]">
             {loadingAi ? (
               <span className="animate-pulse text-slate-500"> analyzing...</span>
             ) : aiExplanation ? (
               aiExplanation
             ) : (
               <span className="text-slate-600 italic">No insight available.</span>
             )}
           </div>
        </div>

        {/* 5. Error (Conditional) */}
        {validationError && (
          <div className="bg-red-500/10 border border-red-500/20 px-2 py-1.5 rounded text-[10px] text-red-200 leading-tight">
             <span className="font-bold text-red-400 mr-1">Error:</span>
             {validationError}
          </div>
        )}
      </div>
      
      {/* 6. Footer */}
      <div className="px-3 py-1.5 bg-[#0b1120] border-t border-white/5 flex justify-between items-center text-[9px]">
         <span className="text-slate-600">Standard Reference</span>
         <a 
           href={stediUrl} 
           target="_blank" 
           rel="noreferrer"
           className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-medium hover:underline"
         >
           <BookOpen size={8} /> View Schema
         </a>
      </div>
    </div>,
    document.body
  );
};

export default HoverInfo;
