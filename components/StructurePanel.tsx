
import React, { useMemo } from 'react';
import { Network } from 'lucide-react';
import { parseEdiToLines } from '../utils/ediParser';
import { ParsedLine } from '../types';

interface StructurePanelProps {
  ediContent: string;
}

// Common X12 and EDIFACT segment definitions for tooltips
const SEGMENT_DEFINITIONS: Record<string, string> = {
  'ISA': 'Interchange Control Header',
  'GS':  'Functional Group Header',
  'ST':  'Transaction Set Header',
  'BEG': 'Beginning Segment for Purchase Order',
  'BIG': 'Beginning Segment for Invoice',
  'BGM': 'Beginning of Message (EDIFACT)',
  'N1':  'Name (Party Identification)',
  'N2':  'Additional Name Information',
  'N3':  'Address Information',
  'N4':  'Geographic Location',
  'REF': 'Reference Identification',
  'DTM': 'Date/Time Reference',
  'PO1': 'Baseline Item Data',
  'LIN': 'Line Item (EDIFACT)',
  'PID': 'Product/Item Description',
  'SAC': 'Service, Promotion, Allowance, or Charge Information',
  'TDS': 'Total Monetary Value Summary',
  'CTT': 'Transaction Totals',
  'SE':  'Transaction Set Trailer',
  'GE':  'Functional Group Trailer',
  'IEA': 'Interchange Control Trailer',
  'UNB': 'Interchange Header (EDIFACT)',
  'UNH': 'Message Header (EDIFACT)',
  'UNT': 'Message Trailer (EDIFACT)',
  'UNZ': 'Interchange Trailer (EDIFACT)',
};

const StructurePanel: React.FC<StructurePanelProps> = ({ ediContent }) => {
  const segments = useMemo(() => {
    if (!ediContent) return [];
    
    // Use the robust parser logic instead of simple splitting
    const parsedLines = parseEdiToLines(ediContent);
    
    return parsedLines.map(line => {
      // Extract tokens that are elements
      const elements = line.tokens
        .filter(t => t.type === 'ELEMENT')
        .map(t => t.value);

      return { 
        id: line.segmentId, 
        elements, 
        raw: line.raw, 
        index: line.lineNumber 
      };
    });
  }, [ediContent]);

  if (!ediContent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
        <Network size={48} className="mb-4 opacity-20" />
        <p className="text-sm">No structure to display.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-4 bg-white border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Network size={16} className="text-purple-600" />
          Structural Breakdown
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Auto-parsed segments. Hover over Segment IDs for definitions.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="space-y-2">
          {segments.map((seg) => (
            <div 
              key={seg.index} 
              className="group flex items-start p-3 bg-white rounded-md border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all"
            >
              {/* Line Number */}
              <span className="text-xs font-mono text-slate-300 mr-3 mt-1 select-none w-6 text-right">
                {seg.index}
              </span>

              <div className="flex-1">
                {/* Segment Header */}
                <div className="flex items-center gap-2 mb-1">
                  <div className="relative">
                    <span 
                      className="font-bold font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-sm cursor-help border border-purple-100"
                      title={SEGMENT_DEFINITIONS[seg.id] || "Unknown Segment"}
                    >
                      {seg.id}
                    </span>
                  </div>
                  {SEGMENT_DEFINITIONS[seg.id] && (
                    <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
                      — {SEGMENT_DEFINITIONS[seg.id]}
                    </span>
                  )}
                </div>

                {/* Elements */}
                <div className="flex flex-wrap gap-1.5">
                  {seg.elements.map((el, idx) => (
                    <span 
                      key={idx}
                      className="font-mono text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-200 transition-colors break-all"
                      title={`Element ${idx + 1}`}
                    >
                      {el}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StructurePanel;
