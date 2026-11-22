import { decimal, present } from '@weasel-js/quantity';

export { pathThrough } from '../../pathThrough';

/** A coordinate as a mark's accessible name speaks it: up to three decimal places. */
export const formatCoord = (n: number): string => present(n, decimal({ maxPlaces: 3 })).spoken;

/**
 * The element a key event targets, when it sits inside the group of the layer `id`; else null. Every layer's
 * keyboard handler hears keys from every layer's marks, so each one starts here.
 */
export function keyTargetIn(e: KeyboardEvent, id: string): Element | null {
  const target = e.target as Element | null;
  if (target?.closest?.('[data-layer-id]')?.getAttribute('data-layer-id') !== id) return null;
  return target;
}
