
import React, { useState } from 'react';
import { X, Monitor, Type, Hash, Zap, BrainCircuit, Key, Globe, Eye, EyeOff, Check, Lock, Database, Trash2, Cpu } from 'lucide-react';
import { AppSettings } from '../types';
import { storageService } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdateSettings }) => {
  const [showApiKey, setShowApiKey] = useState(false);
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
            window.location.reload(); // Reload to reflect empty state
        } catch (e) {
            console.error(e);
        } finally {
            setClearingDb(false);
        }
    }
  };

  const provider = settings.aiProvider || 'gemini';

  const getPlaceholder = () => {
    switch(provider) {
      case 'gemini': return "Required: Paste Gemini API Key";
      case 'deepseek': return "Required: sk-... (DeepSeek Key)";
      default: return "";
    }
  };

  const getKeyField = (): keyof AppSettings => {
    switch(provider) {
      case 'gemini': return 'geminiApiKey';
      case 'deepseek': return 'deepSeekApiKey';
      default: return 'geminiApiKey';
    }
  };

  const currentKey = settings[getKeyField()] as string;
  const isKeySaved = currentKey && currentKey.length > 5;

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

          <hr className="border-slate-100" />

          {/* AI Provider */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Globe size={14} /> AI Provider
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
               {/* Gemini */}
               <button
                 onClick={() => update('aiProvider', 'gemini')}
                 className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all ${
                   provider === 'gemini'
                     ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300 text-blue-800' 
                     : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200'
                 }`}
               >
                 <Zap size={20} className={provider === 'gemini' ? 'text-blue-600' : 'text-slate-400'} />
                 <span className="text-xs font-bold">Gemini</span>
               </button>

               {/* DeepSeek */}
               <button
                 onClick={() => update('aiProvider', 'deepseek')}
                 className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all ${
                   provider === 'deepseek'
                     ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300 text-indigo-800' 
                     : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                 }`}
               >
                 <Cpu size={20} className={provider === 'deepseek' ? 'text-indigo-600' : 'text-slate-400'} />
                 <span className="text-xs font-bold">DeepSeek</span>
               </button>
            </div>

            {/* Custom API Key Input - Dynamic based on provider */}
            <div className="mt-3">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1 justify-between">
                 <div className="flex items-center gap-1">
                    <Key size={12} /> {
                        provider === 'gemini' ? "Gemini API Key" : 
                        "DeepSeek API Key"
                    }
                 </div>
                 {isKeySaved ? 
                    <span className="text-emerald-600 flex items-center gap-1"><Check size={10} /> Saved</span> : 
                    <span className="text-amber-500 flex items-center gap-1"><Lock size={10} /> Missing</span>
                 }
               </h4>
               <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"}
                    value={currentKey || ''}
                    onChange={(e) => update(getKeyField(), e.target.value)}
                    className={`w-full pl-3 pr-10 py-2 border rounded text-sm outline-none transition-colors ${!currentKey ? 'border-amber-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500' : 'border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
                    placeholder={getPlaceholder()}
                  />
                  <button 
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
               </div>
               <p className="text-[10px] text-slate-500 mt-1">
                  You must provide your own API key to enable AI features. Your key is stored locally in your browser.
               </p>
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
