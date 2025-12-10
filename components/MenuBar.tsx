
import React, { useState, useEffect, useRef } from 'react';
import { 
  FilePlus, FolderOpen, Save, FileJson, FileCode, X, 
  Undo, Redo, Copy, Scissors, Clipboard, Search, Replace, AlignLeft, Minimize2,
  Sidebar, MessageSquare, Maximize2, Map, GitCompare, Activity,
  BrainCircuit, Sparkles, MessageCircle, HelpCircle, Keyboard, Info, BookOpen
} from 'lucide-react';

interface MenuBarProps {
  onAction: (actionId: string) => void;
}

const MenuBar: React.FC<MenuBarProps> = ({ onAction }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const menus = {
    File: [
      { id: 'new_file', label: 'New File', icon: <FilePlus size={14} />, shortcut: 'Ctrl+N' },
      { id: 'open_file', label: 'Open File...', icon: <FolderOpen size={14} />, shortcut: 'Ctrl+O' },
      { type: 'separator' },
      { id: 'save_file', label: 'Save', icon: <Save size={14} />, shortcut: 'Ctrl+S' },
      { id: 'export_json', label: 'Export to JSON', icon: <FileJson size={14} /> },
      { id: 'export_xml', label: 'Export to XML', icon: <FileCode size={14} /> },
      { type: 'separator' },
      { id: 'close_file', label: 'Close File', icon: <X size={14} /> },
    ],
    Edit: [
      { id: 'undo', label: 'Undo', icon: <Undo size={14} />, shortcut: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', icon: <Redo size={14} />, shortcut: 'Ctrl+Y' },
      { type: 'separator' },
      { id: 'copy', label: 'Copy', icon: <Copy size={14} />, shortcut: 'Ctrl+C' },
      { id: 'cut', label: 'Cut', icon: <Scissors size={14} />, shortcut: 'Ctrl+X' },
      { id: 'paste', label: 'Paste', icon: <Clipboard size={14} />, shortcut: 'Ctrl+V' },
      { type: 'separator' },
      { id: 'find', label: 'Find', icon: <Search size={14} />, shortcut: 'Ctrl+F' },
      { id: 'replace', label: 'Replace', icon: <Replace size={14} />, shortcut: 'Ctrl+H' },
      { type: 'separator' },
      { id: 'unwarp', label: 'Format: Unwarp', icon: <AlignLeft size={14} /> },
      { id: 'warp', label: 'Format: Warp', icon: <Minimize2 size={14} /> },
    ],
    View: [
      { id: 'toggle_sidebar', label: 'Toggle Sidebar', icon: <Sidebar size={14} />, shortcut: 'Ctrl+B' },
      { id: 'toggle_chat', label: 'Toggle AI Panel', icon: <MessageSquare size={14} />, shortcut: 'Ctrl+\\' },
      { type: 'separator' },
      { id: 'fullscreen', label: 'Toggle Fullscreen', icon: <Maximize2 size={14} />, shortcut: 'F11' },
    ],
    Tools: [
      { id: 'validate', label: 'Validate EDI', icon: <Activity size={14} /> },
      { id: 'compare', label: 'Compare Files', icon: <GitCompare size={14} /> },
      { id: 'mapper', label: 'Schema Mapper', icon: <Map size={14} /> },
    ],
    AI: [
      { id: 'ai_studio', label: 'Open AI Studio', icon: <BrainCircuit size={14} /> },
      { id: 'toggle_business', label: 'Generate Business View', icon: <BookOpen size={14} /> },
      { type: 'separator' },
      { id: 'ai_explain', label: 'Explain Selection', icon: <MessageCircle size={14} /> },
      { id: 'ai_summarize', label: 'Summarize Document', icon: <Sparkles size={14} /> },
    ],
    Help: [
      { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard size={14} /> },
      { id: 'about', label: 'About EDI Insight', icon: <Info size={14} /> },
    ]
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleHover = (menuName: string) => {
    if (activeMenu) {
      setActiveMenu(menuName);
    }
  };

  const executeAction = (actionId: string) => {
    onAction(actionId);
    setActiveMenu(null);
  };

  return (
    <div ref={menuRef} className="flex items-center px-2 bg-slate-900 border-b border-white/5 text-xs select-none relative z-50 h-8">
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="relative">
          <button
            className={`px-3 py-1.5 rounded hover:bg-white/10 transition-colors ${activeMenu === name ? 'bg-white/10 text-white' : 'text-slate-300'}`}
            onClick={() => handleMenuClick(name)}
            onMouseEnter={() => handleHover(name)}
          >
            {name}
          </button>

          {activeMenu === name && (
            <div className="absolute top-full left-0 w-56 bg-[#1e293b] border border-white/10 rounded-b-lg rounded-r-lg shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left">
              {items.map((item, idx) => {
                if ('type' in item && item.type === 'separator') {
                  return <div key={idx} className="h-px bg-white/10 my-1 mx-2" />;
                }
                const action = item as { id: string; label: string; icon: React.ReactNode; shortcut?: string };
                return (
                  <button
                    key={action.id}
                    onClick={() => executeAction(action.id)}
                    className="w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2 text-slate-300 group-hover:text-white">
                      <span className="opacity-70 group-hover:opacity-100">{action.icon}</span>
                      <span>{action.label}</span>
                    </div>
                    {action.shortcut && (
                      <span className="text-[10px] text-slate-500 group-hover:text-blue-100 font-mono ml-4">
                        {action.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MenuBar;
