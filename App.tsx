
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Activity, GitCompare, PenTool, Layout, FileCode, Search, Settings, X, MessageSquare, Bot, Mic, ChevronLeft, ChevronRight, Database, Cloud, UserCircle, LogOut } from 'lucide-react';
import Editor, { EditorHandle, EditorState } from './components/Editor';
import EditorToolbar from './components/EditorToolbar';
import AnalysisPanel from './components/AnalysisPanel';
import CompareView from './components/CompareView';
import MapperView from './components/MapperView';
import FileExplorer from './components/FileExplorer';
import SettingsModal from './components/SettingsModal';
import StediModal from './components/StediModal';
import EditorTabs from './components/EditorTabs';
import LiveVoiceAgent from './components/LiveVoiceAgent';
import InteractiveBackground from './components/InteractiveBackground';
import AuthModal from './components/AuthModal';
import CloudFileManager from './components/CloudFileManager';
import HumanReadablePanel from './components/HumanReadablePanel';
import { AppState, AppMode, EdiFile, AppSettings, PanelTab } from './types';
import { animatePageEntrance, animatePanelEnter, animatePanelExit } from './utils/gsapAnimations';
import { storageService } from './services/storageService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { cloudService } from './services/cloudService';

// Wrapper to provide Auth Context
function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

