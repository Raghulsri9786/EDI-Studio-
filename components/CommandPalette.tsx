
import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ChevronRight } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  icon?: React.ReactNode;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
  onExecute: (id: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands, onExecute }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase()) || 
    cmd.category?.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredCommands.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands.length > 0) {
        onExecute(filteredCommands[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-[#1e293b] rounded-xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[60vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder-slate-500 text-sm"
            placeholder="Type a command..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-[10px] text-slate-400 font-mono">
            ESC
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <button
                key={cmd.id}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between text-sm transition-colors group ${
                  idx === selectedIndex ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
                onClick={() => { onExecute(cmd.id); onClose(); }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded ${idx === selectedIndex ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                    {cmd.icon || <Command size={14} />}
                  </div>
                  <div>
                    <div className="font-medium">{cmd.label}</div>
                    {cmd.category && (
                      <div className={`text-[10px] ${idx === selectedIndex ? 'text-blue-200' : 'text-slate-500'}`}>
                        {cmd.category}
                      </div>
                    )}
                  </div>
                </div>
                {cmd.shortcut && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${idx === selectedIndex ? 'bg-blue-500 text-white border-transparent' : 'bg-slate-800 text-slate-500 border border-white/10'}`}>
                    {cmd.shortcut}
                  </span>
                )}
                {idx === selectedIndex && !cmd.shortcut && (
                   <ChevronRight size={14} className="opacity-50" />
                )}
              </button>
            ))
          )}
        </div>
        
        <div className="px-3 py-1.5 bg-slate-900/50 border-t border-white/5 flex justify-between text-[10px] text-slate-500">
           <span>Navigate <b className="text-slate-400">↑↓</b></span>
           <span>Select <b className="text-slate-400">↵</b></span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
