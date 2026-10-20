/**
 * Headings, and the fewest turns an orthogonal route needs between two points
 * in open space: the bend half of the search's heuristic. Exact in open space,
 * so with obstacles it never overestimates.
 */
import type { Vec2 } from '@weasel-js/core/math';

/** A heading: 0 east (+x), 1 south (+y), 2 west, 3 north. */
export type Dir = 0 | 1 | 2 | 3;

export const DX = [1, 0, -1, 0] as const;
export const DY = [0, 1, 0, -1] as const;

/** The heading nearest `v`'s direction; horizontal on a tie. */
export function dirOf(v: Vec2): Dir {
  if (Math.abs(v.x) >= Math.abs(v.y)) return v.x >= 0 ? 0 : 2;
  return v.y >= 0 ? 1 : 3;
}

/** `(x, y)` turned a quarter so heading `k` becomes east. */
function rotate(x: number, y: number, k: number): [number, number] {
  let rx = x;
  let ry = y;
  for (let i = 0; i < k; i++) [rx, ry] = [ry, -rx];
  return [rx, ry];
}

const EPS = 1e-7;
const sign = (v: number) => (v > EPS ? 1 : v < -EPS ? -1 : 0);

/**
 * The fewest turns from `p` heading `h` to `t`, arriving heading `arrive`
 * when given. A turn at `p` itself counts; reversing is two turns.
 */
export function minTurns(p: Vec2, h: Dir, t: Vec2, arrive: Dir | null): number {
  if (arrive === null) {
    const [px, py] = rotate(p.x - t.x, p.y - t.y, h);
    const sx = sign(px);
    if (sign(py) === 0) return sx <= 0 ? 0 : 3;
    return sx <= 0 ? 1 : 2;
  }
  const [px, py] = rotate(p.x - t.x, p.y - t.y, arrive);
  const heading = (h - arrive + 4) % 4;
  const sx = sign(px);
  const sy = sign(py);
  switch (heading) {
    case 0:
      if (sy === 0) return sx <= 0 ? 0 : 4;
      return sx < 0 ? 2 : 4;
    case 2:
      return sy === 0 ? 4 : 2;
    case 1:
      return sy <= 0 && sx < 0 ? 1 : 3;
    default:
      return sy >= 0 && sx < 0 ? 1 : 3;
  }
}
