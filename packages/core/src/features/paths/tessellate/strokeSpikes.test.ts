/**
 * How far a stroke's ribbon is allowed to stray from the path it follows.
 *
 * A centered stroke puts every ribbon vertex within half its width of the
 * path — except at a miter, where the join extends to an apex the limit
 * bounds. Glyph outlines are where that bound earns its keep: a capital W's
 * interior apexes are acute enough that a permissive limit throws a visible
 * spike into the middle of the letter.
 */
import { describe, it, expect } from 'vitest';
import { tessellateStroke } from './stroke';
import { extractPolylines } from './polyline';
import { pathFromD } from '../pathFromD';

/** A capital W: two acute interior apexes, one per V. */
const W = 'M0 0 L14 70 L26 70 L36 22 L46 70 L58 70 L72 0 L60 0 L51 52 L42 0 L30 0 L21 52 L12 0 Z';
/** A single near-degenerate wedge — the case a working limit must clamp. */
const WEDGE = 'M0 0 L100 3 L0 6 Z';

const WIDTH = 4;

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The furthest any ribbon vertex sits from the source path. */
function worstStray(
  d: string,
  opts: { join?: 'miter' | 'round' | 'bevel'; miterLimit?: number } = {},
): number {
  const path = pathFromD(d);
  const mesh = tessellateStroke(path, {
    paint: { fill: 'solid', color: '#000' },
    width: WIDTH,
    ...(opts.join ? { join: opts.join } : {}),
    ...(opts.miterLimit !== undefined ? { miterLimit: opts.miterLimit } : {}),
  });
  const polylines = extractPolylines(path, {});
  let worst = 0;
  const v = mesh.vertices;
  for (let i = 0; i < v.length; i += 2) {
    let best = Infinity;
    for (const pl of polylines) {
      const p = pl.points;
      for (let k = 0; k + 3 < p.length; k += 2) {
        const dd = distToSeg(v[i]!, v[i + 1]!, p[k]!, p[k + 1]!, p[k + 2]!, p[k + 3]!);
        if (dd < best) best = dd;
      }
    }
    if (best > worst) worst = best;
  }
  return worst;
}

describe('stroke join overshoot', () => {
  // Guards the probe itself: a measurement that cannot see a spike it was
  // built to find proves nothing about the cases that come back clean.
  it('sees a spike when the limit is lifted', () => {
    expect(worstStray(WEDGE, { miterLimit: 1000 })).toBeGreaterThan(50);
  });

  it('clamps the wedge at the default limit', () => {
    expect(worstStray(WEDGE)).toBeLessThan(WIDTH);
  });

  it('puts no spike inside a stroked W', () => {
    // 7.99 at Canvas2D's limit of 10 — a spike reaching from the middle apex
    // most of the way down the letter.
    expect(worstStray(W)).toBeLessThan(WIDTH);
  });

  it('leaves bevel and round exactly at the half-width', () => {
    expect(worstStray(W, { join: 'bevel' })).toBeCloseTo(WIDTH / 2, 5);
    expect(worstStray(W, { join: 'round' })).toBeCloseTo(WIDTH / 2, 5);
  });
});