function App() {
  const { user, signOut } = useAuth();
  const [files, setFiles] = useState<EdiFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [dbLoaded, setDbLoaded] = useState(false);
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [appMode, setAppMode] = useState<AppMode>(AppMode.EDITOR);
  const [isBusinessView, setIsBusinessView] = useState(false);

  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<PanelTab>('chat');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>({
    fontSize: 'medium',
    showLineNumbers: true,
    theme: 'dark',
    aiModel: 'speed',
    aiProvider: 'gemini',
    geminiApiKey: '',
    deepSeekApiKey: ''
  });

  const [isStediOpen, setIsStediOpen] = useState(false);
  const [isVoiceAgentOpen, setIsVoiceAgentOpen] = useState(false);

  // Auto-save timer ref
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editor control ref and state
  const editorRef = useRef<EditorHandle>(null);
  const [editorState, setEditorState] = useState<EditorState>({
    canUndo: false, 
    canRedo: false, 
    isEditing: true, 
    isVisualWrap: false, 
    isEdiMode: false, 
    isFindOpen: false
  });

  // Layout Refs for GSAP
  const headerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Default Widths
  const SIDEBAR_WIDTH = 260;
  const PANEL_WIDTH = 420;

  const activeFile = files.find(f => f.id === activeFileId);
  const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
  const chatContextFiles = selectedFiles.length > 0 ? selectedFiles : (activeFile ? [activeFile] : []);

  const hasApiKey = settings.aiProvider === 'deepseek' 
    ? !!settings.deepSeekApiKey 
    : !!settings.geminiApiKey;

  // Initialize Settings & Data
  useEffect(() => {
    const initApp = async () => {
      // Load Settings from Local
      const savedSettings = localStorage.getItem('edi_settings');
      if (savedSettings) {
        try {
          setSettings({ ...settings, ...JSON.parse(savedSettings) });
        } catch (e) {}
      }

      // Load Files from IndexedDB (Local First)
      try {
        const storedFiles = await storageService.getAllFiles();
        if (storedFiles && storedFiles.length > 0) {
          setFiles(storedFiles);
          storedFiles.sort((a,b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
          setActiveFileId(storedFiles[0].id);
          setAppState(AppState.VIEWING);
        }
      } catch (err) {
        console.error("Failed to load files from DB:", err);
      } finally {
        setDbLoaded(true);
      }
    };

    initApp();
  }, []);

  // Sync Settings when User Logs In
  useEffect(() => {
    if (user) {
      cloudService.getSettings().then(cloudSettings => {
        if (cloudSettings) {
          // Merge local keys with cloud settings (cloud doesn't store keys)
          setSettings(prev => ({ ...prev, ...cloudSettings, geminiApiKey: prev.geminiApiKey, deepSeekApiKey: prev.deepSeekApiKey }));
        }
      });
    }
  }, [user]);

  // Save Settings on Change
  useEffect(() => {
    localStorage.setItem('edi_settings', JSON.stringify(settings));
    if (user) {
      // Debounce cloud settings save
      const timer = setTimeout(() => cloudService.saveSettings(settings), 1000);
      return () => clearTimeout(timer);
    }
  }, [settings, user]);

  // Entrance Animation
  useLayoutEffect(() => {
    animatePageEntrance(headerRef.current, sidebarRef.current, mainRef.current);
  }, []);

  // Panel Entrance Animation
  useEffect(() => {
    if (isRightPanelOpen && rightPanelRef.current) {
        animatePanelEnter(rightPanelRef.current);
    }
  }, [isRightPanelOpen]);

  // Handle closing with animation
  const handleCloseRightPanel = () => {
    if (rightPanelRef.current) {
      animatePanelExit(rightPanelRef.current, () => setIsRightPanelOpen(false));
    } else {
      setIsRightPanelOpen(false);
    }
  };

  const toggleRightPanel = (tab: PanelTab) => {
    if (isRightPanelOpen && activeRightTab === tab) {
      handleCloseRightPanel();
    } else {
      setActiveRightTab(tab);
      setIsRightPanelOpen(true);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const readers = Array.from(fileList).map((file: File) => {
      return new Promise<EdiFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          // Use crypto.randomUUID for better uniqueness in loops/batches, fallback to timestamp
          const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).substr(2, 9);
          
          resolve({
            id: id,
            name: file.name,
            content: content,
            lastModified: new Date(file.lastModified),
          });
        };
        reader.readAsText(file);
      });
    });

    try {
      const loadedFiles = await Promise.all(readers);
      
      // OPTIMIZATION: Use saveAllFiles for a single DB transaction instead of looping saveFile
      // This is critical for batch uploads of 20+ files to prevent DB lock/performance issues
      await storageService.saveAllFiles(loadedFiles);

      setFiles(prev => {
        const newFiles = [...prev, ...loadedFiles];
        return newFiles;
      });

      if (loadedFiles.length > 0) {
        setActiveFileId(loadedFiles[0].id);
        setAppState(AppState.VIEWING);
      }
      event.target.value = ''; 
    } catch (error) {
      console.error("Failed to upload files", error);
    }
  };

  const handleNewFile = () => {
    const newFile: EdiFile = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: `Untitled-${files.length + 1}.edi`,
      content: "",
      lastModified: new Date(),
    };
    setFiles(prev => [...prev, newFile]);
    storageService.saveFile(newFile);
    setActiveFileId(newFile.id);
    setAppState(AppState.VIEWING);
  };
  
  const handleSplitFiles = (newFilesData: { name: string; content: string }[]) => {
    const newFiles: EdiFile[] = newFilesData.map((d) => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(),
      name: d.name,
      content: d.content,
      lastModified: new Date(),
    }));
    
    // Batch save for split result as well
    storageService.saveAllFiles(newFiles);
    
    setFiles(prev => [...prev, ...newFiles]);

    if (newFiles.length > 0) {
        setActiveFileId(newFiles[0].id);
    }
  };

  const handleDeleteFile = (id: string) => {
    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);
    storageService.deleteFile(id);

    if (activeFileId === id) {
      setActiveFileId(newFiles.length > 0 ? newFiles[newFiles.length - 1].id : null);
    }
    if (selectedFileIds.has(id)) {
      const newSet = new Set(selectedFileIds);
      newSet.delete(id);
      setSelectedFileIds(newSet);
    }
  };

  const handleDownloadFile = (customName?: string) => {
    if (!activeFile) return;
    
    const finalFileName = customName || activeFile.name;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const updateActiveContent = (newContent: string) => {
    if (!activeFileId) return;
    
    setFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        const updated = { ...f, content: newContent, lastModified: new Date() };
        storageService.saveFile(updated); // Persist update local
        
        // Auto-save to Cloud if connected
        if (user && f.cloudId) {
           if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
           autoSaveTimeoutRef.current = setTimeout(() => {
              cloudService.saveFile(updated).catch(console.error);
           }, 2000); // 2s debounce
        }
        
        return updated;
      }
      return f;
    }));
  };

  const toggleFileSelection = (id: string) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedFileIds(newSet);
  };

  const handleCreateCompareTab = () => {
    if (selectedFiles.length < 2) return;
    const compareCount = files.filter(f => f.isCompareView).length + 1;
    const compareFile: EdiFile = {
      id: `compare-${Date.now()}`,
      name: `Compare ${compareCount}`,
      content: '', 
      lastModified: new Date(),
      isCompareView: true,
      compareData: { files: [...selectedFiles] }
    };
    setFiles(prev => [...prev, compareFile]);
    setActiveFileId(compareFile.id);
    setSelectedFileIds(new Set());
  };

  const handleLoadCloudFile = (cloudFile: EdiFile) => {
    // Check if already loaded
    const existing = files.find(f => f.cloudId === cloudFile.cloudId);
    if (existing) {
      setActiveFileId(existing.id);
    } else {
      setFiles(prev => [...prev, cloudFile]);
      storageService.saveFile(cloudFile);
      setActiveFileId(cloudFile.id);
    }
  };

  const handleCloudFileSaved = (localId: string, cloudId: string) => {
    setFiles(prev => prev.map(f => f.id === localId ? { ...f, cloudId, isSynced: true } : f));
  };

  const renderMainArea = () => {
    if (!activeFile) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 relative overflow-hidden">
           <div className="relative z-10 text-center p-8 bg-slate-900/60 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 max-w-md mx-4 animate-in fade-in zoom-in duration-700">
             <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg shadow-blue-900/50">
               <Database size={40} className="text-white" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">EDI Database</h2>
             <p className="text-slate-400 mb-8 leading-relaxed">
               {dbLoaded ? "Local storage ready. Log in to sync to cloud." : "Initializing Database..."}
             </p>
             <div className="flex gap-4 justify-center">
               <button onClick={handleNewFile} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-lg shadow-blue-500/20 transform hover:-translate-y-0.5 active:scale-95">
                 New File
               </button>
               <label className="px-6 py-3 bg-slate-800 text-slate-200 border border-white/5 rounded-xl font-semibold hover:bg-slate-700 transition-all cursor-pointer shadow-lg transform hover:-translate-y-0.5 active:scale-95">
                 Import Files
                 <input type="file" multiple onChange={handleFileUpload} className="hidden" />
               </label>
             </div>
           </div>
        </div>
      );
    }

    if (activeFile.isCompareView) {
      return (
        <div className="flex flex-col h-full" ref={mainRef}>
           <div className="flex items-center justify-between bg-slate-900/50 border-b border-white/5 backdrop-blur-sm pr-3">
             <div className="flex-1 overflow-hidden">
                <EditorTabs 
                  files={files} 
                  activeFileId={activeFileId} 
                  onSelect={setActiveFileId} 
                  onClose={handleDeleteFile} 
                />
             </div>
           </div>
           <div className="flex-1 overflow-hidden relative">
              <CompareView files={activeFile.compareData?.files} />
           </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full" ref={mainRef}>
        <div className="flex items-center justify-between bg-slate-900/50 border-b border-white/5 backdrop-blur-sm pr-3 h-10 relative z-20">
           <div className="flex-1 overflow-hidden">
              <EditorTabs 
                files={files} 
                activeFileId={activeFileId} 
                onSelect={setActiveFileId} 
                onClose={handleDeleteFile} 
              />
           </div>
           <div className="flex-none pl-2">
              <EditorToolbar 
                editorRef={editorRef} 
                editorState={editorState}
                isBusinessView={isBusinessView}
                onToggleBusinessView={() => setIsBusinessView(!isBusinessView)}
                ediContent={activeFile.content}
              />
           </div>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          {appMode === AppMode.MAPPER ? (
             <MapperView ediContent={activeFile.content} hasApiKey={hasApiKey} />
          ) : isBusinessView ? (
             <HumanReadablePanel ediContent={activeFile.content} />
          ) : (
             <Editor 
                ref={editorRef}
                key={activeFile.id}
                content={activeFile.content} 
                onChange={updateActiveContent} 
                fileName={activeFile.name}
                searchTerm={searchTerm}
                settings={settings}
                onSave={handleDownloadFile}
                onStateChange={setEditorState}
              />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans overflow-hidden text-slate-200 selection:bg-blue-500/30 relative">
      <div className="absolute inset-0 z-0"><InteractiveBackground /></div>

      {/* Header */}
      <header ref={headerRef} className="flex-none bg-slate-900/80 backdrop-blur-xl border-b border-white/5 px-4 py-2 flex items-center justify-between z-30 h-14 relative shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
             {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-blue-500/20">
            <FileCode size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">EDI Insight</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></span>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{user ? 'Cloud Sync Active' : 'Local Database'}</p>
            </div>
          </div>
        </div>

        <div className="hidden md:flex bg-slate-800/50 p-1 rounded-lg border border-white/5 backdrop-blur-md">
          <button onClick={() => setAppMode(AppMode.EDITOR)} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${appMode === AppMode.EDITOR ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <PenTool size={12} /> Editor
          </button>
          <button onClick={() => setAppMode(AppMode.MAPPER)} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-300 ${appMode === AppMode.MAPPER ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <Layout size={12} /> Mapper
          </button>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
           {user ? (
             <div className="flex items-center gap-2 mr-2">
                <span className="text-xs text-blue-400 font-medium hidden lg:inline">{user.email}</span>
                <button onClick={() => signOut()} title="Sign Out" className="p-1.5 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors"><LogOut size={16} /></button>
             </div>
           ) : (
             <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all border border-blue-500/20 mr-2">
                <UserCircle size={14} /> Sign In
             </button>
           )}

           <button onClick={() => setIsVoiceAgentOpen(true)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-bold border ${isVoiceAgentOpen ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <Mic size={14} /> Live Agent
           </button>

           <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block"></div>

           <button onClick={() => toggleRightPanel('chat')} className={`p-2 rounded-lg transition-all duration-300 ${isRightPanelOpen && activeRightTab === 'chat' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5 hover:text-white'}`} title="Chat Assistant">
              <MessageSquare size={18} />
           </button>
           
           <button onClick={() => toggleRightPanel('tools')} className={`p-2 rounded-lg transition-all duration-300 ${isRightPanelOpen && activeRightTab === 'tools' ? 'bg-purple-500/20 text-purple-400' : 'hover:bg-white/5 hover:text-white'}`} title="Generators">
              <Bot size={18} />
           </button>

           <div className="w-px h-5 bg-white/10 mx-1 hidden sm:block"></div>
           
           <button onClick={() => setIsSearchOpen(!isSearchOpen)} className={`p-2 rounded-lg transition-colors ${isSearchOpen ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}>
              <Search size={18} />
           </button>

           <button onClick={() => setIsSettingsOpen(true)} className={`p-2 rounded-lg transition-colors ${!hasApiKey ? 'text-amber-400 animate-pulse' : 'hover:text-white hover:bg-white/5'}`} title={!hasApiKey ? "API Key Required" : "Settings"}>
             <Settings size={18} />
           </button>
        </div>
      </header>

      {/* Search Bar Overlay */}
      {isSearchOpen && (
        <div className="absolute top-14 left-0 right-0 z-30 bg-slate-900/90 border-b border-white/10 p-3 flex justify-center shadow-2xl backdrop-blur-md animate-in slide-in-from-top-2">
           <div className="relative w-full max-w-lg group">
             <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Find segment, element, or value..." className="w-full bg-slate-950 text-slate-200 text-sm border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" autoFocus />
             <Search size={16} className="absolute left-3.5 top-3 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
             {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white transition-colors"><X size={16} /></button>}
           </div>
        </div>
      )}

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Sidebar */}
        <div ref={sidebarRef} className={`flex-none flex flex-col h-full overflow-hidden bg-slate-900/50 border-r border-white/5 backdrop-blur-md z-20 transition-all duration-300 ease-in-out`} style={{ width: isSidebarOpen ? SIDEBAR_WIDTH : 0, opacity: isSidebarOpen ? 1 : 0 }}>
           <FileExplorer 
             files={files} 
             activeFileId={activeFileId} 
             selectedFileIds={selectedFileIds}
             onSelectFile={setActiveFileId} 
             onToggleSelection={toggleFileSelection}
             onCompareSelected={handleCreateCompareTab}
             onAiSummarizeSelected={() => {}}
             onNewFile={handleNewFile}
             onDeleteFile={handleDeleteFile}
             onUpload={handleFileUpload}
           />
        </div>

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10 transition-all duration-300">
           {renderMainArea()}
        </div>

        {/* Right Panel */}
        {isRightPanelOpen && activeFile && !activeFile.isCompareView && (
            <div ref={rightPanelRef} className="flex-none z-30 bg-slate-900/90 backdrop-blur-xl border-l border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ease-in-out" style={{ width: PANEL_WIDTH }}>
              <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-white/5 flex-none">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  {activeRightTab === 'chat' && <MessageSquare size={14} className="text-blue-400" />}
                  {activeRightTab === 'validate' && <Activity size={14} className="text-emerald-400" />}
                  {activeRightTab === 'tools' && <Cloud size={14} className="text-blue-400" />}
                  {activeRightTab === 'chat' ? 'AI Assistant' : activeRightTab === 'validate' ? 'Validation Health' : 'Cloud Files'}
                </span>
                <div className="flex items-center gap-2">
                   {activeRightTab !== 'validate' && activeRightTab !== 'chat' && (
                      <button onClick={() => toggleRightPanel('validate')} title="Validation" className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"><Activity size={14} /></button>
                   )}
                   <button onClick={handleCloseRightPanel} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><X size={16} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                {activeRightTab === 'chat' || activeRightTab === 'validate' ? (
                  <AnalysisPanel 
                    activeTab={activeRightTab}
                    analysis={activeFile.analysis || null} 
                    activeFileContent={activeFile.content}
                    contextFiles={chatContextFiles}
                    loading={appState === AppState.ANALYZING} 
                    onUpdateContent={updateActiveContent}
                    onClose={handleCloseRightPanel}
                    onSplitFiles={handleSplitFiles}
                    onStediClick={() => setIsStediOpen(true)}
                    hasApiKey={hasApiKey}
                  />
                ) : (
                  <CloudFileManager 
                    currentFile={activeFile}
                    onLoadFile={handleLoadCloudFile}
                    onFileSaved={handleCloudFileSaved}
                  />
                )}
              </div>
            </div>
        )}
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdateSettings={setSettings} />
      <StediModal isOpen={isStediOpen} onClose={() => setIsStediOpen(false)} activeFileContent={activeFile?.content || ''} />
      <LiveVoiceAgent isOpen={isVoiceAgentOpen} onClose={() => setIsVoiceAgentOpen(false)} files={chatContextFiles} hasApiKey={hasApiKey && settings.aiProvider === 'gemini'} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

export default AppWrapper;
