import type { Rect } from '@weasel-js/geom';

/** A way to move across a surface, in its own x and y: y grows downward. */
export type Heading = 'left' | 'right' | 'up' | 'down';

/** How much a unit of drift across a heading costs against a unit of travel along it. */
export const HEADING_DRIFT = 2;

/** The heading an arrow key asks for, or null for any other key. */
export function headingOf(key: string): Heading | null {
  if (key === 'ArrowLeft') return 'left';
  if (key === 'ArrowRight') return 'right';
  if (key === 'ArrowUp') return 'up';
  return key === 'ArrowDown' ? 'down' : null;
}

/**
 * What it costs to go from `from` to `to` on `heading`, center to center: the travel along the heading plus
 * `drift` times the distance across it, so a target straight ahead beats a nearer one off to the side. Null for
 * a target that is not ahead at all.
 */
export function headingCost(from: Rect, to: Rect, heading: Heading, drift: number = HEADING_DRIFT): number | null {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const across = heading === 'left' || heading === 'right';
  const along = across ? dx : dy;
  const ahead = heading === 'left' || heading === 'up' ? -along : along;
  if (!(ahead > 0)) return null;
  return ahead + drift * Math.abs(across ? dy : dx);
}

/** Which of `targets` focus moves to from `from` on `heading`: the index of the cheapest by {@link headingCost},
 *  the earlier of two that tie, or -1 when none is ahead. A target with no box is passed over. */
export function nearestToward(
  from: Rect, targets: readonly (Rect | null | undefined)[], heading: Heading, drift: number = HEADING_DRIFT,
): number {
  let best = -1;
  let bestCost = Infinity;
  targets.forEach((to, i) => {
    const cost = to ? headingCost(from, to, heading, drift) : null;
    if (cost !== null && cost < bestCost) {
      best = i;
      bestCost = cost;
    }
  });
  return best;
}
