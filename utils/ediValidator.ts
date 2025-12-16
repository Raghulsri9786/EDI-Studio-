
import { LineError, EditorValidationResult, ParsedLine, SegmentRule } from '../types';
import { parseEdiToLines } from './ediParser';
import { X12_STRUCTURES } from '../data/x12Structure';

/**
 * Validates a single element value based on X12 standards.
 * Returns an object with message and severity, or null if valid.
 */
function validateElement(value: string, type: string, min: number, max: number, qualifiers?: Record<string, string>): { message: string, severity: 'ERROR' | 'WARNING' } | null {
  if (!value) return null; // Optional elements are skipped here

  // Min length often indicates padding issues or non-compliant data, but might be readable.
  if (value.length < min) return { message: `Value '${value}' is too short (Min: ${min})`, severity: 'WARNING' };
  
  // Max length is critical as it causes truncation or buffer issues in legacy systems.
  if (value.length > max) return { message: `Value '${value}' is too long (Max: ${max})`, severity: 'ERROR' };

  switch (type) {
    case 'DT': 
        // Strict Date format
        if (!/^\d{6,8}$/.test(value)) return { message: "Invalid Date (Expect YYMMDD or CCYYMMDD)", severity: 'ERROR' }; 
        break;
    case 'TM': 
        if (!/^\d{4,8}$/.test(value)) return { message: "Invalid Time (Expect HHMM, HHMMSS...)", severity: 'ERROR' }; 
        break;
    case 'N0': 
        if (!/^-?\d+$/.test(value)) return { message: "Expected Integer (N0)", severity: 'ERROR' }; 
        break;
    case 'R':  
    case 'N2': 
        if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(value)) return { message: "Expected Numeric (Decimal allowed)", severity: 'ERROR' }; 
        break;
    case 'ID': 
        if (qualifiers && !qualifiers[value] && Object.keys(qualifiers).length > 0) {
            return { message: `Invalid Qualifier '${value}'. Expected one of: ${Object.keys(qualifiers).join(', ')}`, severity: 'ERROR' }; 
        }
        break;
  }
  return null;
}

/**
 * Structural Validation Logic
 * Matches parsed lines against a defined Segment Rule structure.
 */
function validateStructure(lines: ParsedLine[], structure: SegmentRule[], startIndex: number, maxIndex: number): { errors: LineError[], lastIndex: number } {
    const errors: LineError[] = [];
    let lineIdx = startIndex;
    let structIdx = 0;

    // Helper: Find if a segment ID exists in the remaining structure at the current level
    const isExpectedLater = (segId: string, currentStructIdx: number): boolean => {
        for (let i = currentStructIdx; i < structure.length; i++) {
            if (structure[i].id === segId) return true;
        }
        return false;
    };

    while (lineIdx < maxIndex && structIdx < structure.length) {
        const line = lines[lineIdx];
        const rule = structure[structIdx];
        const segId = line.segmentId;

        // Skip non-data lines or envelopes handled elsewhere if passed in a block
        // Note: envelopes are usually outside the body structure passed here, but purely defensive
        if (segId === 'ISA' || segId === 'GS' || segId === 'GE' || segId === 'IEA') {
            lineIdx++;
            continue;
        }

        // 1. Check for Match
        if (segId === rule.id) {
            // MATCH FOUND
            
            // If it's a loop start, recurse
            if (rule.loop && rule.children) {
                // Consume the loop trigger (current line)
                // Actually, the trigger IS the first segment of the loop definition usually. 
                // But in our definition, 'loop: true' is on the container rule, which shares the ID of the trigger.
                
                // Advance line for the trigger
                lineIdx++; 
                
                // Recurse for the REST of the loop content (children)
                // We pass the new lineIdx. 
                // The children definition usually includes the trigger as first element? 
                // In data/x12Structure.ts, the loop definition has `id: 'N1'`, and children start with `{ id: 'N1' }`.
                // This means the loop structure expects the N1 *again*?
                // Let's check structure.ts...
                // Yes: { id: 'N1', loop: true, children: [{ id: 'N1', req: true }, ...] }
                // This implies the container matches 'N1', but we shouldn't consume it if the child consumes it.
                // CORRECTION: We should NOT consume the line here if we delegate to children to validate the *entire* loop instance including trigger.
                
                lineIdx--; // Backtrack to let child validator consume the trigger
                
                const result = validateStructure(lines, rule.children, lineIdx, maxIndex);
                errors.push(...result.errors);
                
                // If we made progress
                if (result.lastIndex > lineIdx) {
                    lineIdx = result.lastIndex;
                    
                    // If the loop is repeatable, we DON'T advance structIdx, so we can check for another instance.
                    // If not repeatable, we move on.
                    if (!rule.repeat) {
                        structIdx++;
                    }
                } else {
                    // Loop didn't consume anything? Force advance to prevent infinite loop if trigger matched but child failed
                    lineIdx++;
                }
            } else {
                // Simple Segment Match
                lineIdx++;
                // If not repeatable, move to next rule
                if (!rule.repeat) {
                    structIdx++;
                }
            }
        } else {
            // MISMATCH
            
            // Is the current rule mandatory?
            if (rule.req) {
                // Check if the current line matches a FUTURE rule in this sequence.
                if (isExpectedLater(segId, structIdx + 1)) {
                     // We skipped the current mandatory segment because we found something that belongs later
                     errors.push({
                        line: lines[lineIdx].lineNumber, // Report error at current position
                        code: 'MISSING_SEG',
                        message: `Missing Mandatory Segment: ${rule.id} (Expected before ${segId})`,
                        severity: 'ERROR',
                        tokenIndex: 0
                     });
                     structIdx++; // Skip the missing rule
                     // Don't advance lineIdx, re-evaluate line against next rule
                } else {
                    // The line doesn't match current, and doesn't match future.
                    // It doesn't belong in this loop/structure level.
                    // Exit to parent.
                    return { errors, lastIndex: lineIdx }; 
                }
            } else {
                // Optional rule. Skip it.
                structIdx++;
                // Don't advance lineIdx, re-evaluate line against next rule
            }
        }
    }
    
    return { errors, lastIndex: lineIdx };
}

