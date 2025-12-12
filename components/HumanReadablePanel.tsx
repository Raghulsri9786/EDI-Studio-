
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText, Loader2, Sparkles, X, Printer, Copy, Check } from 'lucide-react';
import { translateEdiToHuman, hasValidApiKey } from '../services/geminiService';
import { animatePanelEnter, animatePanelExit } from '../utils/gsapAnimations';

interface HumanReadablePanelProps {
  ediContent: string;
  onClose?: () => void;
}

const HumanReadablePanel: React.FC<HumanReadablePanelProps> = ({ ediContent, onClose }) => {
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Entrance Animation
  useEffect(() => {
    if (panelRef.current) {
        animatePanelEnter(panelRef.current);
    }
  }, []);

  // ESC Key Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!ediContent) return;
    
    const translate = async () => {
        setLoading(true);
        try {
            if (!hasValidApiKey()) {
                setTranslatedContent("# API Key Required\n\nPlease add your Gemini API Key in settings to enable AI translation of this document.");
            } else {
                const text = await translateEdiToHuman(ediContent);
                setTranslatedContent(text);
            }
        } catch (e) {
            setTranslatedContent("# Translation Failed\n\nCould not generate business view. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    translate();
  }, [ediContent]);

  const handleCopy = () => {
    if (translatedContent) {
        navigator.clipboard.writeText(translatedContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
      if (panelRef.current && onClose) {
          animatePanelExit(panelRef.current, onClose);
      } else if (onClose) {
          onClose();
      }
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-full bg-slate-900/50 backdrop-blur-sm z-20 absolute inset-0">
              <div className="relative mb-4">
                  <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                  <Loader2 className="w-12 h-12 animate-spin text-blue-400 relative z-10" />
              </div>
              <p className="text-sm font-medium text-slate-300 animate-pulse">Generating Business Document...</p>
          </div>
      );
  }

  return (
    <div ref={panelRef} className="h-full flex flex-col bg-slate-50 text-slate-800 relative z-10 shadow-2xl">
       {/* Toolbar Header */}
       <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm flex-none">
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                <FileText size={18} />
             </div>
             <div>
                <h2 className="text-sm font-bold text-slate-800">Business View</h2>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">AI Generated Report</span>
                </div>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
               onClick={handleCopy}
               className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
               title="Copy to Clipboard"
             >
               {copied ? <Check size={16} className="text-emerald-500"/> : <Copy size={16} />}
             </button>
             <div className="h-4 w-px bg-slate-200 mx-1"></div>
             <button 
               onClick={handleClose}
               className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
               title="Close View (Esc)"
             >
               <X size={18} />
             </button>
          </div>
       </div>
       
       {/* Document Content */}
       <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-100 p-6 md:p-10">
          <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-xl min-h-[800px] p-10 border border-slate-200 relative">
             {/* Document Watermark/Badge */}
             <div className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-600 rounded-full border border-purple-100 text-[10px] font-bold uppercase tracking-wider select-none">
                <Sparkles size={10} /> AI Insight
             </div>

             <div className="prose prose-sm prose-slate max-w-none 
                prose-headings:font-bold prose-headings:text-slate-800
                prose-h1:text-2xl prose-h1:mb-6 prose-h1:pb-4 prose-h1:border-b prose-h1:border-slate-100
                prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-blue-700
                prose-h3:text-sm prose-h3:uppercase prose-h3:tracking-wide prose-h3:text-slate-500 prose-h3:mt-6
                prose-p:text-slate-600 prose-p:leading-relaxed
                prose-strong:text-slate-800
                prose-li:text-slate-600
                prose-table:border-collapse prose-table:w-full prose-table:my-6 prose-table:border prose-table:border-slate-200 prose-table:rounded-lg prose-table:overflow-hidden
                prose-th:bg-slate-50 prose-th:p-3 prose-th:text-left prose-th:text-xs prose-th:uppercase prose-th:text-slate-500 prose-th:font-semibold prose-th:border-b prose-th:border-slate-200
                prose-td:p-3 prose-td:text-sm prose-td:border-b prose-td:border-slate-100 prose-td:text-slate-700
                prose-tr:last:border-0 hover:prose-tr:bg-slate-50/50
             ">
                <ReactMarkdown>
                   {translatedContent || "No content available."}
                </ReactMarkdown>
             </div>
          </div>
          
          <div className="max-w-4xl mx-auto mt-6 text-center">
             <p className="text-[10px] text-slate-400">Generated by EDI Insight AI. Verify all details against original source.</p>
          </div>
       </div>
    </div>
  );
};

export default HumanReadablePanel;
