
import { LineError, EditorValidationResult } from '../types';
import { parseEdiToLines } from './ediParser';

/**
 * Validates a single element value based on X12 standards.
 */
function validateElement(value: string, type: string, min: number, max: number, qualifiers?: Record<string, string>): string | null {
  if (!value) return null; // Optional elements are skipped here

  if (value.length < min) return `Value '${value}' is too short (Min: ${min})`;
  if (value.length > max) return `Value '${value}' is too long (Max: ${max})`;

  switch (type) {
    case 'DT': 
        if (!/^\d{6,8}$/.test(value)) return "Invalid Date (Expect YYMMDD or CCYYMMDD)"; 
        break;
    case 'TM': 
        if (!/^\d{4,8}$/.test(value)) return "Invalid Time (Expect HHMM, HHMMSS, or HHMMSSd..)"; 
        break;
    case 'N0': 
        if (!/^-?\d+$/.test(value)) return "Expected Integer (N0)"; 
        break;
    case 'R':  
    case 'N2': 
        if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(value)) return "Expected Numeric (Decimal allowed)"; 
        break;
    case 'ID': 
        if (qualifiers && !qualifiers[value] && Object.keys(qualifiers).length > 0) return `Invalid Qualifier '${value}'. Expected one of: ${Object.keys(qualifiers).join(', ')}`; 
        break;
  }
  return null;
}

/**
 * Main function to validate parsed EDI content in real-time.
 * Uses the shared parser to ensure consistency with the editor view.
 */
export const validateRealTime = (content: string): EditorValidationResult => {
  const errors: LineError[] = [];
  
  // Reuse the main parser logic. This handles delimiter detection, splitting, and schema mapping.
  const lines = parseEdiToLines(content);

  // Track Envelopes for structure checks
  let hasISA = false;
  let hasGS = false;
  let hasST = false;
  let segmentCountSinceST = 0;

  lines.forEach((line) => {
    const segId = line.segmentId;
    const lineNum = line.lineNumber;

    // --- Envelope Logic ---
    if (segId === 'ISA') hasISA = true;
    if (segId === 'GS') hasGS = true;
    
    if (segId === 'ST' || segId === 'UNH') {
      hasST = true;
      segmentCountSinceST = 0;
    }
    
    if (segId === 'SE' || segId === 'UNT') {
      if (!hasST) {
        errors.push({
          line: lineNum,
          code: 'ORPHAN_TRAILER',
          message: `Unexpected ${segId} segment without preceding Header`,
          severity: 'ERROR',
          tokenIndex: 0
        });
      } else {
        // Validate count if possible (Element 1 usually)
        const countToken = line.tokens.find(t => t.index === 1);
        if (countToken && countToken.value) {
            const expected = segmentCountSinceST + 1; // Include SE itself
            if (parseInt(countToken.value) !== expected) {
                errors.push({
                    line: lineNum,
                    code: 'SEG_COUNT',
                    message: `Segment count mismatch. Expected ${expected}, found ${countToken.value}.`,
                    severity: 'WARNING',
                    tokenIndex: 1
                });
            }
        }
      }
      hasST = false; 
    }

    if (hasST) segmentCountSinceST++;

    // --- Unknown Segment Check ---
    // If the parser didn't find a schema definition for the segment ID token
    const segToken = line.tokens.find(t => t.type === 'SEGMENT_ID');
    if (segToken && !segToken.schema) {
       // Only warn for standard-looking segments (skip purely text lines)
       if (/^[A-Z][A-Z0-9]{1,2}$/.test(segId)) {
           errors.push({
            line: lineNum,
            code: 'UNKNOWN_SEG',
            message: `Unknown or unsupported segment ID: '${segId}'`,
            severity: 'WARNING',
            tokenIndex: 0
          });
       }
    }

    // --- Element Validation ---
    line.tokens.forEach((token) => {
        if (token.type === 'ELEMENT' && token.schema && 'type' in token.schema) {
            const errorMsg = validateElement(
                token.value,
                token.schema.type,
                token.schema.min,
                token.schema.max,
                token.schema.qualifiers
            );

            if (errorMsg) {
                errors.push({
                    line: lineNum,
                    code: 'VAL_ERR',
                    message: `${token.fullId || token.schema.id}: ${errorMsg}`,
                    severity: 'ERROR',
                    tokenIndex: token.index
                });
            }
        }
    });
  });

  return { isValid: errors.filter(e => e.severity === 'ERROR').length === 0, errors };
};
