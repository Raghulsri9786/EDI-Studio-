
import React, { useState, useEffect } from 'react';
import { X, Save, FileType, Download } from 'lucide-react';

interface SaveAsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onSave: (name: string) => void;
}

const EXTENSIONS = [
  { value: 'edi', label: 'EDI File (.edi)' },
  { value: 'txt', label: 'Text File (.txt)' },
  { value: 'xml', label: 'XML Document (.xml)' },
  { value: 'xsd', label: 'XML Schema (.xsd)' },
  { value: 'xslt', label: 'XSLT Transform (.xslt)' },
  { value: 'out', label: 'Output File (.out)' },
  { value: 'in', label: 'Input File (.in)' },
  { value: 'int', label: 'Interface File (.int)' },
  { value: 'json', label: 'JSON Data (.json)' }
];

const SaveAsModal: React.FC<SaveAsModalProps> = ({ isOpen, onClose, currentName, onSave }) => {
  const [fileName, setFileName] = useState('');
  const [extension, setExtension] = useState('edi');

  useEffect(() => {
    if (isOpen) {
      const parts = currentName.split('.');
      if (parts.length > 1) {
        const ext = parts.pop() || '';
        setFileName(parts.join('.'));
        // Match existing extension or default to edi
        const match = EXTENSIONS.find(e => e.value === ext.toLowerCase());
        setExtension(match ? match.value : 'edi');
      } else {
        setFileName(currentName);
        setExtension('edi');
      }
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (fileName) {
      onSave(`${fileName}.${extension}`);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-800/50">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Save size={16} className="text-blue-400" />
            Save As
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Filename</label>
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
              <input 
                type="text" 
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder-slate-600"
                placeholder="Enter filename"
                autoFocus
              />
              <div className="px-3 py-2 bg-slate-900/50 border-l border-slate-700 text-slate-400 text-sm font-mono select-none">
                .{extension}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">File Format</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {EXTENSIONS.map(ext => (
                <button
                  key={ext.value}
                  onClick={() => setExtension(ext.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left ${
                    extension === ext.value 
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                      : 'bg-slate-800/50 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className={`p-1 rounded ${extension === ext.value ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                     <FileType size={12} />
                  </div>
                  {ext.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-slate-800/50 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20">
            <Download size={14} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveAsModal;