/**
 * Wrapper to extract transaction type and apply structure validation
 */
const validateTransactionStructure = (lines: ParsedLine[]): LineError[] => {
    // 1. Find ST segment
    const stLineIndex = lines.findIndex(l => l.segmentId === 'ST');
    if (stLineIndex === -1) return []; 

    const stLine = lines[stLineIndex];
    const transType = stLine.tokens.find(t => t.index === 1)?.value;
    if (!transType) return [];

    const def = X12_STRUCTURES[transType];
    if (!def) return []; // Unknown transaction, skip structure check

    // 2. Find SE segment to define bounds
    let seLineIndex = -1;
    // Search forward from ST
    for(let i = stLineIndex + 1; i < lines.length; i++) {
        if (lines[i].segmentId === 'SE') {
            seLineIndex = i;
            break;
        }
    }
    
    // If no SE, assume end of file or next ST/Envelope?
    // Let's validate up to SE or End.
    const endIndex = seLineIndex !== -1 ? seLineIndex + 1 : lines.length; // Include SE in validation range (structure includes SE)

    // Validate body
    const { errors, lastIndex } = validateStructure(lines, def.structure, stLineIndex, endIndex);
    
    // Check for unconsumed segments (Unexpected Data)
    if (lastIndex < endIndex) {
        for(let i = lastIndex; i < endIndex; i++) {
            // Ignore if it's the SE segment which might have been consumed or not depending on structure def
            // structure def usually ends with { id: 'SE', req: true }
            // If validateStructure returned before SE, it means SE was missing or unexpected stuff appeared before it.
            
            if (lines[i].segmentId === 'SE' && i === seLineIndex) continue; // Let the SE count check handle missing SE

            errors.push({
                line: lines[i].lineNumber,
                code: 'UNEXPECTED_SEG',
                message: `Unexpected Segment '${lines[i].segmentId}' in ${transType} transaction.`,
                severity: 'WARNING',
                tokenIndex: 0
            });
        }
    }
    
    return errors;
};


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
            const result = validateElement(
                token.value,
                token.schema.type,
                token.schema.min,
                token.schema.max,
                token.schema.qualifiers
            );

            if (result) {
                errors.push({
                    line: lineNum,
                    code: result.severity === 'ERROR' ? 'VAL_ERR' : 'VAL_WARN',
                    message: `${token.fullId || token.schema.id}: ${result.message}`,
                    severity: result.severity,
                    tokenIndex: token.index
                });
            }
        }
    });
  });

  // --- NEW: Structural Validation ---
  // Only run if basic parsing succeeded and we have a transaction
  if (lines.length > 0) {
      const structErrors = validateTransactionStructure(lines);
      errors.push(...structErrors);
  }

  return { isValid: errors.filter(e => e.severity === 'ERROR').length === 0, errors };
};
