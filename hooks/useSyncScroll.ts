
import { useEffect, RefObject } from 'react';

/**
 * Synchronizes scrolling (X and Y) between two container elements.
 * Uses event listeners to ensure smooth, instant 1:1 movement.
 */
export function useSyncScroll(ref1: RefObject<HTMLElement>, ref2: RefObject<HTMLElement>) {
  useEffect(() => {
    const el1 = ref1.current;
    const el2 = ref2.current;

    if (!el1 || !el2) return;

    let isSyncing1 = false;
    let isSyncing2 = false;

    const onScroll1 = () => {
      if (!isSyncing1) {
        isSyncing2 = true;
        el2.scrollLeft = el1.scrollLeft;
        el2.scrollTop = el1.scrollTop;
      }
      isSyncing1 = false;
    };

    const onScroll2 = () => {
      if (!isSyncing2) {
        isSyncing1 = true;
        el1.scrollLeft = el2.scrollLeft;
        el1.scrollTop = el2.scrollTop;
      }
      isSyncing2 = false;
    };

    el1.addEventListener('scroll', onScroll1, { passive: true });
    el2.addEventListener('scroll', onScroll2, { passive: true });

    return () => {
      el1.removeEventListener('scroll', onScroll1);
      el2.removeEventListener('scroll', onScroll2);
    };
  }, [ref1, ref2]);
}
