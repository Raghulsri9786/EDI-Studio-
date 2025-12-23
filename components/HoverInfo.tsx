import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Pin, X, BookOpen, Check, RefreshCw, FileJson } from 'lucide-react';
import { ElementSchema, SegmentSchema, EdiToken } from '../types';
import { GoogleGenAI } from "@google/genai";
import { useSmartPopupPosition } from '../hooks/useSmartPopupPosition';

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

  const referenceUrl = `https://ediacademy.com/blog/x12-${segmentId.toLowerCase()}-segment/`;
  const schemaUrl = `https://www.stedi.com/edi/x12/segment/${segmentId}`;

  const handleAiExplain = async (force: boolean = false) => {
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
      // Use process.env.API_KEY directly
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
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
        model: 'gemini-3-flash-preview',
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
        bg-[#0d1117] 
        border border-white/10 rounded-xl 
        shadow-[0_20px_50px_rgba(0,0,0,0.5)]
        font-sans text-slate-200
        w-[400px] overflow-hidden
        pointer-events-auto
        transition-opacity duration-150 ease-out
      `}
      style={{ 
        top: smartPos.top, 
        left: smartPos.left,
        opacity: opacity,
      }}
    >
      {/* 1. Header Layer */}
      <div className="px-4 py-2.5 bg-[#161b22] border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden text-xs leading-none w-full">
             <span className="font-bold text-blue-400 font-mono flex-none bg-blue-500/10 px-1.5 py-0.5 rounded">{displayId}</span>
             
             {schema?.type && (
               <span className="font-mono text-[10px] text-slate-500 flex-none uppercase border border-white/5 px-1 rounded">{schema.type} {schema.min}-{schema.max}</span>
             )}

             {!isSegment && token.value && (
                <>
                  <span className="text-slate-600 flex-none">•</span>
                  <span 
                    className="font-mono font-bold text-emerald-400 flex-none truncate max-w-[120px] cursor-pointer hover:underline" 
                    title="Click to copy"
                    onClick={handleCopyValue}
                  >
                    {token.value}
                  </span>
                  {copied && <Check size={10} className="text-emerald-500 flex-none" />}
                </>
             )}
             
             <span className="text-slate-500 flex-none mx-1">—</span>
             <span className="text-slate-300 truncate font-semibold text-[11px]" title={description}>{description}</span>
        </div>
        
        <div className="flex items-center gap-1 flex-none ml-2">
          <button 
            onClick={onPin}
            className={`p-1.5 rounded-lg transition-all ${isPinned ? 'text-blue-400 bg-blue-500/20 shadow-[inset_0_0_8px_rgba(59,130,246,0.2)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
          >
            <Pin size={14} className={isPinned ? "fill-current" : ""} />
          </button>
          {isPinned && onClose && (
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Business Insight Layer */}
      <div className="px-4 py-3 bg-[#0d1117]">
         <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
               <Sparkles size={10} /> Business Insight
            </span>
            <button 
                onClick={(e) => { e.stopPropagation(); handleAiExplain(true); }}
                className="ml-auto p-1 text-slate-600 hover:text-blue-400 transition-colors bg-white/5 rounded"
                title="Refresh Insight"
            >
                <RefreshCw size={10} className={loadingAi ? "animate-spin" : ""} />
            </button>
         </div>
         
         <div className="text-xs text-slate-300 leading-relaxed mb-4 min-h-[1.5rem]">
             {loadingAi ? (
               <span className="animate-pulse text-slate-600 italic">Thinking...</span>
             ) : (
               <>
                 {aiExplanation || <span className="text-slate-600 italic">No business context available.</span>}
                 {qualifierDesc && <span className="text-blue-400 font-bold ml-1">({qualifierDesc})</span>}
               </>
             )}
         </div>

         {/* 3. Footer Actions (Standard Ref & View Schema) */}
         <div className="flex items-center gap-2 pt-3 border-t border-white/5">
            <a 
              href={referenceUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800/50 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg transition-all border border-white/5 hover:text-white"
            >
              <BookOpen size={12} /> Standard Reference
            </a>
            <a 
              href={schemaUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600/10 hover:bg-blue-600/20 text-[10px] font-bold text-blue-400 rounded-lg transition-all border border-blue-500/20 hover:text-blue-300"
            >
              <FileJson size={12} /> View Schema
            </a>
         </div>

         {/* Validation Error Inline */}
         {validationError && (
            <div className="mt-3 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-start gap-2">
               <X size={12} className="text-red-500 mt-0.5 flex-none" />
               <div>
                  <span className="font-bold text-red-400">Structural Issue:</span> {validationError}
               </div>
            </div>
         )}
      </div>
    </div>,
    document.body
  );
};

export default HoverInfo;
