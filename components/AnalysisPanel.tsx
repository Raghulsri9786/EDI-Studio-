
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Loader2, AlertTriangle, CheckCircle, AlertOctagon, BrainCircuit, Globe, Layers, Sparkles, Wand2, Lock, Key, Image, Download, Film, ChevronDown, ChevronUp, Link as LinkIcon, Maximize, X, MessageCircle } from 'lucide-react';
import { EdiAnalysisResult, ChatMessage, ValidationResult, EdiFile, PanelTab, OrchestratedResult, TPRuleSet } from '../types';
import { sendEdiChat, generateEdiFlowImage, generateEdiFlowVideo } from '../services/geminiService';
import { validationOrchestrator } from '../services/validationOrchestrator';
import JsonPanel from './JsonPanel';
import Toolbox from './Toolbox';
import HealthDashboard from './HealthDashboard';
import { animateNewMessage, staggerListItems, animateButtonPress } from '../utils/gsapAnimations';

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
  hasApiKey?: boolean;
  isFullScreen?: boolean;
  onJumpToLine?: (line: number) => void;
}

type ChatMode = 'standard' | 'thinking' | 'search' | 'image' | 'video';

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  activeTab,
  analysis, 
  activeFileContent, 
  contextFiles, 
  loading, 
  onUpdateContent,
  onSplitFiles,
  onStediClick,
  hasApiKey = false,
  onClose,
  isFullScreen = false,
  onJumpToLine
}) => {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Mode Selector State
  const [chatMode, setChatMode] = useState<ChatMode>('standard');
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  
  // New Validation State
  const [orchestratedResult, setOrchestratedResult] = useState<OrchestratedResult | null>(null);
  const [validating, setValidating] = useState(false);
  
  const [conversionResult, setConversionResult] = useState<{content: string, format: string} | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
        if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
            setIsModeDropdownOpen(false);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeTab === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeTab, isChatLoading]);

  // Animate new messages
  useEffect(() => {
    if (messagesContainerRef.current) {
      const msgs = messagesContainerRef.current.querySelectorAll('.message-bubble');
      if (msgs.length > 0) {
        animateNewMessage(msgs[msgs.length - 1] as HTMLElement);
      }
    }
  }, [chatHistory]);

  // Initial Stagger
  useLayoutEffect(() => {
    if (activeTab === 'chat' && messagesContainerRef.current) {
      staggerListItems('.message-bubble', messagesContainerRef.current);
    }
  }, [activeTab]);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
    }
  }, [chatInput]);

  const executeSendMessage = async (text: string) => {
    if (!text.trim() || isChatLoading || !hasApiKey) return;

    const newUserMessage: ChatMessage = {
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      if (chatMode === 'image') {
          const imageBase64 = await generateEdiFlowImage(text, imageSize);
          const newAiMessage: ChatMessage = {
            role: 'model',
            text: `Here is the visual flow diagram for: "${text}" (${imageSize} Resolution)`,
            image: imageBase64,
            timestamp: new Date()
          };
          setChatHistory(prev => [...prev, newAiMessage]);
          setChatMode('standard'); 
      } 
      else if (chatMode === 'video') {
          const videoBase64 = await generateEdiFlowVideo(text);
          const newAiMessage: ChatMessage = {
            role: 'model',
            text: `I've generated a video animation for: "${text}"`,
            video: videoBase64,
            timestamp: new Date()
          };
          setChatHistory(prev => [...prev, newAiMessage]);
          setChatMode('standard'); 
      }
      else {
          // Pass the contextFiles array directly to support binary content (PDFs)
          const response = await sendEdiChat(chatHistory, text, contextFiles, {
            useThinking: chatMode === 'thinking',
            useSearch: chatMode === 'search'
          });
          
          const newAiMessage: ChatMessage = {
            role: 'model',
            text: response.text,
            sources: response.sources,
            timestamp: new Date()
          };
          
          setChatHistory(prev => [...prev, newAiMessage]);
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage: ChatMessage = {
        role: 'model',
        text: `Error: ${err.message || "Failed to process request."}`,
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    executeSendMessage(chatInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeSendMessage(chatInput);
    }
  };

  const runValidation = async () => {
    if (!activeFileContent) return;
    setValidating(true);
    try {
      const savedStedi = localStorage.getItem('stedi_config');
      const stediConfig = savedStedi ? JSON.parse(savedStedi) : undefined;
      
      const savedRules = localStorage.getItem('edi_rules');
      const activeRuleSets: TPRuleSet[] = savedRules ? JSON.parse(savedRules) : [];

      const res = await validationOrchestrator.validate(activeFileContent, {
          useAi: hasApiKey || false,
          useStedi: !!stediConfig,
          stediConfig,
          activeRuleSets
      });
      setOrchestratedResult(res);
    } finally {
      setValidating(false);
    }
  };

  const handleApplyFix = (line: number, newSegment: string) => {
      // Create new content by replacing the line
      // Note: line is 1-based, array is 0-based
      const lines = activeFileContent.split(/\r?\n/);
      if (line > 0 && line <= lines.length) {
          lines[line - 1] = newSegment;
          const newContent = lines.join('\n');
          onUpdateContent(newContent);
          // Re-run validation to clear the error
          // We can't immediately re-run here as content update is async propagation, 
          // but useEffect below handles it when content changes.
      }
  };

  // Reset validation result when content changes so user sees fresh state
  useEffect(() => {
    setOrchestratedResult(null);
  }, [activeFileContent]);

  // Auto-run validation if tab is active and no result exists
  useEffect(() => {
    if (activeTab === 'validate' && !orchestratedResult && activeFileContent) {
      runValidation();
    }
  }, [activeTab, orchestratedResult, activeFileContent]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 p-8">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="text-lg font-medium text-slate-300">Initializing AI...</p>
      </div>
    );
  }

  const LockedState = ({ title, description }: { title: string, description: string }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/5 m-4">
       <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 border border-white/10">
          <Lock size={32} className="text-slate-500" />
       </div>
       <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
       <p className="text-sm text-slate-400 mb-6 max-w-xs">{description}</p>
       <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 px-4 py-2 rounded-lg border border-amber-500/20">
          <Key size={14} />
          <span>Add API Key in Settings to Unlock</span>
       </div>
    </div>
  );

  const getModeLabel = () => {
      switch(chatMode) {
          case 'standard': return 'Standard Chat';
          case 'thinking': return 'Deep Reasoning';
          case 'search': return 'Web Search';
          case 'image': return 'Flow Diagram';
          case 'video': return 'Veo Video';
      }
  };

  const getModeIcon = () => {
      switch(chatMode) {
          case 'standard': return <Bot size={14} />;
          case 'thinking': return <BrainCircuit size={14} />;
          case 'search': return <Globe size={14} />;
          case 'image': return <Image size={14} />;
          case 'video': return <Film size={14} />;
      }
  };

  return (
    <div className={`flex flex-col h-full bg-slate-950/80 backdrop-blur-xl ${isFullScreen ? 'bg-slate-950' : ''}`}>
      
      {/* Studio Header (Only in Full Screen) */}
      {isFullScreen && (
        <div className="flex-none h-14 border-b border-white/5 bg-slate-900 px-6 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                 <BrainCircuit size={20} />
              </div>
              <div>
                 <h2 className="text-sm font-bold text-white">AI Studio</h2>
                 <p className="text-[10px] text-slate-400">Advanced EDI Intelligence Workspace</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
              <X size={20} />
           </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'json' && <JsonPanel ediContent={activeFileContent} />}

        {activeTab === 'tools' && (
          <div className="h-full overflow-y-auto custom-scrollbar bg-slate-900/30">
            {conversionResult ? (
               <div className="p-4 h-full flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-slate-200">{conversionResult.format} Output</h3>
                    <button onClick={() => setConversionResult(null)} className="text-sm text-blue-400 hover:text-blue-300">Back</button>
                  </div>
                  <textarea 
                    readOnly 
                    className="flex-1 w-full bg-slate-950 text-green-400 p-4 font-mono text-xs rounded-xl border border-white/10 shadow-inner"
                    value={conversionResult.content}
                  />
               </div>
            ) : (
              <Toolbox 
                ediContent={activeFileContent} 
                onUpdateContent={onUpdateContent}
                onConvert={(res, fmt) => setConversionResult({ content: res, format: fmt })}
                onSplitFiles={onSplitFiles}
                onStediClick={onStediClick}
                hasApiKey={hasApiKey}
              />
            )}
          </div>
        )}

        {activeTab === 'validate' && (
          <div className="h-full overflow-y-auto custom-scrollbar p-4 bg-slate-950/50">
             {!activeFileContent ? (
                <div className="text-center text-slate-500 mt-10">No EDI content to validate.</div>
             ) : (
                <>
                   <HealthDashboard 
                      result={orchestratedResult} 
                      isValidating={validating} 
                      activeFileContent={activeFileContent}
                      onJumpToLine={onJumpToLine} 
                      onApplyFix={handleApplyFix}
                   />
                   {!validating && (
                      <div className="mt-6 px-2 pb-6">
                         <button 
                           onClick={runValidation} 
                           className="w-full py-3 text-sm font-semibold text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 rounded-xl transition-all border border-blue-500/20 hover:border-blue-500/40 shadow-lg shadow-blue-900/20"
                         >
                           Re-run Validation
                         </button>
                      </div>
                   )}
                </>
             )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className={`h-full flex flex-col ${isFullScreen ? 'max-w-5xl mx-auto w-full' : ''}`}>
            {/* Context Bar */}
            <div className="bg-slate-900/30 border-b border-white/5 px-4 py-2 flex items-center justify-between flex-none backdrop-blur-md">
              <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                 <Layers size={12} className="text-blue-500" />
                 {contextFiles.length > 1 ? (
                   <span>Context: {contextFiles.length} Selected Files</span>
                 ) : contextFiles.length === 1 ? (
                   <span className="truncate max-w-[200px]">Context: {contextFiles[0].name}</span>
                 ) : (
                   <span>No File Context</span>
                 )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6" ref={messagesContainerRef}>
              {!hasApiKey ? (
                 <LockedState title="AI Assistant Locked" description="To chat with your EDI files, please provide an API key." />
              ) : chatHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60%] text-center p-8 opacity-0 animate-in fade-in zoom-in duration-700 delay-100 fill-mode-forwards">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-3xl flex items-center justify-center mb-6 border border-white/5 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                    <Bot className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-white text-lg mb-2">EDI Insight AI</h3>
                  <p className="text-sm text-slate-400 max-w-[320px] leading-relaxed">
                    Specialized agent for EDI standards, ERP integrations, and supply chain documents.
                  </p>
                  {isFullScreen && (
                     <div className="mt-8 grid grid-cols-2 gap-4 max-w-lg w-full">
                        <button onClick={() => executeSendMessage("Generate a flow diagram for 850, 855, 856, 810")} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/5 text-left transition-all hover:border-blue-500/30 group">
                           <Image className="mb-2 text-pink-400 group-hover:scale-110 transition-transform" />
                           <div className="font-bold text-sm text-white">Generate Flow Diagram</div>
                           <div className="text-xs text-slate-500">Visualize TP documents</div>
                        </button>
                        <button onClick={() => executeSendMessage("Explain the difference between X12 850 and EDIFACT ORDERS")} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/5 text-left transition-all hover:border-blue-500/30 group">
                           <MessageCircle className="mb-2 text-blue-400 group-hover:scale-110 transition-transform" />
                           <div className="font-bold text-sm text-white">Compare Standards</div>
                           <div className="text-xs text-slate-500">X12 vs EDIFACT Analysis</div>
                        </button>
                     </div>
                  )}
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`message-bubble flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                        msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-emerald-400 border border-white/10'
                      }`}
                    >
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    <div
                      className={`max-w-[90%] rounded-2xl p-4 text-sm shadow-md leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-slate-800/60 border border-white/5 text-slate-200 rounded-tl-sm backdrop-blur-md'
                      }`}
                    >
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown className="markdown-content">
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                      
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Globe size={10} /> Sources
                           </div>
                           <div className="grid gap-1">
                              {msg.sources.map((source, i) => (
                                <a 
                                  key={i} 
                                  href={source.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 p-2 bg-white/5 rounded hover:bg-white/10 transition-colors group"
                                >
                                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:bg-blue-400"></div>
                                   <span className="text-xs text-blue-400 group-hover:text-blue-300 truncate">{source.title}</span>
                                   <LinkIcon size={10} className="text-slate-500 ml-auto opacity-0 group-hover:opacity-100" />
                                </a>
                              ))}
                           </div>
                        </div>
                      )}

                      {msg.image && (
                        <div className="mt-3 mb-1">
                          <img src={`data:image/png;base64,${msg.image}`} alt="Generated Diagram" className="rounded-lg border border-white/10 shadow-lg max-w-full" />
                        </div>
                      )}

                      {msg.video && (
                        <div className="mt-3 mb-1">
                          <video controls autoPlay loop muted className="w-full h-auto rounded-lg border border-white/10" src={`data:video/mp4;base64,${msg.video}`} />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              
              {isChatLoading && (
                <div className="message-bubble flex gap-4">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 text-emerald-400 flex items-center justify-center shadow-lg">
                    <Bot size={16} />
                  </div>
                  <div className="bg-slate-800/40 border border-white/5 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm backdrop-blur-md flex items-center gap-3">
                     <div className="flex gap-1">
                       <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                       <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></span>
                       <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></span>
                     </div>
                     <span className="text-xs font-medium text-slate-400">
                        {chatMode === 'image' ? "Rendering Visuals..." : (chatMode === 'video' ? "Producing Video..." : (chatMode === 'thinking' ? "Deep Reasoning..." : "Analyzing EDI Context..."))}
                     </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

             {/* Input Area */}
             <div className={`p-4 bg-slate-900/60 border-t border-white/5 flex-none z-10 backdrop-blur-xl ${!hasApiKey ? 'opacity-50 pointer-events-none' : ''}`}>
              
              {/* Dropdown Mode Selector */}
              <div className="flex items-center gap-3 mb-3 px-1">
                 <div className="relative" ref={modeDropdownRef}>
                    <button 
                      onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 hover:border-white/20 transition-all text-xs font-medium text-slate-200 shadow-sm"
                    >
                       {getModeIcon()}
                       {getModeLabel()}
                       {isModeDropdownOpen ? <ChevronUp size={12} className="text-slate-500" /> : <ChevronDown size={12} className="text-slate-500" />}
                    </button>

                    {isModeDropdownOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 animate-in slide-in-from-bottom-2 fade-in">
                           <div className="p-1.5 space-y-0.5">
                              <button onClick={() => { setChatMode('standard'); setIsModeDropdownOpen(false); }} className={`flex items-center gap-2 w-full px-2 py-2 text-xs rounded-lg transition-colors text-left ${chatMode === 'standard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                 <Bot size={14} /> Standard Chat
                              </button>
                              <button onClick={() => { setChatMode('thinking'); setIsModeDropdownOpen(false); }} className={`flex items-center gap-2 w-full px-2 py-2 text-xs rounded-lg transition-colors text-left ${chatMode === 'thinking' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                 <BrainCircuit size={14} /> Deep Reasoning
                              </button>
                              <button onClick={() => { setChatMode('search'); setIsModeDropdownOpen(false); }} className={`flex items-center gap-2 w-full px-2 py-2 text-xs rounded-lg transition-colors text-left ${chatMode === 'search' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                 <Globe size={14} /> Web Search
                              </button>
                              <div className="h-px bg-white/5 my-1"></div>
                              <button onClick={() => { setChatMode('image'); setIsModeDropdownOpen(false); }} className={`flex items-center gap-2 w-full px-2 py-2 text-xs rounded-lg transition-colors text-left ${chatMode === 'image' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                 <Image size={14} /> Flow Diagram
                              </button>
                              <button onClick={() => { setChatMode('video'); setIsModeDropdownOpen(false); }} className={`flex items-center gap-2 w-full px-2 py-2 text-xs rounded-lg transition-colors text-left ${chatMode === 'video' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                                 <Film size={14} /> Veo Video
                              </button>
                           </div>
                        </div>
                    )}
                 </div>

                 {chatMode === 'image' && (
                   <div className="flex bg-slate-800 rounded-lg p-0.5 border border-white/5">
                      {["1K", "2K", "4K"].map((size) => (
                         <button
                           key={size}
                           onClick={() => setImageSize(size as any)}
                           className={`text-[9px] px-2 py-1 rounded-md transition-all font-bold ${imageSize === size ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                         >
                           {size}
                         </button>
                      ))}
                   </div>
                 )}
              </div>

              <div className="relative flex items-end gap-2 bg-slate-950 rounded-2xl p-2 border border-slate-800 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all shadow-inner group">
                <textarea
                  ref={textAreaRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={hasApiKey ? "Ask about EDI structure, validation, or mapping..." : "API Key Required"}
                  rows={1}
                  className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 resize-none outline-none max-h-32 py-2 px-2 custom-scrollbar"
                />
                <button 
                   onClick={(e) => { 
                      animateButtonPress(e.currentTarget);
                      executeSendMessage(chatInput); 
                   }}
                   disabled={!chatInput.trim() || isChatLoading || !hasApiKey}
                   className="mb-0.5 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-50 disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 transition-all shadow-lg shadow-blue-900/20"
                >
                   {isChatLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              <div className="text-[10px] text-slate-600 text-center mt-2 flex justify-center gap-1">
                <span>AI can make mistakes.</span>
                <span className="text-slate-500">Strictly for EDI context.</span>
              </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
