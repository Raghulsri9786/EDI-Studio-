import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Loader2, BrainCircuit, Globe, Sparkles, Image, Film, ChevronUp, X, ListTree } from 'lucide-react';
import { EdiAnalysisResult, ChatMessage, EdiFile, PanelTab, OrchestratedResult, TPRuleSet } from '../types';
import { sendEdiChat, generateEdiFlowImage, generateEdiFlowVideo } from '../services/geminiService';
import { validationOrchestrator } from '../services/validationOrchestrator';
import JsonPanel from './JsonPanel';
import Toolbox from './Toolbox';
import HealthDashboard from './HealthDashboard';
import StructurePanel from './StructurePanel';
import { animateNewMessage, staggerListItems } from '../utils/gsapAnimations';

interface AnalysisPanelProps {
  activeTab: PanelTab;
  analysis: EdiAnalysisResult | null;
  activeFileContent: string;
  contextFiles: EdiFile[];
  loading: boolean;
  onUpdateContent: (c: string) => void;
  onClose: () => void;
  onSplitFiles?: (files: { name: string; content: string }[]) => void;
  onStediClick?: () => void;
  isFullScreen?: boolean;
  onJumpToLine?: (line: number) => void;
  ruleSets?: TPRuleSet[];
  aiProvider?: 'gemini' | 'deepseek';
}

