
import { detectDelimiters } from './ediDetection';

export interface EdiSegment {
  id: string;
  elements: string[];
  raw: string;
  line: number;
}

export interface ValueDiff {
  segmentId: string;
  elementIndex: number; // 1-based index (e.g., 03 for BEG03)
  valA: string;
  valB: string;
  lineA: number;
  lineB: number;
}

export type StructuralDiffStatus = 'MATCH' | 'MODIFIED' | 'LEFT_ONLY' | 'RIGHT_ONLY';

export interface AlignedSegment {
  status: StructuralDiffStatus;
  left: EdiSegment | null;
  right: EdiSegment | null;
  diffs?: number[]; // Indices of elements that differ (1-based)
}

export interface StructuralResult {
  alignedSegments: AlignedSegment[];
  summary: string;
  score: number;
  totalChanges: number;
}

const parseSegments = (content: string): EdiSegment[] => {
  if (!content) return [];
  const { segment: terminator, element: separator } = detectDelimiters(content);
  
  // Normalize newlines to avoid splitting issues if terminator isn't newline
  let cleanContent = content;
  if (terminator !== '\n' && terminator !== '\r\n') {
      cleanContent = content.replace(/[\r\n]+/g, '');
  }

  const chunks = cleanContent.split(terminator).map(s => s.trim()).filter(s => s.length > 0);
  
  return chunks.map((raw, idx) => {
    const parts = raw.split(separator);
    return {
      id: parts[0],
      elements: parts.slice(1),
      raw: raw,
      line: idx + 1
    };
  });
};

/**
 * Performs a structural comparison of two EDI contents.
 * Returns an aligned list suitable for side-by-side rendering.
 */
export const performStructuralDiff = (textA: string, textB: string): StructuralResult => {
  const segsA = parseSegments(textA);
  const segsB = parseSegments(textB);

  // 1. Compute LCS Matrix based on Segment IDs
  const m = segsA.length;
  const n = segsB.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (segsA[i - 1].id === segsB[j - 1].id) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i][j - 1], dp[i - 1][j]);
      }
    }
  }

  // 2. Backtrack to find alignment and build the aligned list
  let i = m;
  let j = n;
  
  const alignedSegments: AlignedSegment[] = [];
  let totalChanges = 0;

  // We walk backwards from the end of the matrix
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && segsA[i - 1].id === segsB[j - 1].id) {
      // MATCH (Structural ID Match) - Check for value differences
      const segA = segsA[i - 1];
      const segB = segsB[j - 1];
      const diffs: number[] = [];

      const maxElems = Math.max(segA.elements.length, segB.elements.length);
      for (let k = 0; k < maxElems; k++) {
        const valA = segA.elements[k] || '';
        const valB = segB.elements[k] || '';
        if (valA !== valB) {
          diffs.push(k + 1); // 1-based index
        }
      }

      if (diffs.length > 0) {
        alignedSegments.unshift({ status: 'MODIFIED', left: segA, right: segB, diffs });
        totalChanges++;
      } else {
        alignedSegments.unshift({ status: 'MATCH', left: segA, right: segB });
      }

      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // EXTRA (Present in B, not A) - Insert Gap in Left
      alignedSegments.unshift({ status: 'RIGHT_ONLY', left: null, right: segsB[j - 1] });
      totalChanges++;
      j--;
    } else {
      // MISSING (Present in A, not B) - Insert Gap in Right
      alignedSegments.unshift({ status: 'LEFT_ONLY', left: segsA[i - 1], right: null });
      totalChanges++;
      i--;
    }
  }

  // 3. Generate Summary
  let summary = "Structure matches perfectly.";
  let score = 100;

  if (totalChanges > 0) {
    summary = `Found ${totalChanges} differences in structure or values.`;
    score = Math.max(0, 100 - (totalChanges * 2));
  } 

  return {
    alignedSegments,
    summary,
    score,
    totalChanges
  };
};
