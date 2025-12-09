
import { detectDelimiters } from './ediDetection';

/**
 * EDI Formatting Utilities
 * Handles Warping (Single Line) and Unwarping (Pretty Print) of EDI content.
 * Uses dynamic detection for delimiters.
 */

export const warpEdi = (text: string): string => {
  if (!text) return "";
  
  const { segment } = detectDelimiters(text);

  // Special Case: If the terminator IS a newline, we cannot "remove" newlines 
  // without destroying the structure. We just trim empty lines.
  if (segment === '\n' || segment === '\r\n') {
    return text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('\n');
  }

  // Standard Case: Terminator is a visible char (~, ', etc)
  // We can safely remove all line breaks to create a continuous stream.
  return text.replace(/[\r\n]+/g, '');
};

export const unwarpEdi = (text: string): string => {
  if (!text) return "";

  const { segment } = detectDelimiters(text);
  
  // Special Case: If terminator is already newline, just format cleanly
  if (segment === '\n' || segment === '\r\n') {
     return text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join('\n');
  }

  // 1. Warp first to ensure we have a clean stream (remove random newlines)
  const cleanStream = text.replace(/[\r\n]+/g, '');
  
  // 2. Split by terminator
  // Note: split consumes the terminator, so we must add it back
  const segments = cleanStream.split(segment);
  
  // 3. Reconstruct
  return segments
    .map(s => s.trim()) 
    .filter(s => s.length > 0) 
    .map(s => s + segment) // Add terminator back
    .join('\n'); // Add newline
};

// Kept for backward compatibility if imported elsewhere, but delegates to detection
export const detectSegmentTerminator = (text: string): string => {
    return detectDelimiters(text).segment;
};
