
import React, { useState, useRef } from 'react';
import { Book, Plus, Upload, Check, Trash2, Shield, Loader2, Play, FileText, X, AlertOctagon, AlertTriangle } from 'lucide-react';
import { TPRuleSet } from '../types';
import { extractValidationRules, hasValidApiKey } from '../services/geminiService';

interface ValidationRulesPanelProps {
  ruleSets: TPRuleSet[];
  onUpdateRuleSets: (sets: TPRuleSet[]) => void;
  onClose: () => void;
}

const ValidationRulesPanel: React.FC<ValidationRulesPanelProps> = ({ ruleSets, onUpdateRuleSets, onClose }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'TEXT' | 'FILE'>('TEXT');
  const [specText, setSpecText] = useState('');
  const [specFile, setSpecFile] = useState<{ name: string, type: string, data: any } | null>(null);
  const [specName, setSpecName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggle = (id: string) => {
    const updated = ruleSets.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    onUpdateRuleSets(updated);
  };

  const handleDelete = (id: string) => {
    if(confirm("Delete this rule set?")) {
        onUpdateRuleSets(ruleSets.filter(r => r.id !== id));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // We only process TEXT content locally if it's simple text. 
    // For PDFs or Images, we read as base64 to send to Gemini.
    const isText = file.type.includes('text') || file.type.includes('json') || file.name.endsWith('.md') || file.name.endsWith('.txt');
    const reader = new FileReader();

    reader.onload = (evt) => {
        const result = evt.target?.result as string;
        if (isText) {
            setSpecFile({ name: file.name, type: 'text/plain', data: result });
        } else {
            // Binary (PDF/Image) -> Base64
            const b64 = result.split(',')[1]; // Remove data:application/pdf;base64, prefix
            setSpecFile({ name: file.name, type: file.type, data: b64 });
        }
        if (!specName) setSpecName(file.name.split('.')[0]); // Auto-fill name
    };

    if (isText) {
        reader.readAsText(file);
    } else {
        reader.readAsDataURL(file);
    }
  };

  const handleImport = async () => {
    if (!specName) return;
    if (importMode === 'TEXT' && !specText) return;
    if (importMode === 'FILE' && !specFile) return;

    setIsProcessing(true);
    try {
        let rules;
        if (importMode === 'FILE' && specFile) {
            // If it's a text file read as text, treat as string input
            if (specFile.type === 'text/plain') {
                rules = await extractValidationRules(specFile.data);
            } else {
                // Binary (PDF/Doc) -> Inline Data
                rules = await extractValidationRules({ mimeType: specFile.type, data: specFile.data });
            }
        } else {
            // Raw text paste
            rules = await extractValidationRules(specText);
        }

        const newSet: TPRuleSet = {
            id: Date.now().toString(),
            name: specName,
            transactionType: "Unknown", 
            rules: rules,
            isActive: true,
            rawSpecText: importMode === 'TEXT' ? specText : `Imported from file: ${specFile?.name}`
        };
        onUpdateRuleSets([...ruleSets, newSet]);
        
        // Reset
        setIsImporting(false);
        setSpecText('');
        setSpecName('');
        setSpecFile(null);
    } catch (e) {
        alert("Failed to extract rules. Please check the file format or API Key.");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-white/5">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
         <h3 className="font-bold text-slate-200 flex items-center gap-2">
            <Shield size={16} className="text-emerald-400" />
            Validation Rules
         </h3>
         <button onClick={onClose} className="text-xs text-slate-500 hover:text-white">Close</button>
      </div>

      {!isImporting ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {ruleSets.length === 0 && (
               <div className="text-center text-slate-500 py-8 text-sm px-4">
                   <Shield size={32} className="mx-auto mb-3 opacity-20" />
                   No custom rules loaded. <br/> Import a PDF/Text spec to enforce specific TP requirements.
               </div>
           )}
           
           {ruleSets.map(set => {
               const errorCount = set.rules.filter(r => r.severity === 'ERROR').length;
               const warningCount = set.rules.filter(r => r.severity === 'WARNING').length;

               return (
                   <div key={set.id} className={`p-3 rounded-xl border transition-all ${set.isActive ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-slate-800 border-white/5 opacity-70'}`}>
                       <div className="flex items-center justify-between mb-2">
                           <div className="font-bold text-sm text-slate-200 truncate pr-2">{set.name}</div>
                           <button onClick={() => handleDelete(set.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
                       </div>
                       
                       <div className="flex gap-3 mb-3">
                           <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                               <AlertOctagon size={10} className="text-red-400" />
                               {errorCount} Errors
                           </div>
                           <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                               <AlertTriangle size={10} className="text-amber-400" />
                               {warningCount} Warnings
                           </div>
                       </div>

                       <div className="flex items-center gap-2">
                           <button 
                             onClick={() => handleToggle(set.id)}
                             className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${set.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                           >
                               {set.isActive ? <Check size={12} /> : null}
                               {set.isActive ? 'Active' : 'Enable'}
                           </button>
                       </div>
                   </div>
               );
           })}

           <button 
             onClick={() => setIsImporting(true)}
             className="w-full py-3 border border-dashed border-slate-600 rounded-xl text-slate-400 hover:text-white hover:border-slate-400 hover:bg-slate-800 transition-all text-xs font-bold flex items-center justify-center gap-2"
           >
             <Plus size={14} /> Import New Spec
           </button>
        </div>
      ) : (
        <div className="flex-1 p-4 flex flex-col gap-4">
            <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Rule Set Name</label>
                <input 
                  value={specName}
                  onChange={(e) => setSpecName(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded p-2 text-sm text-white mt-1 outline-none focus:border-blue-500"
                  placeholder="e.g. Walmart 850 Guidelines"
                />
            </div>

            {/* Import Mode Toggle */}
            <div className="flex bg-slate-800 p-1 rounded-lg">
                <button 
                  onClick={() => setImportMode('TEXT')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${importMode === 'TEXT' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Paste Text
                </button>
                <button 
                  onClick={() => setImportMode('FILE')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${importMode === 'FILE' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                >
                  Upload File
                </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {importMode === 'TEXT' ? (
                    <>
                        <label className="text-xs font-bold text-slate-500 uppercase">Paste Spec Text</label>
                        <textarea 
                          value={specText}
                          onChange={(e) => setSpecText(e.target.value)}
                          className="flex-1 bg-slate-800 border border-white/10 rounded p-2 text-xs font-mono text-slate-300 mt-1 resize-none focus:outline-none focus:border-blue-500"
                          placeholder="Paste requirements here (e.g. 'BEG02 must be 00', 'REF*DP is required')..."
                        />
                    </>
                ) : (
                    <>
                        <label className="text-xs font-bold text-slate-500 uppercase">Upload Document</label>
                        <div 
                            className="flex-1 mt-1 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center p-6 text-center hover:bg-slate-800/50 transition-colors cursor-pointer relative group"
                            onClick={() => !specFile && fileInputRef.current?.click()}
                        >
                            {!specFile ? (
                                <>
                                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Upload size={20} className="text-blue-400" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-300">Click to upload specification</p>
                                    <p className="text-xs text-slate-500 mt-1">PDF, TXT, JSON supported</p>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept=".pdf,.txt,.json,.md,.csv" 
                                        onChange={handleFileUpload} 
                                    />
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center relative">
                                    <div className="w-16 h-16 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 border border-blue-500/20">
                                        <FileText size={32} className="text-blue-400" />
                                    </div>
                                    <p className="text-sm font-bold text-white max-w-[200px] truncate">{specFile.name}</p>
                                    <p className="text-xs text-slate-500 uppercase mt-1">{specFile.type.split('/')[1] || 'FILE'}</p>
                                    
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setSpecFile(null); setSpecName(''); }}
                                        className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 border border-white/5"
                                    >
                                        <X size={12} /> Remove
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            
            <div className="flex gap-2 mt-auto pt-2">
                <button onClick={() => setIsImporting(false)} className="flex-1 py-2.5 bg-slate-800 text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-700">Cancel</button>
                <button 
                  onClick={handleImport}
                  disabled={isProcessing || !hasValidApiKey() || (!specText && !specFile)}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Extract Rules
                </button>
            </div>
            {!hasValidApiKey() && <p className="text-[10px] text-center text-amber-500">AI Key Required for extraction.</p>}
        </div>
      )}
    </div>
  );
};

export default ValidationRulesPanel;
