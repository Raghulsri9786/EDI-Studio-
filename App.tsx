
import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { Activity, GitCompare, Layout, FileCode, Search, Settings, X, MessageSquare, Mic, Database, Cloud, UserCircle, LogOut, FilePlus, FolderOpen, Save, FileJson, BrainCircuit, BookOpen, Download, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripVertical, Shield } from 'lucide-react';
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
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [appMode, setAppMode] = useState<AppMode>(AppMode.EDITOR);
  const [isBusinessView, setIsBusinessView] = useState(false);

  // TP Rules State
  const [ruleSets, setRuleSets] = useState<TPRuleSet[]>([]);

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(420);
  const [activeRightTab, setActiveRightTab] = useState<PanelTab>('chat');
  
  const [isResizing, setIsResizing] = useState(false); // Disable transitions while dragging

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  
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

  const activeFile = files.find(f => f.id === activeFileId);
  const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
  const chatContextFiles = selectedFiles.length > 0 ? selectedFiles : (activeFile ? [activeFile] : []);
  
  // Derived open files list for tabs based on openFileIds order
  const openFiles = openFileIds
    .map(id => files.find(f => f.id === id))
    .filter(f => f !== undefined) as EdiFile[];

  const hasApiKey = settings.aiProvider === 'deepseek' 
    ? !!settings.deepSeekApiKey 
    : !!settings.geminiApiKey;

  // --- Resizing Logic ---

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


  // Global Key Down Listener for Command Palette & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette (Ctrl+Shift+P or F1)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }

      // Sidebar Toggle (Ctrl+B)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }

      // New File (Ctrl+N)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleNewFile();
      }

      // Save (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          setIsSaveAsModalOpen(true); // Save As
        } else {
          handleDownloadFile(); // Standard Save
        }
      }

      // Warp/Unwarp (Ctrl+Shift+W)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'w') {
         e.preventDefault();
         if (activeFile?.content.includes('\n')) {
             editorRef.current?.warp();
         } else {
             editorRef.current?.unwarp();
         }
      }

      // Validate (Ctrl+Shift+V)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
         e.preventDefault();
         if (!isRightPanelOpen || activeRightTab !== 'validate') {
             toggleRightPanel('validate');
         }
      }

      // Jump Errors (F8 / Shift+F8)
      if (e.key === 'F8') {
         e.preventDefault();
         if (e.shiftKey) {
             editorRef.current?.jumpToPrevError();
         } else {
             editorRef.current?.jumpToNextError();
         }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFileId, activeFile]); // Added activeFile dependency to access content for toggle logic

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

      // Load Rules from Local
      const savedRules = localStorage.getItem('edi_rules');
      if (savedRules) {
          try {
              setRuleSets(JSON.parse(savedRules));
          } catch (e) {}
      }

      // Load Files from IndexedDB (Local First)
      try {
        const storedFiles = await storageService.getAllFiles();
        if (storedFiles && storedFiles.length > 0) {
          setFiles(storedFiles);
          storedFiles.sort((a,b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
          
          // Only open the most recent file by default
          const mostRecent = storedFiles[0];
          setOpenFileIds([mostRecent.id]);
          setActiveFileId(mostRecent.id);
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
          setSettings(prev => ({ ...prev, ...cloudSettings, geminiApiKey: prev.geminiApiKey, deepSeekApiKey: prev.deepSeekApiKey }));
        }
      });
    }
  }, [user]);

  // Save Settings on Change
  useEffect(() => {
    localStorage.setItem('edi_settings', JSON.stringify(settings));
    if (user) {
      const timer = setTimeout(() => cloudService.saveSettings(settings), 1000);
      return () => clearTimeout(timer);
    }
  }, [settings, user]);

  // Save Rules on Change
  useEffect(() => {
      localStorage.setItem('edi_rules', JSON.stringify(ruleSets));
  }, [ruleSets]);

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

  const handleOpenFile = (id: string) => {
    if (!openFileIds.includes(id)) {
      setOpenFileIds(prev => [...prev, id]);
    }
    setActiveFileId(id);
    setAppMode(AppMode.EDITOR);
  };

  const handleCloseTab = (id: string) => {
    const newOpenIds = openFileIds.filter(oid => oid !== id);
    setOpenFileIds(newOpenIds);
    
    if (activeFileId === id) {
      // If we closed the active tab, switch to the last one in the list, or null if empty
      if (newOpenIds.length > 0) {
         setActiveFileId(newOpenIds[newOpenIds.length - 1]);
      } else {
         setActiveFileId(null);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const readers = Array.from(fileList).map((file: File) => {
      return new Promise<EdiFile>((resolve) => {
        const reader = new FileReader();
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        
        reader.onload = (e) => {
          let content = e.target?.result as string;
          
          if (isPdf && typeof content === 'string') {
             // Extract pure base64 for API usage if it's a data URL
             if (content.startsWith('data:')) {
                 content = content.split(',')[1];
             }
          }

          const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(36).substr(2, 9);
          
          resolve({
            id: id,
            name: file.name,
            content: content,
            lastModified: new Date(file.lastModified),
            mimeType: isPdf ? 'application/pdf' : 'text/plain'
          });
        };

        if (isPdf) {
            reader.readAsDataURL(file); // Read as Base64 for PDFs
        } else {
            reader.readAsText(file); // Read as Text for EDI/Code
        }
      });
    });

    try {
      const loadedFiles = await Promise.all(readers);
      await storageService.saveAllFiles(loadedFiles);

      setFiles(prev => {
        const newFiles = [...prev, ...loadedFiles];
        return newFiles;
      });

      if (loadedFiles.length > 0) {
        // Open the uploaded files in tabs
        const newIds = loadedFiles.map(f => f.id);
        setOpenFileIds(prev => [...prev, ...newIds]);
        setActiveFileId(newIds[0]);
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
      mimeType: 'text/plain'
    };
    setFiles(prev => [...prev, newFile]);
    storageService.saveFile(newFile);
    
    setOpenFileIds(prev => [...prev, newFile.id]);
    setActiveFileId(newFile.id);
    setAppState(AppState.VIEWING);
  };
  
  const handleSplitFiles = (newFilesData: { name: string; content: string }[]) => {
    const newFiles: EdiFile[] = newFilesData.map((d) => ({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(),
      name: d.name,
      content: d.content,
      lastModified: new Date(),
      mimeType: 'text/plain'
    }));
    
    storageService.saveAllFiles(newFiles);
    setFiles(prev => [...prev, ...newFiles]);

    if (newFiles.length > 0) {
        // Open only the first split file to avoid clutter
        setOpenFileIds(prev => [...prev, newFiles[0].id]);
        setActiveFileId(newFiles[0].id);
    }
  };

  // Permanent Deletion from Explorer & Storage
  const handleDeleteFile = (id: string) => {
    const newFiles = files.filter(f => f.id !== id);
    setFiles(newFiles);
    storageService.deleteFile(id);

    // Also close the tab if open
    if (openFileIds.includes(id)) {
        setOpenFileIds(prev => prev.filter(oid => oid !== id));
        if (activeFileId === id) {
            const remainingOpen = openFileIds.filter(oid => oid !== id);
            if (remainingOpen.length > 0) {
                setActiveFileId(remainingOpen[remainingOpen.length - 1]);
            } else {
                setActiveFileId(null);
            }
        }
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
        storageService.saveFile(updated); 
        
        if (user && f.cloudId) {
           if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
           autoSaveTimeoutRef.current = setTimeout(() => {
              cloudService.saveFile(updated).catch(console.error);
           }, 2000); 
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
      compareData: { files: [...selectedFiles] },
      mimeType: 'text/plain'
    };
    // Compare views are transient, add to files state but usually not storage unless saved
    setFiles(prev => [...prev, compareFile]);
    setOpenFileIds(prev => [...prev, compareFile.id]);
    setActiveFileId(compareFile.id);
    setSelectedFileIds(new Set());
  };

  const handleLoadCloudFile = (cloudFile: EdiFile) => {
    const existing = files.find(f => f.cloudId === cloudFile.cloudId);
    if (existing) {
      if (!openFileIds.includes(existing.id)) {
        setOpenFileIds(prev => [...prev, existing.id]);
      }
      setActiveFileId(existing.id);
    } else {
      setFiles(prev => [...prev, cloudFile]);
      storageService.saveFile(cloudFile);
      setOpenFileIds(prev => [...prev, cloudFile.id]);
      setActiveFileId(cloudFile.id);
    }
  };

  const handleCloudFileSaved = (localId: string, cloudId: string) => {
    setFiles(prev => prev.map(f => f.id === localId ? { ...f, cloudId, isSynced: true } : f));
  };

  // Jump to specific line in editor
  const handleJumpToLine = (line: number) => {
    if (editorRef.current) {
        editorRef.current.scrollToLine(line);
    }
  };

  // Command Execution Handler
  const handleCommand = (id: string) => {
    switch (id) {
      case 'new_file': handleNewFile(); break;
      case 'open_file': (document.querySelector('input[type="file"]') as HTMLInputElement)?.click(); break;
      case 'save_file': handleDownloadFile(); break;
      case 'save_as': setIsSaveAsModalOpen(true); break;
      case 'export_json': editorRef.current?.download('json'); break;
      case 'export_xml': editorRef.current?.download('xml'); break;
      case 'close_file': if(activeFileId) handleCloseTab(activeFileId); break; // Close tab only
      
      case 'undo': editorRef.current?.undo(); break;
      case 'redo': editorRef.current?.redo(); break;
      case 'copy': editorRef.current?.copy(); break;
      case 'find': editorRef.current?.toggleFind(); break;
      case 'warp': editorRef.current?.warp(); break;
      case 'unwarp': editorRef.current?.unwarp(); break;

      case 'toggle_sidebar': setIsSidebarOpen(!isSidebarOpen); break;
      case 'toggle_chat': toggleRightPanel('chat'); break;
      case 'toggle_business': setIsBusinessView(!isBusinessView); break;
      case 'fullscreen': if(!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); break;

      case 'validate': toggleRightPanel('validate'); break;
      case 'compare': handleCreateCompareTab(); break;
      case 'mapper': setAppMode(AppMode.MAPPER); break;
      case 'ai_studio': setAppMode(AppMode.AI_STUDIO); setIsRightPanelOpen(false); break;

      case 'ai_explain': toggleRightPanel('chat'); break;
      case 'ai_chat': toggleRightPanel('chat'); break;
      
      case 'about': alert('EDI Insight AI Studio v1.0'); break;
    }
  };

  const commands: CommandItem[] = [
    { id: 'new_file', label: 'New File', category: 'File', shortcut: 'Ctrl+N', icon: <FilePlus size={14} /> },
    { id: 'save_file', label: 'Save File', category: 'File', shortcut: 'Ctrl+S', icon: <Save size={14} /> },
    { id: 'save_as', label: 'Save As...', category: 'File', shortcut: 'Ctrl+Shift+S', icon: <Download size={14} /> },
    { id: 'open_file', label: 'Open File', category: 'File', shortcut: 'Ctrl+O', icon: <FolderOpen size={14} /> },
    { id: 'export_json', label: 'Export to JSON', category: 'File', icon: <FileJson size={14} /> },
    { id: 'validate', label: 'Validate EDI Structure', category: 'Tools', shortcut: 'Ctrl+Shift+V', icon: <Activity size={14} /> },
    { id: 'ai_studio', label: 'Open AI Studio', category: 'AI', icon: <BrainCircuit size={14} /> },
    { id: 'toggle_business', label: 'Generate Business View', category: 'View', icon: <BookOpen size={14} /> },
    { id: 'toggle_sidebar', label: 'Toggle Sidebar', category: 'View', shortcut: 'Ctrl+B' },
    { id: 'warp', label: 'Format: Warp (Single Line)', category: 'Edit', shortcut: 'Ctrl+Shift+W' },
    { id: 'unwarp', label: 'Format: Unwarp (Pretty Print)', category: 'Edit', shortcut: 'Ctrl+Shift+W' },
    { id: 'find', label: 'Find & Replace', category: 'Edit', shortcut: 'Ctrl+F' },
    { id: 'mapper', label: 'Switch to Mapper', category: 'Tools' },
  ];

  const renderMainArea = () => {
    // AI Studio Mode
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
              onClose={() => setAppMode(AppMode.EDITOR)} // Close button in studio goes back to editor
              onSplitFiles={handleSplitFiles}
              onStediClick={() => setIsStediOpen(true)}
              hasApiKey={hasApiKey}
              isFullScreen={true}
            />
        </div>
      );
    }

    if (!activeFile) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 relative overflow-hidden w-full">
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
        <div className="flex flex-col h-full w-full" ref={mainRef}>
           <div className="flex items-center justify-between bg-slate-900/50 border-b border-white/5 backdrop-blur-sm pr-3">
             <div className="flex-1 overflow-hidden">
                <EditorTabs 
                  files={openFiles} 
                  activeFileId={activeFileId} 
                  onSelect={setActiveFileId} 
                  onClose={handleCloseTab} 
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
      <div className="flex flex-col h-full w-full" ref={mainRef}>
        <div className="flex items-center justify-between bg-slate-900/50 border-b border-white/5 backdrop-blur-sm pr-3 h-10 relative z-20">
           <div className="flex-1 overflow-hidden">
              <EditorTabs 
                files={openFiles} 
                activeFileId={activeFileId} 
                onSelect={setActiveFileId} 
                onClose={handleCloseTab} 
              />
           </div>
           <div className="flex-none pl-2">
              <EditorToolbar 
                editorRef={editorRef} 
                editorState={editorState}
                isBusinessView={isBusinessView}
                ediContent={activeFile.content}
              />
           </div>
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          {appMode === AppMode.MAPPER ? (
             <MapperView ediContent={activeFile.content} hasApiKey={hasApiKey} />
          ) : isBusinessView ? (
             <HumanReadablePanel 
                ediContent={activeFile.content} 
                onClose={() => setIsBusinessView(false)}
             />
          ) : (
             <Editor 
                ref={editorRef}
                key={activeFile.id}
                content={activeFile.content} 
                onChange={updateActiveContent} 
                fileName={activeFile.name}
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

      {/* SINGLE ROW HEADER (Professional) */}
      <header ref={headerRef} className="h-[46px] bg-[#0f1624] border-b border-white/5 flex items-center px-4 justify-between z-40 select-none relative shadow-sm">
        
        {/* LEFT: App Branding */}
        <div className="flex items-center gap-4 flex-none">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className={`text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5 ${!isSidebarOpen ? 'text-blue-400' : ''}`} 
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
             {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-lg shadow-blue-500/20">
                <FileCode size={16} />
             </div>
             <div className="flex flex-col justify-center">
                <span className="font-semibold text-[13px] leading-tight text-slate-100">EDI Insight</span>
                <span className="text-[9px] font-bold text-slate-500 tracking-wide uppercase flex items-center gap-1">
                   <div className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                   {user ? 'Cloud Sync' : 'Local Database'}
                </span>
             </div>
          </div>
        </div>

        {/* CENTER: Integrated Menu Bar */}
        <div className="flex-1 flex justify-center h-full">
           <MenuBar onAction={handleCommand} />
        </div>

        {/* RIGHT: Controls */}
        <div className="flex items-center gap-3 flex-none">
           {user ? (
             <button onClick={() => signOut()} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors">
                <span className="hidden lg:inline">{user.email}</span>
                <LogOut size={16} />
             </button>
           ) : (
             <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-[#1e293b] hover:bg-blue-600 text-blue-400 hover:text-white rounded-md text-xs font-medium transition-all border border-white/10">
                <UserCircle size={14} /> Sign In
             </button>
           )}

           <button onClick={() => setIsVoiceAgentOpen(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-xs font-bold border ${isVoiceAgentOpen ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
              <Mic size={14} /> Live
           </button>

           <div className="h-4 w-px bg-white/10 mx-1"></div>

           <button onClick={() => setAppMode(AppMode.AI_STUDIO)} className={`text-slate-400 hover:text-white transition-colors ${appMode === AppMode.AI_STUDIO ? 'text-indigo-400' : ''}`} title="AI Studio">
              <BrainCircuit size={18} />
           </button>

           {appMode !== AppMode.AI_STUDIO && (
             <button 
                onClick={() => toggleRightPanel('chat')} 
                className={`text-slate-400 hover:text-white transition-colors ${isRightPanelOpen && activeRightTab === 'chat' ? 'text-blue-400' : ''}`} 
                title="Chat Panel"
             >
                {isRightPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
             </button>
           )}
           
           <button onClick={() => setIsSettingsOpen(true)} className={`text-slate-400 hover:text-white transition-colors ${!hasApiKey ? 'text-amber-400' : ''}`} title={!hasApiKey ? "API Key Required" : "Settings"}>
             <Settings size={18} />
           </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden relative z-10 w-full">
        
        {/* Left Sidebar */}
        <div 
            ref={sidebarRef} 
            className={`flex-none flex flex-col h-full overflow-hidden bg-slate-900/50 border-r border-white/5 backdrop-blur-md z-20 ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}`} 
            style={{ 
                width: isSidebarOpen ? sidebarWidth : 0, 
                opacity: isSidebarOpen ? 1 : 0 
            }}
        >
           <FileExplorer 
             files={files} 
             activeFileId={activeFileId} 
             selectedFileIds={selectedFileIds}
             onSelectFile={handleOpenFile} 
             onToggleSelection={toggleFileSelection}
             onCompareSelected={handleCreateCompareTab}
             onAiSummarizeSelected={() => { setAppMode(AppMode.AI_STUDIO); }}
             onNewFile={handleNewFile}
             onDeleteFile={handleDeleteFile}
             onUpload={handleFileUpload}
           />
        </div>

        {/* Resizer Handle (Left) */}
        {isSidebarOpen && (
            <div
                className="w-1 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-30 flex-none"
                onMouseDown={startResizing('left')}
            />
        )}

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10 h-full overflow-hidden">
           {renderMainArea()}
        </div>

        {/* Resizer Handle (Right) */}
        {isRightPanelOpen && appMode !== AppMode.AI_STUDIO && (
            <div
                className="w-1 h-full cursor-col-resize hover:bg-blue-500/50 active:bg-blue-600 transition-colors z-30 flex-none"
                onMouseDown={startResizing('right')}
            />
        )}

        {/* Right Panel - Hidden if in AI Studio Mode */}
        <div 
            ref={rightPanelRef} 
            className={`flex-none z-30 bg-slate-900/90 backdrop-blur-xl border-l border-white/10 shadow-2xl overflow-hidden flex flex-col ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}`} 
            style={{ 
                width: isRightPanelOpen && appMode !== AppMode.AI_STUDIO && activeFile && !activeFile.isCompareView ? rightPanelWidth : 0,
                opacity: isRightPanelOpen ? 1 : 0
            }}
        >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-white/5 flex-none">
            {/* Header Tabs: If in chat or validate mode, show a tab switcher. Otherwise show static title. */}
            {(activeRightTab === 'chat' || activeRightTab === 'validate' || activeRightTab === 'rules') ? (
               <div className="flex bg-slate-800 rounded-lg p-0.5 border border-white/5">
                  <button 
                    onClick={() => setActiveRightTab('chat')} 
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeRightTab === 'chat' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <MessageSquare size={12} /> Assistant
                  </button>
                  <button 
                    onClick={() => setActiveRightTab('validate')} 
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeRightTab === 'validate' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <Activity size={12} /> Validation
                  </button>
                  <button 
                    onClick={() => setActiveRightTab('rules')} 
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeRightTab === 'rules' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <Shield size={12} /> Rules
                  </button>
               </div>
            ) : (
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    {activeRightTab === 'tools' && <Cloud size={14} className="text-blue-400" />}
                    {activeRightTab === 'json' && <FileJson size={14} className="text-amber-400" />}
                    {activeRightTab === 'tools' ? 'Cloud Files' : 'JSON Output'}
                </span>
            )}

            <div className="flex items-center gap-2">
                <button onClick={handleCloseRightPanel} className="p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><X size={16} /></button>
            </div>
            </div>
            <div className="flex-1 overflow-hidden w-full">
            {(isRightPanelOpen && activeFile && !activeFile.isCompareView) && (
                activeRightTab === 'chat' || activeRightTab === 'validate' ? (
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
                    onJumpToLine={handleJumpToLine}
                    />
                ) : activeRightTab === 'rules' ? (
                    <ValidationRulesPanel 
                        ruleSets={ruleSets} 
                        onUpdateRuleSets={setRuleSets} 
                        onClose={handleCloseRightPanel}
                    />
                ) : (
                    <CloudFileManager 
                    currentFile={activeFile}
                    onLoadFile={handleLoadCloudFile}
                    onFileSaved={handleCloudFileSaved}
                    />
                )
            )}
            </div>
        </div>
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdateSettings={setSettings} />
      <StediModal isOpen={isStediOpen} onClose={() => setIsStediOpen(false)} activeFileContent={activeFile?.content || ''} />
      <SaveAsModal isOpen={isSaveAsModalOpen} onClose={() => setIsSaveAsModalOpen(false)} currentName={activeFile?.name || ''} onSave={handleDownloadFile} />
      <LiveVoiceAgent isOpen={isVoiceAgentOpen} onClose={() => setIsVoiceAgentOpen(false)} files={chatContextFiles} hasApiKey={hasApiKey && settings.aiProvider === 'gemini'} />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
      {/* Command Palette Overlay */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen} 
        onClose={() => setIsCommandPaletteOpen(false)} 
        commands={commands}
        onExecute={handleCommand}
      />
    </div>
  );
}

export default AppWrapper;
