import React, { useState } from 'react';
import { Truck, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { generateSampleEdi, generateRelatedTransaction } from '../services/geminiService';

interface ToolboxProps {
  ediContent: string;
  onUpdateContent: (content: string) => void;
  onConvert: (result: string, format: string) => void;
  onSplitFiles?: (files: { name: string; content: string }[]) => void;
  onStediClick?: () => void;
}

const Toolbox: React.FC<ToolboxProps> = ({ ediContent, onUpdateContent }) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'x12': true
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGenerate = async (type: string) => {
    setLoadingAction(`generate-${type}`);
    try {
      if (ediContent && ediContent.length > 50) {
        const generated = await generateRelatedTransaction(ediContent, type);
        onUpdateContent(generated);
      } else {
        const sample = await generateSampleEdi(type);
        onUpdateContent(sample);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(null);
    }
  };

  const supplyChainGenerators = [
    { label: '855 PO Ack', desc: 'PO Acknowledgment' },
    { label: '856 ASN', desc: 'Ship Notice' },
    { label: '810 Invoice', desc: 'Invoice' },
  ];

  const renderGeneratorGrid = (items: { label: string; desc: string }[]) => (
    <div className="grid grid-cols-1 gap-2 mt-2 relative">
      {items.map((gen) => (
        <button
          key={gen.label}
          onClick={() => handleGenerate(gen.label)}
          disabled={!!loadingAction}
          className="px-3 py-3 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded text-sm font-medium text-slate-600 transition-all text-left flex justify-between items-center group shadow-sm disabled:opacity-50"
          title={gen.desc}
        >
          {gen.label}
          {loadingAction === `generate-${gen.label}` ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <span className="opacity-0 group-hover:opacity-100 text-lg leading-none text-blue-400">
              +
            </span>
          )}
        </button>
      ))}
    </div>
  );

  const SectionHeader = ({ id, title, icon }: { id: string, title: string, icon: React.ReactNode }) => (
    <div 
      onClick={() => toggleSection(id)}
      className="flex items-center justify-between cursor-pointer py-2 hover:bg-slate-50 transition-colors"
    >
      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
        {icon}
        {title}
      </h4>
      {openSections[id] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="text-xs text-slate-500 italic mb-4 bg-blue-50 p-2 rounded border border-blue-100">
          {ediContent ? "Generators use current context to create related docs." : "Generates sample templates from scratch."}
      </div>
      <div>
        <SectionHeader id="x12" title="Supply Chain (X12)" icon={<Truck size={12} />} />
        {openSections['x12'] && renderGeneratorGrid(supplyChainGenerators)}
      </div>
    </div>
  );
};

export default Toolbox;
