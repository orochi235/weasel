import { useEffect, useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { useLatest } from '@weasel-js/react';

/**
 * Holds what a centering `stage` shows where it last stood while `holding`. A drop drawn into a centered form
 * grows it, centering moves it by half the growth, and the drop's hit test reads that move as the pointer's.
 * Returns the stage's attributes: none while free, and while held the place to pin its first child at.
 */
export function useHeldPlace(stage: RefObject<HTMLElement | null>, holding: boolean): { 'data-held'?: ''; style?: CSSProperties } {
  const place = useRef<{ x: number; y: number } | null>(null);
  const held = useLatest(holding);
  const read = (): void => {
    const box = stage.current;
    const shown = box?.firstElementChild;
    if (!box || !shown) return;
    const s = box.getBoundingClientRect();
    const r = shown.getBoundingClientRect();
    place.current = { x: r.left - s.left + box.scrollLeft, y: r.top - s.top + box.scrollTop };
  };
  useLayoutEffect(() => { if (!holding) read(); });
  useEffect(() => {
    const box = stage.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const seen = new ResizeObserver(() => { if (!held.current) read(); });
    seen.observe(box);
    if (box.firstElementChild) seen.observe(box.firstElementChild);
    return () => seen.disconnect();
  });
  const at = holding ? place.current : null;
  return at ? { 'data-held': '', style: { '--held-x': `${at.x}px`, '--held-y': `${at.y}px` } as CSSProperties } : {};
}
