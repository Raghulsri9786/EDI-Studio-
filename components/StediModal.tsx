
import React, { useState, useEffect } from 'react';
import { X, Send, Key, Settings, Loader2, CheckCircle, AlertOctagon, RefreshCw } from 'lucide-react';
import { StediConfig, sendToStedi } from '../services/stediService';
import { generateStediGuideJson } from '../services/geminiService';

interface StediModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFileContent: string;
}

const StediModal: React.FC<StediModalProps> = ({ isOpen, onClose, activeFileContent }) => {
  const [config, setConfig] = useState<StediConfig>({
    apiKey: '',
    partnershipId: '',
    transactionSettingId: ''
  });
  
  const [activeTab, setActiveTab] = useState<'CONFIG' | 'PAYLOAD'>('CONFIG');
  const [generatedJson, setGeneratedJson] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load config from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('stedi_config');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save config on change
  useEffect(() => {
    localStorage.setItem('stedi_config', JSON.stringify(config));
  }, [config]);

  const handleGenerate = async () => {
    if (!activeFileContent) return;
    setIsGenerating(true);
    setError(null);
    try {
      const json = await generateStediGuideJson(activeFileContent);
      setGeneratedJson(json);
      setActiveTab('PAYLOAD');
    } catch (e) {
      setError("Failed to generate Stedi Guide JSON.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!generatedJson) return;
    if (!config.apiKey || !config.partnershipId || !config.transactionSettingId) {
        setError("Missing Stedi Configuration. Please check API Key and IDs.");
        return;
    }

    setIsSending(true);
    setError(null);
    setResult(null);

    try {
      const parsedJson = JSON.parse(generatedJson);
      const res = await sendToStedi(config, parsedJson);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Failed to send to Stedi.");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
             <div className="bg-blue-600 text-white p-1.5 rounded">
                <Send size={18} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800">Send to Stedi</h2>
                <p className="text-xs text-slate-500">Outbound Transaction API</p>
             </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
           <button 
             onClick={() => setActiveTab('CONFIG')} 
             className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'CONFIG' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
           >
             1. Configuration
           </button>
           <button 
             onClick={() => setActiveTab('PAYLOAD')} 
             className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'PAYLOAD' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}
           >
             2. Payload & Send
           </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
           {activeTab === 'CONFIG' && (
             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-600 uppercase mb-1">API Key</label>
                   <div className="relative">
                      <Key size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input 
                        type="password" 
                        value={config.apiKey} 
                        onChange={e => setConfig({...config, apiKey: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="stedi-api-key-..."
                      />
                   </div>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Partnership ID</label>
                   <div className="relative">
                      <Settings size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input 
                        type="text" 
                        value={config.partnershipId} 
                        onChange={e => setConfig({...config, partnershipId: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="UUID"
                      />
                   </div>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Transaction Setting ID</label>
                   <div className="relative">
                      <Settings size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input 
                        type="text" 
                        value={config.transactionSettingId} 
                        onChange={e => setConfig({...config, transactionSettingId: e.target.value})}
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="UUID"
                      />
                   </div>
                </div>
                
                <div className="pt-4 flex justify-end">
                   <button 
                     onClick={() => setActiveTab('PAYLOAD')} 
                     className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                   >
                     Next Step
                   </button>
                </div>
             </div>
           )}

           {activeTab === 'PAYLOAD' && (
             <div className="flex flex-col h-full space-y-4">
                <div className="flex justify-between items-center">
                   <h3 className="text-sm font-bold text-slate-700">Guide JSON Payload</h3>
                   <button 
                     onClick={handleGenerate} 
                     disabled={isGenerating}
                     className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                   >
                     {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                     Regenerate from EDI
                   </button>
                </div>
                
                <div className="flex-1 relative">
                   <textarea 
                     value={generatedJson} 
                     onChange={e => setGeneratedJson(e.target.value)}
                     className="w-full h-64 bg-slate-50 border border-slate-300 rounded p-3 font-mono text-xs text-slate-700 outline-none focus:border-blue-500 resize-none custom-scrollbar"
                     placeholder={isGenerating ? "Generating JSON..." : "Click regenerate to convert your active EDI file into Stedi Guide JSON format..."}
                   />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-700 p-3 rounded text-sm flex items-start gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                     <AlertOctagon size={16} className="mt-0.5 flex-none" />
                     <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{error}</div>
                  </div>
                )}

                {result && (
                  <div className="bg-emerald-50 text-emerald-800 p-3 rounded text-sm flex items-start gap-2">
                     <CheckCircle size={16} className="mt-0.5 flex-none" />
                     <div>
                        <div className="font-bold">Success! Transaction Sent.</div>
                        <div className="text-xs font-mono mt-1 opacity-80">File Execution ID: {result.fileExecutionId}</div>
                     </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                   <button 
                     onClick={handleSend}
                     disabled={isSending || !generatedJson}
                     className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-900/10"
                   >
                     {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                     Send to Stedi
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default StediModal;
