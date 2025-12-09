
import { DiffResult, DiffLine, DiffPart } from '../types';

/**
 * Computes the Longest Common Subsequence (LCS) matrix for two arrays of strings.
 * This allows us to find the optimal path of alignment.
 */
function computeLCS(linesA: string[], linesB: string[]) {
  const m = linesA.length;
  const n = linesB.length;
  const C = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        C[i][j] = C[i - 1][j - 1] + 1;
      } else {
        C[i][j] = Math.max(C[i][j - 1], C[i - 1][j]);
      }
    }
  }
  return C;
}

/**
 * Backtracks the LCS matrix to generate aligned lines with gaps.
 */
function backtrackDiff(
  C: number[][],
  linesA: string[],
  linesB: string[],
  i: number,
  j: number,
  left: DiffLine[],
  right: DiffLine[]
) {
  if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
    backtrackDiff(C, linesA, linesB, i - 1, j - 1, left, right);
    // SAME
    left.push({ index: i, content: linesA[i - 1], type: 'SAME' });
    right.push({ index: j, content: linesB[j - 1], type: 'SAME' });
  } else if (j > 0 && (i === 0 || C[i][j - 1] >= C[i - 1][j])) {
    backtrackDiff(C, linesA, linesB, i, j - 1, left, right);
    // ADDED in B (Right), so GAP in A (Left)
    left.push({ index: null, content: '', type: 'EMPTY' });
    right.push({ index: j, content: linesB[j - 1], type: 'ADDED' });
  } else if (i > 0 && (j === 0 || C[i][j - 1] < C[i - 1][j])) {
    backtrackDiff(C, linesA, linesB, i - 1, j, left, right);
    // REMOVED in B (Right), so exists in A (Left), GAP in B (Right)
    left.push({ index: i, content: linesA[i - 1], type: 'REMOVED' });
    right.push({ index: null, content: '', type: 'EMPTY' });
  }
}

/**
 * Computes character-level diff for two strings using a simplified recursive LCS.
 */
function computeCharDiff(textA: string, textB: string): DiffPart[] {
  // Base cases
  if (textA === textB) return [{ type: 'SAME', value: textA }];
  if (!textA) return [{ type: 'ADDED', value: textB }];
  if (!textB) return [{ type: 'REMOVED', value: textA }];

  // LCS on characters
  const m = textA.length;
  const n = textB.length;
  // Use 1D array optimization for simple strings if memory issue, but 2D is fine for lines < 1000 chars
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (textA[i - 1] === textB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i][j - 1], dp[i - 1][j]);
      }
    }
  }

  const parts: DiffPart[] = [];
  let i = m, j = n;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && textA[i - 1] === textB[j - 1]) {
      parts.unshift({ type: 'SAME', value: textA[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      parts.unshift({ type: 'ADDED', value: textB[j - 1] });
      j--;
    } else {
      parts.unshift({ type: 'REMOVED', value: textA[i - 1] });
      i--;
    }
  }

  // Merge adjacent parts of same type
  const merged: DiffPart[] = [];
  parts.forEach(p => {
    if (merged.length > 0 && merged[merged.length - 1].type === p.type) {
      merged[merged.length - 1].value += p.value;
    } else {
      merged.push(p);
    }
  });

  return merged;
}

/**
 * Main Diff Function.
 * Returns aligned Left and Right arrays of lines.
 */
export const calculateDiff = (textA: string, textB: string): DiffResult => {
  const linesA = textA.split(/\r?\n/);
  const linesB = textB.split(/\r?\n/);

  const C = computeLCS(linesA, linesB);
  
  const rawLeft: DiffLine[] = [];
  const rawRight: DiffLine[] = [];
  
  backtrackDiff(C, linesA, linesB, linesA.length, linesB.length, rawLeft, rawRight);

  // Post-Processing: Detect Modifications
  // If we have (REMOVED + EMPTY) on Left followed immediately by (EMPTY + ADDED) on Right
  // AND they are "similar enough" (e.g. same Segment ID), merge them into MODIFIED.
  
  const finalLeft: DiffLine[] = [];
  const finalRight: DiffLine[] = [];
  let changeCount = 0;

  for (let k = 0; k < rawLeft.length; k++) {
    const l = rawLeft[k];
    const r = rawRight[k];

    // Check for potential Modify block
    // Current: Left=REMOVED/Right=EMPTY. Next: Left=EMPTY/Right=ADDED?
    // Actually, due to backtrack order, a substitution usually appears as:
    // Left: REMOVED, Right: EMPTY
    // Left: EMPTY,   Right: ADDED
    // We can peek ahead.

    if (l.type === 'REMOVED' && r.type === 'EMPTY' && k + 1 < rawLeft.length) {
      const nextL = rawLeft[k + 1];
      const nextR = rawRight[k + 1];

      if (nextL.type === 'EMPTY' && nextR.type === 'ADDED') {
        // We found a pair. Compare content.
        // Heuristic: If segment ID matches (e.g. both start with "PO1*"), treat as MODIFIED.
        const segA = l.content.split(/[+*]/)[0];
        const segB = nextR.content.split(/[+*]/)[0];

        if (segA === segB && segA.length > 0) {
          // It's a Modification!
          const charDiffs = computeCharDiff(l.content, nextR.content);
          
          finalLeft.push({
            ...l,
            type: 'MODIFIED',
            parts: charDiffs.filter(p => p.type !== 'ADDED') // Show what was removed/kept in Left
          });
          
          finalRight.push({
            ...nextR,
            type: 'MODIFIED',
            parts: charDiffs.filter(p => p.type !== 'REMOVED') // Show what was added/kept in Right
          });
          
          changeCount++;
          k++; // Skip next lines as we merged them
          continue;
        }
      }
    }

    // Normal push
    if (l.type !== 'SAME') changeCount++;
    finalLeft.push(l);
    finalRight.push(r);
  }

  return {
    leftLines: finalLeft,
    rightLines: finalRight,
    changeCount
  };
};
