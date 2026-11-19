import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { LoupePoint } from './lensTypes';

/** What {@link useLabBody} gives a loupe mounted as a lab contribution. */
export interface LabBody {
  /** The lab body the marker sits in, once found: the element lenses are drawn over. */
  body: HTMLElement | null;
  /** The same, for code that reads it outside a render. */
  bodyRef: RefObject<HTMLElement | null>;
  /** Where the pointer last moved over the body, in client coordinates, or null before it has. */
  pointer: RefObject<LoupePoint | null>;
  /** The ref for a hidden marker element the loupe renders: it finds the lab body around the marker. */
  attachMarker: (el: HTMLElement | null) => void;
}

/**
 * The lab body a loupe's lenses sit over, and the pointer moving across it. A loupe renders inside the lab body as
 * an overlay contribution, so it finds the body from a marker element of its own.
 */
export function useLabBody(): LabBody {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLElement | null>(null);
  const pointer = useRef<LoupePoint | null>(null);

  useEffect(() => {
    if (!body) return;
    const track = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
    };
    body.addEventListener('pointermove', track, { passive: true });
    return () => body.removeEventListener('pointermove', track);
  }, [body]);

  const attachMarker = useCallback((el: HTMLElement | null) => {
    const found = el?.closest<HTMLElement>('.lk-lab__body') ?? null;
    bodyRef.current = found;
    setBody(found);
  }, []);

  return { body, bodyRef, pointer, attachMarker };
}
