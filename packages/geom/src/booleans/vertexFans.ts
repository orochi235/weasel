/** The edges meeting at a point, in order around it, and the windings between them. */

/** An edge leaving a point (`out`) or arriving at it, by the direction it leaves along: its own, or its reverse. */
export interface Ray {
  /** The sub-segment it is. */
  sub: number;
  out: boolean;
  dx: number;
  dy: number;
  n: number;
}

const upper = (r: Ray): boolean => r.dy > 0 || (r.dy === 0 && r.dx > 0);

/**
 * `rays` in order counterclockwise from +x. Compared by cross product rather
 * than by angle, so two nearly parallel rays keep the order their directions
 * give.
 */
export function sortRays(rays: Ray[]): Ray[] {
  return rays.sort((a, b) => {
    const ua = upper(a), ub = upper(b);
    if (ua !== ub) return ua ? -1 : 1;
    return b.dx * a.dy - b.dy * a.dx;
  });
}

/** The sector of sorted `rays` facing straight left, toward −x: sector `k` lies counterclockwise of ray `k`. */
export function sectorFacingLeft(rays: readonly Ray[]): number {
  let ups = 0;
  while (ups < rays.length && upper(rays[ups]!)) ups++;
  return (ups - 1 + rays.length) % rays.length;
}

/** The sector of sorted `rays` that is ray `k`'s left side. */
export function leftSector(rays: readonly Ray[], k: number): number {
  return rays[k]!.out ? k : (k - 1 + rays.length) % rays.length;
}

/** The windings of every sector of sorted `rays`, given sector `sector`'s. */
export function sectorWindings(rays: readonly Ray[], sector: number, w: number): number[] {
  const n = rays.length;
  const at = new Array<number>(n);
  at[sector] = w;
  for (let s = 1; s < n; s++) {
    const k = (sector + s) % n, r = rays[k]!;
    at[k] = at[(k - 1 + n) % n]! + (r.out ? r.n : -r.n);
  }
  return at;
}
