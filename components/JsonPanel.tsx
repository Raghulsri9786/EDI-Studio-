import React, { useState } from 'react';
import { Braces, Download, Copy, Check, Play, Loader2 } from 'lucide-react';
import { convertEdiToFormat } from '../services/geminiService';

interface JsonPanelProps {
  ediContent: string;
}

const JsonPanel: React.FC<JsonPanelProps> = ({ ediContent }) => {
  const [jsonOutput, setJsonOutput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConvert = async () => {
    setIsLoading(true);
    try {
      const result = await convertEdiToFormat(ediContent, 'JSON');
      setJsonOutput(result);
    } catch (error) {
      console.error(error);
      setJsonOutput(JSON.stringify({ error: "Failed to convert" }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edi-converted.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e293b]">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-[#0f172a] flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200">
          <Braces size={20} className="text-amber-500" />
          <h3 className="font-semibold text-sm">EDI to JSON Converter</h3>
        </div>
        
        {jsonOutput && (
          <div className="flex gap-2">
             <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden relative">
        {!jsonOutput && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
            <Braces className="w-16 h-16 mb-4 opacity-20" />
            <h4 className="text-lg font-medium text-slate-300 mb-2">Generate JSON Output</h4>
            <p className="text-sm max-w-xs mb-6 opacity-70">
              Transform this EDI file into a developer-friendly JSON object using GenAI.
            </p>
            <button
              onClick={handleConvert}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-all shadow-lg shadow-blue-900/20"
            >
              <Play size={18} fill="currentColor" />
              Convert Now
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
            <p className="text-sm font-medium">Transforming Data Structure...</p>
          </div>
        ) : (
          <div className="h-full overflow-auto custom-scrollbar p-4">
            <pre className="font-mono text-sm text-green-400 bg-[#1e293b]">
              {jsonOutput}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default JsonPanel;