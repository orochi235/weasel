/**
 * `strokeHitTest` with a screen-space slop: a world-space ink band of radius
 * `threshold`, grown by `slop.px` pixels measured after `slop.transform`.
 * Under a non-uniform transform neither a scalar world tolerance nor a
 * per-axis one describes that region, so these compare against brute force.
 */
import { describe, expect, it } from 'vitest';
import { strokeHitTest } from './pathHitTest';
import { multiply, rotate, scale, type Mat3 } from './mat3';
import type { GeomPath } from './path';
import { PATH_L, PATH_M } from './commands';

const line = (ax: number, ay: number, bx: number, by: number): GeomPath => ({
  kind: 'polygon',
  commands: [PATH_M, PATH_L],
  coords: [ax, ay, bx, by],
});

const SQUISH = scale(4, 1);

describe('strokeHitTest — screen slop', () => {
  it('measures the slop on screen along each axis', () => {
    const p = line(0, 0, 10, 0);
    const slop = { px: 8, transform: SQUISH };
    // Above the line: 1 world unit is 1px, so 8px is 8 units.
    expect(strokeHitTest(p, 5, 7.9, 0, { slop })).toBe(true);
    expect(strokeHitTest(p, 5, 8.1, 0, { slop })).toBe(false);
    // Past the end: 1 world unit is 4px, so 8px is 2 units.
    expect(strokeHitTest(p, -1.9, 0, 0, { slop })).toBe(true);
    expect(strokeHitTest(p, -2.1, 0, 0, { slop })).toBe(false);
  });

  it('grows the world ink band by the screen slop', () => {
    const p = line(0, 0, 10, 0);
    const slop = { px: 8, transform: SQUISH };
    // Band edge at y = 1 world = 1px, then 8px more.
    expect(strokeHitTest(p, 5, 8.9, 1, { slop })).toBe(true);
    expect(strokeHitTest(p, 5, 9.1, 1, { slop })).toBe(false);
    // Round cap reaches x = -1 world = 4px left, then 8px = 2 units more.
    expect(strokeHitTest(p, -2.9, 0, 1, { slop })).toBe(true);
    expect(strokeHitTest(p, -3.1, 0, 1, { slop })).toBe(false);
  });

  it('agrees with brute force for a diagonal band under a rotated, squished transform', () => {
    const p = line(-5, -3, 7, 4);
    const r = 1.5;
    const px = 6;
    const m: Mat3 = multiply(rotate(0.7), scale(3, 0.8));
    const lin = (x: number, y: number) => [m[0] * x + m[2] * y, m[1] * x + m[3] * y];
    // Screen distance from (x, y) to the band, sampled densely.
    const bruteDist = (x: number, y: number): number => {
      const [qx, qy] = lin(x, y);
      let best = Infinity;
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const cx = -5 + 12 * t;
        const cy = -3 + 7 * t;
        for (let k = 0; k < 72; k++) {
          const a = (k / 72) * Math.PI * 2;
          for (const rr of [0, r * 0.5, r]) {
            const [sx, sy] = lin(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
            best = Math.min(best, Math.hypot(sx - qx, sy - qy));
          }
        }
      }
      return best;
    };
    let checked = 0;
    for (let i = 0; i < 400; i++) {
      // Deterministic spread over a box around the band.
      const x = -12 + ((i * 37) % 97) / 97 * 26;
      const y = -10 + ((i * 53) % 89) / 89 * 20;
      const d = bruteDist(x, y);
      // Skip the sliver where sampling error could decide it.
      if (Math.abs(d - px) < 0.1) continue;
      expect(strokeHitTest(p, x, y, r, { slop: { px, transform: m } }), `(${x}, ${y}) d=${d}`)
        .toBe(d <= px);
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('reduces to a world threshold under a uniform transform', () => {
    const p = line(0, 0, 10, 0);
    const slop = { px: 8, transform: scale(2, 2) };
    expect(strokeHitTest(p, 5, 3.9 + 1, 1, { slop })).toBe(true);
    expect(strokeHitTest(p, 5, 4.1 + 1, 1, { slop })).toBe(false);
  });

  it('handles a rect path', () => {
    const rect: GeomPath = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
    const slop = { px: 8, transform: SQUISH };
    expect(strokeHitTest(rect, 11.9, 5, 0, { slop })).toBe(true);
    expect(strokeHitTest(rect, 12.1, 5, 0, { slop })).toBe(false);
    expect(strokeHitTest(rect, 5, 17.9, 0, { slop })).toBe(true);
    expect(strokeHitTest(rect, 5, 18.1, 0, { slop })).toBe(false);
  });
});
