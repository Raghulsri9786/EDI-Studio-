
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Pin, X, BookOpen, Check, RefreshCw } from 'lucide-react';
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
    
    const cacheKey = `${segmentId}:${token.fullId || 'SEG'}:${token.value}`;
    
    if (!force && explanationCache.has(cacheKey)) {
        setAiExplanation(explanationCache.get(cacheKey)!);
        return;
    }

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
      
      const prompt = `
      Write exactly ONE short sentence (under 15 words) explaining the BUSINESS meaning of this EDI value.
      
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
          explanationCache.set(cacheKey, text); 
          setAiExplanation(text);
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

  const opacity = smartPos.isCalculated ? 1 : 0;

  return createPortal(
    <div 
      ref={cardRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`fixed z-[99999] 
        bg-[#0f172a] 
        border border-blue-500/30 rounded-lg 
        shadow-2xl shadow-black/60
        font-sans text-slate-200
        w-[380px] overflow-hidden
        pointer-events-auto
        transition-opacity duration-150 ease-out
      `}
      style={{ 
        top: smartPos.top, 
        left: smartPos.left,
        opacity: opacity,
      }}
    >
      {/* 1. Header Layer: ID • Type • Value Lading Quantity */}
      <div className="px-3 py-1.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden text-xs leading-none w-full">
             {/* ID */}
             <span className="font-bold text-white font-mono flex-none">{displayId}</span>
             
             {/* Type */}
             {schema?.type && (
               <>
                 <span className="text-slate-600 flex-none">•</span>
                 <span className="font-mono text-[10px] text-slate-500 flex-none uppercase">{schema.type} {schema.min}-{schema.max}</span>
               </>
             )}

             {/* Value */}
             {!isSegment && token.value && (
                <>
                  <span className="text-slate-600 flex-none">•</span>
                  <span 
                    className="font-mono font-bold text-cyan-400 flex-none truncate max-w-[100px] cursor-pointer hover:underline" 
                    title="Click to copy"
                    onClick={handleCopyValue}
                  >
                    {token.value}
                  </span>
                  {copied && <Check size={10} className="text-emerald-500 flex-none" />}
                </>
             )}
             
             {/* Description */}
             <span className="text-slate-600 flex-none mx-1">-</span>
             <span className="text-slate-300 truncate font-medium text-[11px]" title={description}>{description}</span>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-1 flex-none ml-2">
          <button 
            onClick={onPin}
            className={`p-1 rounded transition-colors ${isPinned ? 'text-blue-400 bg-blue-500/10' : 'text-slate-600 hover:text-white hover:bg-white/10'}`}
          >
            <Pin size={12} className={isPinned ? "fill-current" : ""} />
          </button>
          {isPinned && onClose && (
            <button onClick={onClose} className="p-1 text-slate-600 hover:text-white hover:bg-white/10 rounded transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Business Insight & Links Layer */}
      <div className="px-3 py-2 bg-[#0b1120]">
         <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide flex-none">
               Business Insight:
            </span>
            <button 
                onClick={(e) => { e.stopPropagation(); handleAiExplain(true); }}
                className="ml-auto text-slate-600 hover:text-indigo-400 transition-colors"
                title="Regenerate"
            >
                <RefreshCw size={9} className={loadingAi ? "animate-spin" : ""} />
            </button>
         </div>
         
         <div className="text-xs text-slate-300 leading-snug">
             {loadingAi ? (
               <span className="animate-pulse text-slate-500">Analysing context...</span>
             ) : (
               <>
                 {aiExplanation || <span className="text-slate-500 italic">No insight available.</span>}
                 {qualifierDesc && <span className="text-emerald-400 ml-1">({qualifierDesc})</span>}
               </>
             )}
             
             {/* Merged Footer Links */}
             <span className="inline-block ml-3">
               <span className="text-slate-600 mr-2">•</span>
               <a href={stediUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-300 hover:underline">Standard Reference</a>
               <span className="text-slate-600 mx-2">•</span>
               <a href={stediUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-300 hover:underline">View Schema</a>
             </span>
         </div>

         {/* Validation Error Inline */}
         {validationError && (
            <div className="mt-2 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1 flex items-start gap-1">
               <span className="font-bold">Error:</span> {validationError}
            </div>
         )}
      </div>
    </div>,
    document.body
  );
};

export default HoverInfo;
