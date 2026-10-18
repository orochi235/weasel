import type { Guide } from '../types';

/** A matched guide whose span also covers the snapped box. */
export function stretchSpan(g: Guide | null, min: number, max: number): Guide | null {
  if (g === null || g.span === undefined) return g;
  return { ...g, span: { min: Math.min(g.span.min, min), max: Math.max(g.span.max, max) } };
}
