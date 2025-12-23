
import React, { useMemo } from 'react';
import { ListTree, Hash, FileCode, Search, Info } from 'lucide-react';
import { parseEdiToLines } from '../utils/ediParser';
import { ParsedLine, ElementSchema } from '../types';

interface StructurePanelProps {
  ediContent: string;
}

const StructurePanel: React.FC<StructurePanelProps> = ({ ediContent }) => {
  const segments = useMemo(() => {
    if (!ediContent) return [];
    return parseEdiToLines(ediContent);
  }, [ediContent]);

  if (!ediContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
        <ListTree size={48} className="mb-4 opacity-10" />
        <p className="text-sm font-medium">No data selected</p>
        <p className="text-xs opacity-50 mt-2">Open an EDI file to view the hierarchical element breakdown.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      <div className="p-4 border-b border-white/5 bg-[#161b22] flex items-center justify-between">
        <div className="flex items-center gap-2">
            <ListTree size={16} className="text-blue-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Element Inspector</h3>
        </div>
        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-bold border border-blue-500/20">
            {segments.length} Segments
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        <div className="space-y-4 pb-10">
          {segments.map((line) => (
            <div 
              key={line.lineNumber} 
              className="group rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden hover:border-white/10 transition-all shadow-sm"
            >
              {/* Segment Header */}
              <div className="px-3 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 w-5">{line.lineNumber}</span>
                  <span className="font-mono font-bold text-blue-400 text-sm">{line.segmentId}</span>
                  {line.tokens[0]?.schema && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                      — {(line.tokens[0].schema as any).name}
                    </span>
                  )}
                </div>
              </div>

              {/* Elements List */}
              <div className="divide-y divide-white/[0.03]">
                {line.tokens.filter(t => t.type === 'ELEMENT').map((token) => {
                  const schema = token.schema as ElementSchema | undefined;
                  const isId = schema?.type === 'ID';
                  const qualifierDesc = isId && schema?.qualifiers ? schema.qualifiers[token.value] : null;

                  return (
                    <div key={token.index} className="px-3 py-2 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                      <div className="flex-none w-10 text-[10px] font-mono text-slate-600 mt-0.5">
                        {token.index < 10 ? `0${token.index}` : token.index}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">
                                {schema?.name || 'Unknown Element'}
                            </span>
                            {schema?.type && (
                                <span className="text-[9px] font-mono text-slate-600 uppercase border border-white/5 px-1 rounded flex-none">
                                    {schema.type} {schema.min}-{schema.max}
                                </span>
                            )}
                         </div>
                         
                         <div className="flex items-center gap-2">
                            <span className={`font-mono text-xs ${token.value ? 'text-emerald-400' : 'text-slate-600 italic'}`}>
                                {token.value || 'NULL'}
                            </span>
                            {qualifierDesc && (
                                <span className="text-[10px] text-blue-400/80 font-medium truncate">
                                    ({qualifierDesc})
                                </span>
                            )}
                         </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StructurePanel;
