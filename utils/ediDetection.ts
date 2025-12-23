
/**
 * EDI Detection Utilities
 * Centralized logic for detecting EDI Standards (X12 vs EDIFACT) and 
 * extracting delimiters dynamically from file content.
 */

export type EdiStandard = 'X12' | 'EDIFACT' | 'UNKNOWN';

export interface EdiDelimiters {
  segment: string;
  element: string;
  component: string;
  release?: string; // Specific to EDIFACT
  standard: EdiStandard;
}

/**
 * Escapes special regex characters in a string.
 */
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Detects if the content is X12 or EDIFACT.
 */
export const detectEdiStandard = (content: string): EdiStandard => {
  const trimmed = content.trimStart();
  if (trimmed.startsWith('ISA')) return 'X12';
  if (trimmed.startsWith('GS') || trimmed.startsWith('ST')) return 'X12'; // Partial X12
  
  // Heuristic for X12 snippet (e.g. G23*05...)
  // Checks for 2-3 alphanumeric characters followed by an asterisk at start of line
  if (/^[A-Z0-9]{2,3}\*/.test(trimmed)) return 'X12';

  if (trimmed.startsWith('UNA') || trimmed.startsWith('UNB')) return 'EDIFACT';
  if (trimmed.startsWith('UNH')) return 'EDIFACT'; // Partial EDIFACT
  return 'UNKNOWN';
};

/**
 * Analyzing the content to find specific delimiters.
 * Follows strict X12 ISA and EDIFACT UNA rules.
 */
export const detectDelimiters = (content: string): EdiDelimiters => {
  const standard = detectEdiStandard(content);
  const trimmed = content.trimStart();
  
  if (standard === 'X12') {
    // X12 Rules (Fixed Length ISA)
    // Structure: ISA[ElementSep]...[ComponentSep][Terminator]
    // Index 3: Element Separator
    // Index 104: Component Separator
    // Index 105: Segment Terminator
    
    // Strict check if ISA is full length
    if (trimmed.startsWith('ISA') && trimmed.length >= 106) {
        return { 
            standard: 'X12', 
            segment: trimmed[105], 
            element: trimmed[3], 
            component: trimmed[104] 
        };
    }
    
    // Partial X12 Fallback (GS/ST starts or short ISA or snippets)
    // Heuristic: Check for common X12 delimiters
    // Most common: * for element, ~ for segment
    const hasStar = trimmed.includes('*');
    const hasTilde = trimmed.includes('~');
    const hasNewline = trimmed.includes('\n');
    
    // Guess element separator first
    let element = '*';
    if (trimmed.startsWith('ISA') && trimmed.length > 3) element = trimmed[3];
    else if (!hasStar && trimmed.includes('+')) element = '+';

    return { 
        standard: 'X12', 
        element: element,
        component: '>', // Default
        segment: hasTilde ? '~' : (hasNewline ? '\n' : '~')
    };
  }
  
  if (standard === 'EDIFACT') {
    // EDIFACT Rules
    // Check for UNA Service String Advice
    // Format: UNA:+.? '
    // Indices based on UNA prefix (3 chars)
    
    if (trimmed.startsWith('UNA') && trimmed.length >= 9) {
      return {
        standard: 'EDIFACT',
        component: trimmed[3],
        element: trimmed[4],
        release: trimmed[6],
        segment: trimmed[8]
      };
    }
    
    // Default EDIFACT delimiters if UNA is missing (Level A/B)
    return { 
      standard: 'EDIFACT', 
      segment: "'", 
      element: '+', 
      component: ':', 
      release: '?' 
    };
  }
  
  // UNKNOWN / TEXT Fallback
  // If we can't detect standard, we assume it's just text or non-standard
  return { 
    standard: 'UNKNOWN', 
    segment: '\n', 
    element: '', 
    component: '' 
  };
};
