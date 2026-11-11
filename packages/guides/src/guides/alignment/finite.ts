import type { Bounds } from '@weasel-js/core';

/** Whether every coordinate of `b` is finite: a box that is not offers no line and no gap, since its edges compare
 *  with nothing and would scramble every sort it joins. */
export function isFiniteBox(b: Bounds): boolean {
  return Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.width) && Number.isFinite(b.height);
}
