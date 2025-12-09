
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { translateEdiToHuman, hasValidApiKey } from '../services/geminiService';

interface HumanReadablePanelProps {
  ediContent: string;
}

const HumanReadablePanel: React.FC<HumanReadablePanelProps> = ({ ediContent }) => {
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ediContent) return;
    
    const translate = async () => {
        setLoading(true);
        try {
            if (!hasValidApiKey()) {
                setTranslatedContent("# API Key Required\nPlease add your Gemini API Key in settings to enable AI translation.");
            } else {
                const text = await translateEdiToHuman(ediContent);
                setTranslatedContent(text);
            }
        } catch (e) {
            setTranslatedContent("# Translation Failed\nCould not generate business view.");
        } finally {
            setLoading(false);
        }
    };

    translate();
  }, [ediContent]);

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                  <Loader2 className="w-12 h-12 animate-spin text-blue-400 relative z-10" />
              </div>
              <p className="text-sm font-medium animate-pulse">Generating Business Document...</p>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-800 overflow-hidden">
       {/* Document Header Visual */}
       <div className="h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 flex-none"></div>
       
       <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl min-h-[800px] p-10 border border-slate-200">
             <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <FileText size={24} />
                   </div>
                   <h2 className="text-xl font-bold text-slate-800">Business View</h2>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                   <Sparkles size={12} className="text-purple-400" />
                   AI Generated
                </div>
             </div>
             
             <div className="prose prose-sm prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-lg prose-table:border-collapse prose-th:bg-slate-50 prose-th:p-2 prose-td:p-2 prose-tr:border-b prose-tr:border-slate-100">
                <ReactMarkdown>
                   {translatedContent || "No content available."}
                </ReactMarkdown>
             </div>
          </div>
       </div>
    </div>
  );
};

export default HumanReadablePanel;
