import type { BadgeCorner } from '../types';

const CORNERS: readonly BadgeCorner[] = ['tl', 'tr', 'bl', 'br'];

/** `lightFrom` as a corner, or a `RangeError` naming the `effect` it was given to. */
export function lightCorner(lightFrom: unknown, effect: string): BadgeCorner {
  if (CORNERS.includes(lightFrom as BadgeCorner)) return lightFrom as BadgeCorner;
  throw new RangeError(`a ${effect} effect's lightFrom must be 'tl', 'tr', 'bl', or 'br', not ${JSON.stringify(lightFrom)}`);
}