type ChatMode = 'standard' | 'thinking' | 'search' | 'image' | 'video';

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  activeTab,
  activeFileContent, 
  contextFiles, 
  onUpdateContent,
  onClose,
  isFullScreen = false,
  onJumpToLine,
  ruleSets = [],
  aiProvider = 'gemini'
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [chatMode, setChatMode] = useState<ChatMode>('standard');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  
  const [orchestratedResult, setOrchestratedResult] = useState<OrchestratedResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [conversionResult, setConversionResult] = useState<{content: string, format: string} | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let isMounted = true;
    const runValidation = async () => {
      if (!activeFileContent) return;
      setValidating(true);
      try {
        const result = await validationOrchestrator.validate(activeFileContent, {
          useAi: true,
          activeRuleSets: ruleSets,
          aiProvider: aiProvider as 'gemini' | 'deepseek'
        });
        if (isMounted) setOrchestratedResult(result);
      } catch (err) {
        console.error("Validation failed:", err);
      } finally {
        if (isMounted) setValidating(false);
      }
    };
    const debounce = setTimeout(runValidation, 500);
    return () => { isMounted = false; clearTimeout(debounce); };
  }, [activeFileContent, ruleSets, aiProvider]);

  useEffect(() => {
    if (activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeTab, isChatLoading]);

  const executeSendMessage = async (text: string) => {
    if (!text.trim() || isChatLoading) return;

    setChatHistory(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      if (chatMode === 'image') {
          const b64 = await generateEdiFlowImage(text);
          setChatHistory(prev => [...prev, { role: 'model', text: `Transaction flow diagram generated for: "${text}"`, image: b64, timestamp: new Date() }]);
          setChatMode('standard'); 
      } else if (chatMode === 'video') {
          const b64 = await generateEdiFlowVideo(text);
          setChatHistory(prev => [...prev, { role: 'model', text: `Motion flow analysis generated for: "${text}"`, video: b64, timestamp: new Date() }]);
          setChatMode('standard'); 
      } else {
          const response = await sendEdiChat(chatHistory, text, contextFiles, {
            useThinking: chatMode === 'thinking',
            useSearch: chatMode === 'search',
            provider: aiProvider as 'gemini' | 'deepseek'
          });
          setChatHistory(prev => [...prev, { role: 'model', text: response.text, sources: response.sources, timestamp: new Date() }]);
      }
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${err.message}`, timestamp: new Date() }]);
    } finally { setIsChatLoading(false); }
  };

  const handleSendMessage = (e?: React.FormEvent) => { e?.preventDefault(); executeSendMessage(chatInput); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };

  const getModeLabel = (mode: ChatMode) => {
      switch(mode) {
          case 'standard': return 'Standard Chat';
          case 'thinking': return 'Deep Reasoning';
          case 'search': return 'Web Search';
          case 'image': return 'Flow Diagram';
          case 'video': return 'Veo Video';
          default: return '';
      }
  };

  const getModeIcon = (mode: ChatMode) => {
      switch(mode) {
          case 'standard': return <Bot size={14} />;
          case 'thinking': return <BrainCircuit size={14} />;
          case 'search': return <Globe size={14} />;
          case 'image': return <Image size={14} />;
          case 'video': return <Film size={14} />;
          default: return null;
      }
  };

  return (
    <div className={`flex flex-col h-full bg-[#0d1117] text-slate-200 ${isFullScreen ? 'bg-[#0a0c10]' : ''}`}>
      {isFullScreen && (
        <div className="flex-none h-14 border-b border-white/5 bg-[#161b22] px-6 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="bg-[#21262d] p-2 rounded-lg border border-white/10 text-blue-400 shadow-sm">
                 <Bot size={20} />
              </div>
              <div>
                 <h2 className="text-sm font-bold text-white tracking-tight">EDI Studio Copilot</h2>
                 <p className="text-[10px] text-blue-500 uppercase font-bold tracking-widest">{aiProvider === 'gemini' ? 'Architect Mode' : 'DeepSeek Logic'}</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
              <X size={20} />
           </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'json' && <JsonPanel ediContent={activeFileContent} />}
        {activeTab === 'structure' && <StructurePanel ediContent={activeFileContent} />}
        {activeTab === 'tools' && (
          <div className="h-full overflow-y-auto custom-scrollbar">
            {conversionResult ? (
               <div className="p-4 h-full flex flex-col">
                  <button onClick={() => setConversionResult(null)} className="text-xs text-blue-400 mb-2">← Back</button>
                  <textarea readOnly className="flex-1 w-full bg-[#0a0c10] text-emerald-400 p-4 font-mono text-[11px] rounded-xl border border-white/10" value={conversionResult.content} />
               </div>
            ) : <Toolbox ediContent={activeFileContent} onUpdateContent={onUpdateContent} onConvert={(res, fmt) => setConversionResult({ content: res, format: fmt })} />}
          </div>
        )}

        {activeTab === 'validate' && (
          <div className="h-full overflow-y-auto custom-scrollbar p-4">
             <HealthDashboard 
                result={orchestratedResult} 
                isValidating={validating} 
                activeFileContent={activeFileContent} 
                onJumpToLine={onJumpToLine} 
                onApplyFix={(l, s) => { onUpdateContent(activeFileContent.split(/\r?\n/).map((line, i) => i === l - 1 ? s : line).join('\n')); }} 
             />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6" ref={messagesContainerRef}>
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                   <div className="w-16 h-16 bg-[#161b22] rounded-2xl flex items-center justify-center mb-4 border border-white/5 shadow-xl">
                      <Bot className="text-blue-400" size={32} />
                   </div>
                   <h3 className="font-bold text-white text-lg">Copilot Ready</h3>
                   <p className="text-xs text-slate-500 max-w-[280px] mt-2 leading-relaxed">Ask me to modify segments, generate test data, or explain EDI structures using {aiProvider === 'gemini' ? 'Gemini 3' : 'DeepSeek-V3'}.</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`message-bubble flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${msg.role === 'user' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#21262d] border-white/10 text-blue-400 shadow-sm'}`}>
                      {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-lg' : 'bg-[#161b22] border border-white/10 text-slate-200 shadow-xl'}`}>
                      <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
                      {msg.image && <img src={`data:image/png;base64,${msg.image}`} className="mt-3 rounded-lg border border-white/10 w-full" alt="AI Generated Flow" />}
                      {msg.video && <video controls autoPlay loop muted className="mt-3 rounded-lg border border-white/10 w-full" src={`data:video/mp4;base64,${msg.video}`} />}
                    </div>
                  </div>
                ))
              )}
              {isChatLoading && <div className="flex gap-2 p-4 text-xs text-slate-500 italic animate-pulse items-center"><Loader2 size={12} className="animate-spin" /> EDI Copilot is thinking...</div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-[#161b22] border-t border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative" ref={modeDropdownRef}>
                  <button 
                    onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#21262d] border border-white/10 hover:border-blue-500/50 transition-all text-xs font-bold text-slate-300 shadow-lg"
                  >
                    {getModeIcon(chatMode)}
                    <span className="min-w-[100px] text-left">{getModeLabel(chatMode)}</span>
                    <ChevronUp size={12} className={`text-slate-500 transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isModeDropdownOpen && (
                    <div className="absolute bottom-full left-0 mb-3 w-56 bg-[#161b22] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-150 ring-1 ring-black/50">
                      <div className="p-1.5 flex flex-col">
                        {[
                          { id: 'standard', icon: <Bot size={14} /> },
                          { id: 'thinking', icon: <BrainCircuit size={14} />, disabled: aiProvider === 'deepseek' },
                          { id: 'search', icon: <Globe size={14} />, disabled: aiProvider === 'deepseek' },
                          { id: 'divider' },
                          { id: 'image', icon: <Image size={14} />, disabled: aiProvider === 'deepseek' },
                          { id: 'video', icon: <Film size={14} />, disabled: aiProvider === 'deepseek' }
                        ].map((item, i) => {
                          if (item.id === 'divider') return <div key={i} className="h-px bg-white/5 my-1.5 mx-2" />;
                          const id = item.id as ChatMode;
                          const active = chatMode === id;
                          return (
                            <button 
                              key={id}
                              disabled={item.disabled}
                              onClick={() => { setChatMode(id); setIsModeDropdownOpen(false); }}
                              className={`flex items-center gap-3 w-full px-3 py-2.5 text-xs font-semibold rounded-lg transition-all text-left ${active ? 'bg-[#2563eb] text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'} ${item.disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                            >
                              <span className={active ? "text-white" : "text-slate-500"}>{item.icon}</span>
                              {getModeLabel(id)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${aiProvider === 'gemini' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                   Using {aiProvider}
                </div>
              </div>

              <div className="relative flex items-end gap-2 bg-[#0d1117] rounded-2xl p-2 border border-white/10 focus-within:border-blue-500/50 transition-all shadow-inner">
                <textarea
                  ref={textAreaRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask for a Transaction Flow Diagram or modify EDI..."
                  rows={1}
                  className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none max-h-32 py-2 px-3"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isChatLoading}
                  className="mb-1 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-30 transition-all shadow-lg shadow-blue-900/40 active:scale-95"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;