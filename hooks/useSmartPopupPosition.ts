
import { useState, useLayoutEffect, RefObject } from 'react';

interface PositionResult {
  top: number;
  left: number;
  placement: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  isCalculated: boolean;
  transformOrigin: string;
}

/**
 * Universal hook to position floating elements so they never overflow the viewport.
 * 
 * @param ref Reference to the popup HTML element (to measure width/height)
 * @param anchor {x, y} coordinates of the mouse or anchor element
 * @param offset Distance in pixels from the anchor point (default 12)
 */
export const useSmartPopupPosition = (
  ref: RefObject<HTMLElement>,
  anchor: { x: number; y: number },
  offset: number = 12
): PositionResult => {
  const [position, setPosition] = useState<PositionResult>({
    top: -9999, // Initial render off-screen
    left: -9999,
    placement: 'bottom-right',
    isCalculated: false,
    transformOrigin: 'top left'
  });

  useLayoutEffect(() => {
    if (!ref.current) return;

    const el = ref.current;
    const { width, height } = el.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;
    const PADDING = 10; // Minimum distance from screen edge

    // 1. Determine Horizontal Position (Left vs Right)
    // Default: Place to the right of cursor
    let left = anchor.x + offset;
    let placeX = 'right';

    // Check right overflow
    if (left + width > innerWidth - PADDING) {
      // Try placing to the left of cursor
      const leftSide = anchor.x - width - offset;
      
      // If left fits better, or if neither fits but left has more space
      if (leftSide > PADDING || (innerWidth - (left + width) < leftSide)) {
        left = leftSide;
        placeX = 'left';
      } else {
        // Clamp to right edge if it really doesn't fit anywhere
        left = innerWidth - width - PADDING;
      }
    }
    
    // Clamp horizontal
    left = Math.max(PADDING, left);


    // 2. Determine Vertical Position (Top vs Bottom)
    // Default: Place below cursor
    let top = anchor.y + offset;
    let placeY = 'bottom';

    // Check bottom overflow
    if (top + height > innerHeight - PADDING) {
      // Try placing above cursor
      const topSide = anchor.y - height - offset;
      
      // If top fits better
      if (topSide > PADDING) {
        top = topSide;
        placeY = 'top';
      } else {
        // If neither fits well, clamp to bottom edge
        top = innerHeight - height - PADDING;
      }
    }

    // Clamp vertical
    top = Math.max(PADDING, top);

    setPosition({
      top,
      left,
      placement: `${placeY}-${placeX}` as any,
      isCalculated: true,
      transformOrigin: `${placeY === 'top' ? 'bottom' : 'top'} ${placeX === 'left' ? 'right' : 'left'}`
    });

  }, [anchor.x, anchor.y, offset, ref]); // Re-run if anchor moves

  return position;
};
