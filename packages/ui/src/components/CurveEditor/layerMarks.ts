import { trimNumber } from '@weasel-js/geom';
import type { PlotPoint } from './layerTypes';

/** An SVG path through `pts`, as straight segments. */
export function pathThrough(pts: readonly PlotPoint[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${trimNumber(p.x, 2)},${trimNumber(p.y, 2)}`).join('');
}

/**
 * The element a key event targets, when it sits inside the group of the layer `id`; else null. Every layer's
 * keyboard handler hears keys from every layer's marks, so each one starts here.
 */
export function keyTargetIn(e: KeyboardEvent, id: string): Element | null {
  const target = e.target as Element | null;
  if (target?.closest?.('[data-layer-id]')?.getAttribute('data-layer-id') !== id) return null;
  return target;
}
