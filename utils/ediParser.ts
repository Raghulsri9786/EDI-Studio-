
import { ParsedLine, EdiToken } from '../types';
import { STANDARD_SEGMENTS } from '../data/ediSchema';
import { detectDelimiters, escapeRegExp } from './ediDetection';

export const parseEdiToLines = (content: string): ParsedLine[] => {
  if (!content) return [];

  // 1. Detect Delimiters dynamically
  const { segment: terminator, element: separator, component, standard } = detectDelimiters(content);

  // If text file (unknown standard), treat as plain lines
  if (standard === 'UNKNOWN') {
      return content.split(/\r?\n/).map((raw, i) => ({
        lineNumber: i + 1,
        raw,
        segmentId: '',
        indent: 0,
        isLoopStart: false,
        tokens: [{ type: 'ELEMENT', value: raw, index: 0 }] as EdiToken[]
      }));
  }

  // 2. Split Content
  // FIX: Don't aggressively strip newlines.
  // If the user has formatted the file with newlines, assume they want line-based parsing
  // even if the segments are incomplete or missing terminators.
  let rawSegments: string[] = [];
  const hasNewlines = content.includes('\n');
  
  if (hasNewlines) {
      // PRESERVATION MODE: Split by visual line first.
      // This ensures incomplete segments like "REF*AN" stay on their own line
      // and don't get merged with the next line.
      rawSegments = content.split(/\r?\n/);
      // Filter out empty lines ONLY if they are truly empty, but keep lines with whitespace 
      // if they might be meaningful (though usually trimming is safer for display)
      // Actually, for editor fidelity, we should keep everything, but for *Parsing* logic
      // we usually want semantic lines. Let's filter purely empty lines to avoid noise.
      rawSegments = rawSegments.filter(s => s.trim().length > 0);
  } else {
      // RAW STREAM MODE: Split by terminator.
      // This is for files that come in as a single long string.
      // We clean up newlines that might be artifacts if they aren't the terminator.
      if (terminator !== '\n' && terminator !== '\r\n') {
          const cleanStream = content.replace(/[\r\n]+/g, ''); 
          rawSegments = cleanStream.split(terminator)
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map(s => s + terminator); // Add terminator back for visual consistency
      } else {
          rawSegments = content.split(/\r?\n/).filter(s => s.trim().length > 0);
      }
  }

  const lines: ParsedLine[] = [];
  const loopStack: { id: string; startLine: number }[] = [];

  rawSegments.forEach((raw, idx) => {
    // Clean up terminator for tokenization, but keep 'raw' intact for display if needed?
    // Actually, 'raw' in ParsedLine is used for display. 
    // If we split by newline, 'raw' is the line content.
    
    let cleanRaw = raw.trim();
    if (cleanRaw.endsWith(terminator) && terminator !== '\n' && terminator !== '\r\n') {
        cleanRaw = cleanRaw.substring(0, cleanRaw.length - terminator.length).trim();
    }
    
    // Split by Element Separator
    const parts = cleanRaw.split(separator);
    const segmentId = parts[0];
    const definition = STANDARD_SEGMENTS[segmentId];

    // --- Tokenize ---
    const tokens: EdiToken[] = [];
    
    // Segment ID Token
    tokens.push({
      type: 'SEGMENT_ID',
      value: segmentId,
      index: 0,
      fullId: segmentId,
      schema: definition
    });

    // Element Tokens
    for (let i = 1; i < parts.length; i++) {
      tokens.push({
        type: 'DELIMITER',
        value: separator,
        index: -1
      });
      
      const val = parts[i];
      const elementIndex = i;
      const elementId = `${segmentId}${elementIndex < 10 ? '0' + elementIndex : elementIndex}`;
      const elemSchema = definition?.elements.find(e => e.index === elementIndex);

      tokens.push({
        type: 'ELEMENT',
        value: val,
        index: elementIndex,
        fullId: elementId,
        schema: elemSchema
      });
    }

    // Add Terminator Token (Visual)
    // Only add if it was present in the original split or inferred
    if (raw.trim().endsWith(terminator) && terminator !== '\n' && terminator !== '\r\n') {
        tokens.push({
            type: 'TERMINATOR',
            value: terminator,
            index: -1
        });
    }

    // --- Hierarchy & Folding Logic ---
    let indent = 0;
    let isLoopStart = false;

    if (segmentId === 'IEA' || segmentId === 'UNZ') {
        indent = 0;
    } else if (segmentId === 'GE' || segmentId === 'UNE' || segmentId === 'UNT') {
        indent = 1;
    } else if (segmentId === 'SE') {
        indent = 2;
        while (loopStack.length > 0 && loopStack[loopStack.length - 1].id !== 'ST' && loopStack[loopStack.length - 1].id !== 'UNH') {
           const closed = loopStack.pop();
           if (closed && lines[closed.startLine]) lines[closed.startLine].loopEndLine = idx;
        }
    } else if (segmentId === 'ISA' || segmentId === 'UNB' || segmentId === 'UNA') {
        indent = 0;
    } else if (segmentId === 'GS' || segmentId === 'UNG') {
        indent = 1;
    } else if (segmentId === 'ST' || segmentId === 'UNH') {
        indent = 2;
    } else {
        indent = 3; 
        const loopStarters = ['N1', 'NM1', 'ENT', 'NAD', 'PO1', 'IT1', 'LIN', 'HL', 'LX', 'CLM'];
        
        if (loopStarters.includes(segmentId)) {
             if (loopStack.length > 0 && loopStack[loopStack.length - 1].id === segmentId) {
                const closed = loopStack.pop();
                 if (closed && lines[closed.startLine]) lines[closed.startLine].loopEndLine = idx - 1;
             }
             if (segmentId === 'HL' && loopStack.length > 0 && loopStack[loopStack.length - 1].id === 'HL') {
                const closed = loopStack.pop();
                 if (closed && lines[closed.startLine]) lines[closed.startLine].loopEndLine = idx - 1;
             }
             isLoopStart = true;
             loopStack.push({ id: segmentId, startLine: idx });
        }
        if (loopStack.length > 0 && !isLoopStart) {
            indent = 4;
        }
    }

    lines.push({
      lineNumber: idx + 1,
      raw: raw, // Use original raw including visual terminator
      segmentId,
      indent,
      isLoopStart,
      tokens
    });
  });

  while (loopStack.length > 0) {
      const closed = loopStack.pop();
      if (closed && lines[closed.startLine]) lines[closed.startLine].loopEndLine = lines.length - 1;
  }

  return lines;
};
