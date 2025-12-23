import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Activity, Layout, FileCode, Settings, X, MessageSquare, Mic, Database, UserCircle, LogOut, FilePlus, FolderOpen, Save, FileJson, BrainCircuit, BookOpen, Download, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Shield, ListTree } from 'lucide-react';
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
import ValidationRulesPanel from './components/ValidationRulesPanel';
import MenuBar from './components/MenuBar';
import CommandPalette, { CommandItem } from './components/CommandPalette';
import SaveAsModal from './components/SaveAsModal';
import { AppState, AppMode, EdiFile, AppSettings, PanelTab, TPRuleSet } from './types';
import { animatePageEntrance, animatePanelEnter, animatePanelExit } from './utils/gsapAnimations';
import { storageService } from './services/storageService';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { cloudService } from './services/cloudService';

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
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [appMode, setAppMode] = useState<AppMode>(AppMode.EDITOR);
  const [isBusinessView, setIsBusinessView] = useState(false);

  const [ruleSets, setRuleSets] = useState<TPRuleSet[]>([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(420);
  const [activeRightTab, setActiveRightTab] = useState<PanelTab>('chat');
  
  const [isResizing, setIsResizing] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>({
    fontSize: 'medium',
    showLineNumbers: true,
    theme: 'dark',
    aiModel: 'speed',
    aiProvider: 'gemini'
  });

  const [isStediOpen, setIsStediOpen] = useState(false);
  const [isVoiceAgentOpen, setIsVoiceAgentOpen] = useState(false);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorRef = useRef<EditorHandle>(null);
  const [editorState, setEditorState] = useState<EditorState>({
    canUndo: false, 
    canRedo: false, 
    isEditing: true, 
    isVisualWrap: false, 
    isEdiMode: false, 
    isFindOpen: false
  });

  const headerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const activeFile = files.find(f => f.id === activeFileId);
  const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
  const chatContextFiles = selectedFiles.length > 0 ? selectedFiles : (activeFile ? [activeFile] : []);
  
  const openFiles = openFileIds
    .map(id => files.find(f => f.id === id))
    .filter(f => f !== undefined) as EdiFile[];

  const startResizing = useCallback((direction: 'left' | 'right') => (mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
    const startX = mouseDownEvent.clientX;
    const startWidth = direction === 'left' ? sidebarWidth : rightPanelWidth;
    const onMouseMove = (mouseMoveEvent: MouseEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      if (direction === 'left') {
        const newWidth = Math.max(180, Math.min(600, startWidth + deltaX));
        setSidebarWidth(newWidth);
      } else {
        const newWidth = Math.max(300, Math.min(800, startWidth - deltaX));
        setRightPanelWidth(newWidth);
      }
    };
    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = 'col-resize';
  }, [sidebarWidth, rightPanelWidth]);

  useEffect(() => {
    const initApp = async () => {
      const savedSettings = localStorage.getItem('edi_settings');
      if (savedSettings) {
        try { setSettings({ ...settings, ...JSON.parse(savedSettings) }); } catch (e) {}
      }
      const savedRules = localStorage.getItem('edi_rules');
      if (savedRules) {
          try { setRuleSets(JSON.parse(savedRules)); } catch (e) {}
      }
      try {
        const storedFiles = await storageService.getAllFiles();
        if (storedFiles && storedFiles.length > 0) {
          setFiles(storedFiles);
          storedFiles.sort((a,b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
          const mostRecent = storedFiles[0];
          setOpenFileIds([mostRecent.id]);
          setActiveFileId(mostRecent.id);
          setAppState(AppState.VIEWING);
        }
      } catch (err) { console.error("Failed to load files from DB:", err); } finally { setDbLoaded(true); }
    };
    initApp();
  }, []);

  useEffect(() => {
    localStorage.setItem('edi_settings', JSON.stringify(settings));
  }, [settings]);

  const updateActiveContent = (newContent: string) => {
    if (!activeFileId) return;
    setFiles(prev => prev.map(f => {
      if (f.id === activeFileId) {
        const updated = { ...f, content: newContent, lastModified: new Date() };
        storageService.saveFile(updated); 
        return updated;
      }
      return f;
    }));
  };

  const toggleRightPanel = (tab: PanelTab) => {
    if (isRightPanelOpen && activeRightTab === tab) {
      setIsRightPanelOpen(false);
    } else {
      setActiveRightTab(tab);
      setIsRightPanelOpen(true);
    }
  };

  const handleCloseRightPanel = () => {
    setIsRightPanelOpen(false);
  };

  const handleCommand = (id: string) => {
    switch (id) {
      case 'validate': toggleRightPanel('validate'); break;
      case 'toggle_business': setIsBusinessView(!isBusinessView); break;
      case 'ai_studio': setAppMode(AppMode.AI_STUDIO); setIsRightPanelOpen(false); break;
    }
  };

  const renderMainArea = () => {
    if (appMode === AppMode.AI_STUDIO) {
      return (
        <div className="h-full bg-slate-900 overflow-hidden relative w-full">
           <AnalysisPanel 
              activeTab="chat"
              analysis={activeFile?.analysis || null} 
              activeFileContent={activeFile?.content || ''}
              contextFiles={chatContextFiles}
              loading={appState === AppState.ANALYZING} 
              onUpdateContent={updateActiveContent}
              onClose={() => setAppMode(AppMode.EDITOR)}
              isFullScreen={true}
              ruleSets={ruleSets}
              aiProvider={settings.aiProvider}
            />
        </div>
      );
    }

    if (!activeFile) return null;

    return (
      <div className="flex flex-col h-full w-full" ref={mainRef}>
        <div className="flex items-center justify-between bg-slate-900/50 border-b border-white/5 backdrop-blur-sm pr-3 h-10 relative z-20">
           <div className="flex-1 overflow-hidden">
              <EditorTabs files={openFiles} activeFileId={activeFileId} onSelect={setActiveFileId} onClose={() => {}} />
           </div>
           <div className="flex-none pl-2">
              <EditorToolbar editorRef={editorRef} editorState={editorState} isBusinessView={isBusinessView} ediContent={activeFile.content} onValidate={() => handleCommand('validate')} />
           </div>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          {isBusinessView ? (
             <HumanReadablePanel ediContent={activeFile.content} onClose={() => setIsBusinessView(false)} provider={settings.aiProvider} />
          ) : (
             <Editor 
                ref={editorRef}
                key={activeFile.id}
                content={activeFile.content} 
                onChange={updateActiveContent} 
                fileName={activeFile.name}
                settings={settings}
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

      <header ref={headerRef} className="h-[46px] bg-[#0f1624] border-b border-white/5 flex items-center px-4 justify-between z-40 select-none relative shadow-sm">
        <div className="flex items-center gap-4 flex-none">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5 ${!isSidebarOpen ? 'text-blue-400' : ''}`}>
             {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-blue-500/20"><FileCode size={16} /></div>
             <div className="flex flex-col justify-center">
                <span className="font-semibold text-[13px] leading-tight text-slate-100">EDI Studio</span>
                <span className="text-[9px] font-bold text-slate-500 tracking-wide uppercase flex items-center gap-1">
                   Using {settings.aiProvider}
                </span>
             </div>
          </div>
        </div>

        <div className="flex-1 flex justify-center h-full">
           <MenuBar onAction={handleCommand} />
        </div>

        <div className="flex items-center gap-3 flex-none">
           <button onClick={() => setIsVoiceAgentOpen(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-bold border ${isVoiceAgentOpen ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
              <Mic size={14} /> Live
           </button>
           <button onClick={() => setAppMode(AppMode.AI_STUDIO)} className={`text-slate-400 hover:text-white transition-colors ${appMode === AppMode.AI_STUDIO ? 'text-indigo-400' : ''}`} title="AI Studio"><BrainCircuit size={18} /></button>
           <button onClick={() => toggleRightPanel('chat')} className={`text-slate-400 hover:text-white transition-colors ${isRightPanelOpen && activeRightTab === 'chat' ? 'text-blue-400' : ''}`} title="Chat Panel">
              {isRightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
           </button>
           <button onClick={() => setIsSettingsOpen(true)} className="text-slate-400 hover:text-white transition-colors" title="Settings"><Settings size={18} /></button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10 w-full">
        <div ref={sidebarRef} className={`flex-none flex flex-col h-full overflow-hidden bg-slate-900/50 border-r border-white/5 backdrop-blur-md z-20 ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}`} style={{ width: isSidebarOpen ? sidebarWidth : 0, opacity: isSidebarOpen ? 1 : 0 }}>
           <FileExplorer files={files} activeFileId={activeFileId} selectedFileIds={selectedFileIds} onSelectFile={(id) => { setActiveFileId(id); setOpenFileIds(prev => prev.includes(id) ? prev : [...prev, id]); }} onToggleSelection={() => {}} onCompareSelected={() => {}} onAiSummarizeSelected={() => setAppMode(AppMode.AI_STUDIO)} onNewFile={() => {}} onDeleteFile={() => {}} onUpload={() => {}} />
        </div>
        {isSidebarOpen && <div className="w-1 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-30 flex-none" onMouseDown={startResizing('left')} />}
        <div className="flex-1 flex flex-col min-w-0 relative z-10 h-full overflow-hidden">{renderMainArea()}</div>
        {isRightPanelOpen && appMode !== AppMode.AI_STUDIO && <div className="w-1 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-30 flex-none" onMouseDown={startResizing('right')} />}
        <div ref={rightPanelRef} className={`flex-none z-30 bg-slate-900/90 backdrop-blur-xl border-l border-white/10 shadow-2xl overflow-hidden flex flex-col ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}`} style={{ width: isRightPanelOpen && appMode !== AppMode.AI_STUDIO && activeFile && !activeFile.isCompareView ? rightPanelWidth : 0, opacity: isRightPanelOpen ? 1 : 0 }}>
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-white/5 flex-none">
               <div className="flex bg-slate-800 rounded-lg p-0.5 border border-white/5">
                  <button onClick={() => setActiveRightTab('chat')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeRightTab === 'chat' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><MessageSquare size={12} /> AI</button>
                  <button onClick={() => setActiveRightTab('validate')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeRightTab === 'validate' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><Activity size={12} /> Health</button>
                  <button onClick={() => setActiveRightTab('structure')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeRightTab === 'structure' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><ListTree size={12} /> Elements</button>
                  <button onClick={() => setActiveRightTab('rules')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeRightTab === 'rules' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><Shield size={12} /> Rules</button>
               </div>
               <button onClick={handleCloseRightPanel} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-hidden w-full">
            {(isRightPanelOpen && activeFile && !activeFile.isCompareView) && (
                activeRightTab === 'chat' || activeRightTab === 'validate' || activeRightTab === 'structure' ? (
                    <AnalysisPanel 
                        activeTab={activeRightTab}
                        analysis={activeFile.analysis || null} 
                        activeFileContent={activeFile.content}
                        contextFiles={chatContextFiles}
                        loading={appState === AppState.ANALYZING} 
                        onUpdateContent={updateActiveContent}
                        onClose={handleCloseRightPanel}
                        onJumpToLine={(l) => editorRef.current?.scrollToLine(l)}
                        ruleSets={ruleSets}
                        aiProvider={settings.aiProvider}
                    />
                ) : activeRightTab === 'rules' ? <ValidationRulesPanel ruleSets={ruleSets} onUpdateRuleSets={setRuleSets} onClose={handleCloseRightPanel} /> : <CloudFileManager currentFile={activeFile} onLoadFile={(f) => { setActiveFileId(f.id); setOpenFileIds(prev => prev.includes(f.id) ? prev : [...prev, f.id]); }} onFileSaved={() => {}} />
            )}
            </div>
        </div>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdateSettings={setSettings} />
      <StediModal isOpen={isStediOpen} onClose={() => setIsStediOpen(false)} activeFileContent={activeFile?.content || ''} />
      <SaveAsModal isOpen={isSaveAsModalOpen} onClose={() => setIsSaveAsModalOpen(false)} currentName={activeFile?.name || ''} onSave={updateActiveContent} />
      <LiveVoiceAgent isOpen={isVoiceAgentOpen} onClose={() => setIsVoiceAgentOpen(false)} files={chatContextFiles} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} commands={[]} onExecute={handleCommand} />
    </div>
  );
}

export default AppWrapper;