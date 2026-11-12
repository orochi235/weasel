import type { View } from '@weasel-js/core';
import { type Dispatch, type RefObject, type SetStateAction, useLayoutEffect, useRef } from 'react';

/**
 * Keep what the canvas shows still on screen while a strip of chrome above the workspace grows or
 * collapses, by panning the view as far as the strip's height changed. `rows` names what the strip
 * holds, and changes whenever a row comes or goes; the pan lands in the commit that changes it, so the
 * content never paints displaced.
 */
export function useHoldContentUnderChrome(
  chromeRef: RefObject<HTMLElement | null>,
  setView: Dispatch<SetStateAction<View>>,
  rows: string,
): void {
  const height = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const next = el.getBoundingClientRect().height;
    const prev = height.current;
    height.current = next;
    if (prev === null || next === prev) return;
    const dy = next - prev;
    setView((v) => ({ ...v, y: v.y + dy / v.scale.y }));
  }, [chromeRef, setView, rows]);
}
