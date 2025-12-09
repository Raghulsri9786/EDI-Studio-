
import React, { useState, useMemo } from 'react';
import { Layout, ArrowRight, Save, Database, Cloud, Link2, Code, FileJson, Wand2, Lock, ChevronDown, Loader2 } from 'lucide-react';
import { cloudDataService } from '../services/cloudDataService';
import { generateXsltWithAi } from '../services/geminiService';
import { parseEdiToLines } from '../utils/ediParser';
import { detectDelimiters } from '../utils/ediDetection';
import { ErpSchema, ErpSchemaNode, MappingRule } from '../types';

interface MapperViewProps {
  ediContent: string;
  hasApiKey?: boolean;
}

const MapperView: React.FC<MapperViewProps> = ({ ediContent, hasApiKey = false }) => {
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [availableSchemas, setAvailableSchemas] = useState<{id: string, name: string}[]>([]);
  const [erpSchema, setErpSchema] = useState<ErpSchema | null>(null);
  
  const [mappingRules, setMappingRules] = useState<MappingRule[]>([]);
  const [xsltOutput, setXsltOutput] = useState<string>('');
  const [activeView, setActiveView] = useState<'DESIGN' | 'CODE'>('DESIGN');
  
  // Selection State
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  // 1. Detect Transaction Type Dynamically
  const transactionSet = useMemo(() => {
    const lines = parseEdiToLines(ediContent);
    
    // X12 Strategy: Look for ST segment
    const st = lines.find(l => l.segmentId === 'ST');
    if (st) {
        const id = st.tokens.find(t => t.index === 1)?.value;
        return id || 'Unknown';
    }

    // EDIFACT Strategy: Look for UNH segment
    const unh = lines.find(l => l.segmentId === 'UNH');
    if (unh) {
        const idComp = unh.tokens.find(t => t.index === 2)?.value;
        if (idComp) {
            // Split by component delimiter if present (e.g. ORDERS:D:96A)
            const { component } = detectDelimiters(ediContent);
            return idComp.split(component)[0];
        }
    }

    return 'Unknown';
  }, [ediContent]);

  // 2. Parse EDI Source Tree
  const sourceTree = useMemo(() => {
    const lines = parseEdiToLines(ediContent);
    return lines.map(line => ({
        id: line.segmentId,
        elements: line.tokens.filter(t => t.type === 'ELEMENT').map((t, i) => ({
            id: t.fullId || `${line.segmentId}${i+1}`,
            value: t.value,
            index: t.index
        }))
    }));
  }, [ediContent]);

  const handleConnectCloud = async () => {
    setIsDbConnected(false);
    
    // Connect to Online DB
    const connected = await cloudDataService.connect();
    setIsDbConnected(connected);
    
    if (connected) {
        // Fetch list
        const list = await cloudDataService.getAvailableSchemas();
        setAvailableSchemas(list);
        
        // Auto-fetch schema if available
        if (transactionSet !== 'Unknown') {
            loadSchema(transactionSet);
        }
    } else {
        alert("Could not connect to Cloud Database. Please check your Supabase settings.");
    }
  };

  const loadSchema = async (type: string) => {
    setLoadingSchema(true);
    try {
        const schema = await cloudDataService.fetchSchema(type);
        setErpSchema(schema);
    } catch (e) {
        console.error("Cloud DB Error", e);
    } finally {
        setLoadingSchema(false);
    }
  };
  
  const handleAddRule = () => {
    if (selectedSource && selectedTarget) {
      const newRule: MappingRule = {
        id: Date.now().toString(),
        sourcePath: selectedSource,
        targetPath: selectedTarget
      };
      setMappingRules(prev => [...prev, newRule]);
      setSelectedSource(null);
      setSelectedTarget(null);
    }
  };

  const handleGenerateAiXslt = async () => {
    if (!erpSchema || !erpSchema.rawContent || !hasApiKey) return;
    setIsGenerating(true);
    setActiveView('CODE');
    try {
      const code = await generateXsltWithAi(ediContent, erpSchema.rawContent, transactionSet);
      setXsltOutput(code);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderTargetNode = (node: ErpSchemaNode, path: string) => {
    const fullPath = path ? `${path}/${node.name}` : node.name;
    const isMapped = mappingRules.find(r => r.targetPath === fullPath);
    const isSelected = selectedTarget === fullPath;

    if (node.children && node.children.length > 0) {
      return (
        <div key={fullPath} className="pl-4 border-l border-slate-200 ml-2">
           <div className="flex items-center gap-1 py-1 text-sm text-slate-700 font-medium">
             <ChevronDown size={14} /> {node.name}
           </div>
           {node.children.map(child => renderTargetNode(child, fullPath))}
        </div>
      );
    }

    return (
      <div 
        key={fullPath} 
        onClick={() => setSelectedTarget(fullPath)}
        className={`ml-6 flex items-center justify-between cursor-pointer px-2 py-1 rounded text-sm mb-1 ${isSelected ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' : 'hover:bg-slate-100 text-slate-600'}`}
      >
        <div className="flex items-center gap-2">
           <span className={`w-2 h-2 rounded-full ${isMapped ? 'bg-green-500' : 'bg-slate-300'}`}></span>
           <span>{node.name}</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{node.type}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Header */}
      <div className="flex-none bg-white border-b border-slate-200 p-3 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold font-mono">
                {transactionSet}
              </span>
              <h2 className="text-sm font-bold text-slate-700">Cloud Schema Mapper</h2>
            </div>
            
            {!isDbConnected ? (
               <button onClick={handleConnectCloud} className="flex items-center gap-2 text-xs bg-white border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded text-slate-600 transition-colors">
                 <Cloud size={14} /> Connect Cloud DB
               </button>
            ) : (
               <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded border border-emerald-100 animate-in fade-in">
                 <Database size={14} /> 
                 <span className="font-medium">Online DB Connected</span>
               </div>
            )}
         </div>

         <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 rounded p-0.5 border border-slate-200">
               <button onClick={() => setActiveView('DESIGN')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${activeView === 'DESIGN' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Designer</button>
               <button onClick={() => setActiveView('CODE')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${activeView === 'CODE' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>XSLT</button>
            </div>
            
            <button 
              onClick={handleGenerateAiXslt}
              disabled={!erpSchema || isGenerating || !hasApiKey}
              className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded text-xs font-bold shadow-sm disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : (!hasApiKey ? <Lock size={14} /> : <Wand2 size={14} />)}
              Auto-Map
            </button>
         </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden relative">
         {activeView === 'DESIGN' ? (
           <div className="grid grid-cols-3 h-full divide-x divide-slate-200">
             
             {/* 1. SOURCE */}
             <div className="flex flex-col bg-slate-50 overflow-hidden">
                <div className="p-2 border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Layout size={14} /> EDI Source
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
                   {sourceTree.map((seg, i) => (
                     <div key={i} className="mb-2">
                       <div className="text-xs font-bold text-slate-400 mb-1 pl-2">{seg.id}</div>
                       {seg.elements.map((el) => {
                         const path = `${seg.id}/${el.index < 10 ? '0' + el.index : el.index}`;
                         return (
                           <div 
                             key={el.id}
                             onClick={() => setSelectedSource(path)}
                             className={`flex items-center justify-between px-3 py-1.5 rounded cursor-pointer text-xs mb-1 font-mono transition-colors ${selectedSource === path ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300' : 'bg-white border border-slate-200 text-slate-600'}`}
                           >
                             <span className="font-bold">{el.id}</span>
                             <span className="truncate max-w-[80px] opacity-70">{el.value}</span>
                           </div>
                         );
                       })}
                     </div>
                   ))}
                </div>
             </div>

             {/* 2. MAPPINGS */}
             <div className="flex flex-col bg-white overflow-hidden">
                <div className="p-2 border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                  <span className="flex items-center gap-2"><Link2 size={14} /> Mappings</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 rounded text-slate-600">{mappingRules.length} Rules</span>
                </div>
                
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className={`flex-1 p-2 rounded border text-xs text-center ${selectedSource ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 border-dashed text-slate-400'}`}>
                      {selectedSource || "Select Source"}
                    </div>
                    <ArrowRight size={16} className="text-slate-300" />
                    <div className={`flex-1 p-2 rounded border text-xs text-center ${selectedTarget ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 border-dashed text-slate-400'}`}>
                      {selectedTarget ? selectedTarget.split('/').pop() : "Select Target"}
                    </div>
                  </div>
                  <button onClick={handleAddRule} disabled={!selectedSource || !selectedTarget} className="w-full py-1.5 bg-slate-800 text-white rounded text-xs font-bold disabled:opacity-50">Link Fields</button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-1">
                   {mappingRules.map(rule => (
                     <div key={rule.id} className="flex items-center gap-2 text-xs p-2 rounded border border-slate-100">
                        <span className="font-mono text-purple-600">{rule.sourcePath}</span>
                        <ArrowRight size={12} className="text-slate-300" />
                        <span className="font-mono text-blue-600 truncate flex-1">{rule.targetPath.split('/').pop()}</span>
                     </div>
                   ))}
                </div>
             </div>

             {/* 3. TARGET */}
             <div className="flex flex-col bg-slate-50 overflow-hidden">
                <div className="p-2 border-b border-slate-200 bg-slate-100 text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <FileJson size={14} /> Target Schema
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {!erpSchema ? (
                    <div className="text-center mt-10 text-slate-400">
                      <Cloud size={32} className="mx-auto mb-2 opacity-20" />
                      <p className="text-xs">Connect to Cloud DB to load schema</p>
                    </div>
                  ) : loadingSchema ? (
                    <div className="flex items-center justify-center h-20 text-blue-500"><Loader2 className="animate-spin" /></div>
                  ) : (
                    <div>{erpSchema.root ? renderTargetNode(erpSchema.root, '') : <p className="text-xs text-red-400">Invalid Schema</p>}</div>
                  )}
                </div>
             </div>

           </div>
         ) : (
           <div className="h-full bg-[#1e293b] flex flex-col">
              <div className="flex-none p-2 bg-[#0f172a] border-b border-slate-700 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                   <Code size={14} className="text-purple-400" />
                   <span className="text-xs text-slate-300 font-mono">Generated XSLT</span>
                 </div>
                 <button className="text-xs flex items-center gap-1 text-slate-400 hover:text-white"><Save size={12} /> Save</button>
              </div>
              <textarea className="flex-1 bg-transparent text-slate-300 font-mono text-xs p-4 resize-none outline-none custom-scrollbar" value={xsltOutput} readOnly placeholder="AI Generation Output..." />
           </div>
         )}
      </div>
    </div>
  );
};

export default MapperView;
