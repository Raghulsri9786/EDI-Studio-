
import { LineError, EditorValidationResult, ParsedLine, SegmentRule } from '../types';
import { parseEdiToLines } from './ediParser';
import { X12_STRUCTURES } from '../data/x12Structure';

/**
 * Validates a single element value based on X12 standards.
 */
function validateElement(value: string, type: string, min: number, max: number, qualifiers?: Record<string, string>): { message: string, severity: 'ERROR' | 'WARNING' } | null {
  if (!value) return null;

  if (value.length < min) return { message: `Value '${value}' is too short (Min: ${min})`, severity: 'WARNING' };
  if (value.length > max) return { message: `Value '${value}' is too long (Max: ${max})`, severity: 'ERROR' };

  switch (type) {
    case 'DT': 
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
 * Recursive structural validation for X12 segments and loops.
 */
function validateStructure(
    lines: ParsedLine[], 
    structure: SegmentRule[], 
    startIndex: number, 
    maxIndex: number
): { errors: LineError[], lastIndex: number } {
    const errors: LineError[] = [];
    let lineIdx = startIndex;
    let structIdx = 0;

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

        if (['ISA', 'GS', 'GE', 'IEA'].includes(segId)) {
            if (!['ISA', 'GS', 'GE', 'IEA'].includes(rule.id)) {
                 lineIdx++;
                 continue;
            }
        }

        if (segId === rule.id) {
            if (rule.loop && rule.children) {
                const loopResult = validateStructure(lines, rule.children, lineIdx, maxIndex);
                errors.push(...loopResult.errors);
                if (loopResult.lastIndex > lineIdx) {
                    lineIdx = loopResult.lastIndex;
                    if (!rule.repeat) structIdx++;
                } else {
                    lineIdx++;
                }
            } else {
                lineIdx++;
                if (!rule.repeat) structIdx++;
            }
        } else {
            if (rule.req) {
                if (isExpectedLater(segId, structIdx + 1)) {
                     errors.push({
                        line: lines[lineIdx].lineNumber,
                        code: 'MISSING_SEG',
                        message: `Missing Mandatory Segment: ${rule.id} (Expected before ${segId})`,
                        severity: 'ERROR',
                        tokenIndex: 0
                     });
                     structIdx++;
                } else {
                    return { errors, lastIndex: lineIdx }; 
                }
            } else {
                structIdx++;
            }
        }
    }
    
    return { errors, lastIndex: lineIdx };
}

const validateTransactionStructure = (lines: ParsedLine[]): LineError[] => {
    const stLineIndex = lines.findIndex(l => l.segmentId === 'ST');
    if (stLineIndex === -1) return []; 

    const stLine = lines[stLineIndex];
    const transTypeToken = stLine.tokens.find(t => t.index === 1);
    const transType = transTypeToken?.value;
    
    if (!transType) return [];
    const def = X12_STRUCTURES[transType];
    if (!def) return [];

    let seLineIndex = -1;
    for(let i = stLineIndex + 1; i < lines.length; i++) {
        if (lines[i].segmentId === 'SE') {
            seLineIndex = i;
            break;
        }
    }
    
    const endIndex = seLineIndex !== -1 ? seLineIndex + 1 : lines.length;
    const { errors, lastIndex } = validateStructure(lines, def.structure, stLineIndex, endIndex);
    
    if (lastIndex < endIndex) {
        for(let i = lastIndex; i < endIndex; i++) {
            if (lines[i].segmentId === 'SE') continue;
            errors.push({
                line: lines[i].lineNumber,
                code: 'UNEXPECTED_SEG',
                message: `Unexpected Segment '${lines[i].segmentId}' in ${transType} structure.`,
                severity: 'WARNING',
                tokenIndex: 0
            });
        }
    }
    
    return errors;
};

export const validateRealTime = (content: string): EditorValidationResult => {
  const errors: LineError[] = [];
  const lines = parseEdiToLines(content);

  // Envelope Context Tracking
  let isaControl: string | null = null;
  let gsControl: string | null = null;
  let stControl: string | null = null;
  let segmentCountSinceST = 0;

  lines.forEach((line) => {
    const segId = line.segmentId;
    const lineNum = line.lineNumber;

    // --- ISA Fixed Length Check ---
    if (segId === 'ISA') {
        const rawTrimmed = line.raw.trim();
        // ISA is exactly 106 chars if includes terminator (105 elements + 1 terminator)
        if (rawTrimmed.length > 0 && rawTrimmed.length !== 106 && rawTrimmed.length !== 105) {
            errors.push({
                line: lineNum,
                code: 'ISA_LEN',
                message: `ISA segment length mismatch. Expected 105 characters, found ${rawTrimmed.length}.`,
                severity: 'ERROR',
                tokenIndex: -1
            });
        }
        isaControl = line.tokens.find(t => t.index === 13)?.value || null;
    }

    // --- GS Control Tracking ---
    if (segId === 'GS') {
        gsControl = line.tokens.find(t => t.index === 6)?.value || null;
    }

    // --- ST Control Tracking ---
    if (segId === 'ST' || segId === 'UNH') {
      stControl = line.tokens.find(t => t.index === 2)?.value || null;
      segmentCountSinceST = 0;
    }
    
    // --- Trailer Integrity & Control Matching ---
    if (segId === 'SE' || segId === 'UNT') {
      const seControl = line.tokens.find(t => t.index === 2)?.value;
      if (stControl && seControl !== stControl) {
          errors.push({
              line: lineNum,
              code: 'ST_SE_MISMATCH',
              message: `Control number mismatch. ST: ${stControl}, SE: ${seControl}.`,
              severity: 'ERROR',
              tokenIndex: 2
          });
      }

      const countToken = line.tokens.find(t => t.index === 1);
      if (countToken && countToken.value) {
          const expected = segmentCountSinceST + 1;
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
      stControl = null;
    }

    if (segId === 'GE') {
        const geControl = line.tokens.find(t => t.index === 2)?.value;
        if (gsControl && geControl !== gsControl) {
            errors.push({
                line: lineNum,
                code: 'GS_GE_MISMATCH',
                message: `Control number mismatch. GS: ${gsControl}, GE: ${geControl}.`,
                severity: 'ERROR',
                tokenIndex: 2
            });
        }
        gsControl = null;
    }

    if (segId === 'IEA') {
        const ieaControl = line.tokens.find(t => t.index === 2)?.value;
        if (isaControl && ieaControl !== isaControl) {
            errors.push({
                line: lineNum,
                code: 'ISA_IEA_MISMATCH',
                message: `Control number mismatch. ISA: ${isaControl}, IEA: ${ieaControl}.`,
                severity: 'ERROR',
                tokenIndex: 2
            });
        }
        isaControl = null;
    }

    if (stControl || segId === 'ST') segmentCountSinceST++;

    // --- Unknown Segment Check ---
    const segToken = line.tokens.find(t => t.type === 'SEGMENT_ID');
    if (segToken && !segToken.schema) {
       if (/^[A-Z][A-Z0-9]{1,2}$/.test(segId)) {
           errors.push({
            line: lineNum,
            code: 'UNKNOWN_SEG',
            message: `Unknown segment ID: '${segId}'`,
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

  if (lines.length > 0) {
      errors.push(...validateTransactionStructure(lines));
  }

  return { isValid: errors.filter(e => e.severity === 'ERROR').length === 0, errors };
};
