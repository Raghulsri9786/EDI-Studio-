import React, { useState } from 'react';
import { X, Monitor, Type, Hash, Zap, BrainCircuit, Database, Trash2, Globe, Key, ExternalLink } from 'lucide-react';
import { AppSettings } from '../types';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  onSelectKey: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdateSettings, onSelectKey }) => {
  const [clearingDb, setClearingDb] = useState(false);

  if (!isOpen) return null;

  const update = (key: keyof AppSettings, value: any) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const handleClearDb = async () => {
    if (confirm("Are you sure you want to clear all files from the local database? This cannot be undone.")) {
        setClearingDb(true);
        try {
            await storageService.clearAllFiles();
            window.location.reload(); 
        } catch (e) {
            console.error(e);
        } finally {
            setClearingDb(false);
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 flex-none">
          <h2 className="text-lg font-bold text-slate-800">Settings</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          
          {/* AI Provider Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Globe size={14} /> AI Ecosystem
            </h3>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Preferred AI</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['gemini', 'deepseek'] as const).map((prov) => (
                  <button
                    key={prov}
                    onClick={() => update('aiProvider', prov)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      settings.aiProvider === prov 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {prov.charAt(0).toUpperCase() + prov.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={onSelectKey}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all border border-slate-200"
            >
              <Key size={14} /> Update Connected Keys
            </button>
          </div>

          <hr className="border-slate-100" />

          {/* Appearance Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Monitor size={14} /> Editor Appearance
            </h3>
            
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Type size={16} className="text-slate-500" /> Font Size
              </label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => update('fontSize', size)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      settings.fontSize === size 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Hash size={16} className="text-slate-500" /> Line Numbers
              </label>
              <button 
                onClick={() => update('showLineNumbers', !settings.showLineNumbers)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${settings.showLineNumbers ? 'bg-blue-600' : 'bg-slate-300'}`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.showLineNumbers ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* AI Configuration */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit size={14} /> Model Performance
            </h3>
            
            <div className="grid grid-cols-1 gap-2">
               <button
                 onClick={() => update('aiModel', 'speed')}
                 className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                   settings.aiModel === 'speed' 
                     ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' 
                     : 'bg-white border-slate-200 hover:border-blue-200'
                 }`}
               >
                 <div className={`p-2 rounded-full ${settings.aiModel === 'speed' ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                   <Zap size={18} />
                 </div>
                 <div>
                   <div className="text-sm font-bold text-slate-800">Speed</div>
                   <div className="text-xs text-slate-500">Fastest response time. Best for validation.</div>
                 </div>
               </button>

               <button
                 onClick={() => update('aiModel', 'power')}
                 className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                   settings.aiModel === 'power' 
                     ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-300' 
                     : 'bg-white border-slate-200 hover:border-purple-200'
                 }`}
               >
                 <div className={`p-2 rounded-full ${settings.aiModel === 'power' ? 'bg-purple-200 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                   <BrainCircuit size={18} />
                 </div>
                 <div>
                   <div className="text-sm font-bold text-slate-800">Intelligence</div>
                   <div className="text-xs text-slate-500">Deeper reasoning. Best for complex analysis.</div>
                 </div>
               </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Storage Management */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Database size={14} /> Storage Management
            </h3>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
               <div className="flex items-center justify-between">
                  <div>
                     <h4 className="text-sm font-bold text-slate-700">Local Database</h4>
                     <p className="text-xs text-slate-500">Files are stored in your browser.</p>
                  </div>
                  <button 
                    onClick={handleClearDb}
                    disabled={clearingDb}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold transition-colors shadow-sm"
                  >
                    <Trash2 size={14} /> {clearingDb ? "Clearing..." : "Clear DB"}
                  </button>
               </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center flex-none">
          <button onClick={onClose} className="text-sm font-medium text-blue-600 hover:underline">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;