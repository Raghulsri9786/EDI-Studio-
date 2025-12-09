
import React, { useState, useEffect } from 'react';
import { Copy, Check, WrapText, AlignLeft } from 'lucide-react';
import { unwarpEdi } from '../utils/ediFormatter';

interface RawViewerProps {
  content: string;
}

const RawViewer: React.FC<RawViewerProps> = ({ content }) => {
  const [formatted, setFormatted] = useState(false);
  const [displayContent, setDisplayContent] = useState(content);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (formatted) {
      // Use dynamic formatter instead of hardcoded replace
      setDisplayContent(unwarpEdi(content));
    } else {
      setDisplayContent(content);
    }
  }, [formatted, content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!content) return null;

  return (
    <div className="flex flex-col h-full bg-[#1e293b] text-slate-300">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
            RAW INPUT
          </span>
          <span className="text-xs text-slate-500">
            {content.length} chars
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFormatted(!formatted)}
            className={`p-1.5 rounded transition-colors ${formatted ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
            title="Toggle Formatting"
          >
            {formatted ? <AlignLeft size={16} /> : <WrapText size={16} />}
          </button>
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 transition-colors"
            title="Copy Content"
          >
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar p-4 relative">
        <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-all text-slate-300">
          {displayContent}
        </pre>
      </div>
    </div>
  );
};

export default RawViewer;
