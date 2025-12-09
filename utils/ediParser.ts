
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
  // We handle splitting by the detected terminator.
  let rawSegments: string[] = [];
  
  // If the terminator is a newline, split by it.
  if (terminator === '\n' || terminator === '\r\n') {
      rawSegments = content.split(/\r?\n/).filter(s => s.trim().length > 0);
  } else {
      // Split by character terminator (e.g. ~ or ')
      // Clean up newlines that might be used for display formatting between segments
      const cleanStream = content.replace(/[\r\n]+/g, ''); 
      rawSegments = cleanStream.split(terminator)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => s + terminator); // Add terminator back for display
  }

  const lines: ParsedLine[] = [];
  const loopStack: { id: string; startLine: number }[] = [];

  rawSegments.forEach((raw, idx) => {
    // Remove terminator for parsing logic
    let cleanRaw = raw;
    if (raw.endsWith(terminator)) {
        cleanRaw = raw.substring(0, raw.length - terminator.length).trim();
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
    if (terminator !== '\n' && terminator !== '\r\n') {
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
      raw,
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
