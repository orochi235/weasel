import { describe, expect, it } from 'vitest';
import { snapModuleRun, snapRectToGrid, snapSpanToGrid, type GridAxis } from './outputGridSnap';

/** How many dots from the axis origin `v` is; whole when `v` is on a boundary. */
const dotsAt = (v: number, a: GridAxis) => (v - a.origin) / a.pitch;
const onBoundary = (v: number, a: GridAxis) => Math.abs(dotsAt(v, a) - Math.round(dotsAt(v, a))) < 1e-9;
/** Origins one fifth of a dot apart, across a whole dot. */
const phases = (pitch: number) => [0, 0.2, 0.4, 0.6, 0.8].map((f) => f * pitch);

describe('snapSpanToGrid', () => {
  const axis: GridAxis = { pitch: 0.4, origin: 0.1 };

  it('puts both ends on the nearest dot boundary', () => {
    const s = snapSpanToGrid(1.02, 1.7, axis);
    expect(onBoundary(s.start, axis)).toBe(true);
    expect(onBoundary(s.start + s.length, axis)).toBe(true);
    expect(s.start).toBeCloseTo(0.9, 9);
    expect(s.length).toBeCloseTo(2.0, 9);
  });

  it('keeps a hairline at one dot, the dot its middle is in, at every phase', () => {
    for (const origin of phases(0.4)) {
      const a = { pitch: 0.4, origin };
      for (const start of [5, 5.13, 5.31]) {
        const s = snapSpanToGrid(start, 0.1, a);
        expect(s.length).toBeCloseTo(0.4, 9);
        expect(onBoundary(s.start, a)).toBe(true);
        const middle = start + 0.05;
        expect(middle).toBeGreaterThanOrEqual(s.start - 1e-9);
        expect(middle).toBeLessThanOrEqual(s.start + s.length + 1e-9);
      }
    }
  });

  it('leaves a zero span at zero, and reads a negative length as the span it covers', () => {
    expect(snapSpanToGrid(1.02, 0, axis).length).toBe(0);
    const s = snapSpanToGrid(2.72, -1.7, axis);
    expect(s.start).toBeCloseTo(0.9, 9);
    expect(s.length).toBeCloseTo(2.0, 9);
  });
});

describe('snapRectToGrid', () => {
  it('snaps every edge, on each axis against its own origin', () => {
    const grid = { pitch: 0.25, origin: { x: 0.1, y: -0.05 } };
    const r = snapRectToGrid({ x: 3.03, y: 7.4, width: 2.2, height: 0.05 }, grid);
    for (const v of [r.x, r.x + r.width]) expect(onBoundary(v, { pitch: 0.25, origin: 0.1 })).toBe(true);
    for (const v of [r.y, r.y + r.height]) expect(onBoundary(v, { pitch: 0.25, origin: -0.05 })).toBe(true);
    expect(r.height).toBeCloseTo(0.25, 9);
  });
});

describe('snapModuleRun', () => {
  const widths = [2, 1, 1, 2, 3, 1, 1, 3, 2, 2, 1, 4];

  it('gives every module the same whole dot count wherever the run falls against the grid', () => {
    for (const pitch of [72 / 180, 72 / 300, 72 / 203]) {
      for (const origin of phases(pitch)) {
        const axis = { pitch, origin };
        for (const start of [192, 192.13, 192.29]) {
          const { dots, edges } = snapModuleRun({ start, module: 0.55, widths }, axis);
          expect(dots).toBe(Math.max(1, Math.round(0.55 / pitch)));
          expect(edges).toHaveLength(widths.length + 1);
          edges.forEach((e) => expect(onBoundary(e, axis)).toBe(true));
          widths.forEach((w, i) => {
            expect(Math.round((edges[i + 1]! - edges[i]!) / pitch)).toBe(w * dots);
          });
          const total = widths.reduce((a, b) => a + b, 0);
          expect((edges.at(-1)! - edges[0]!) / pitch).toBeCloseTo(total * dots, 9);
        }
      }
    }
  });

  it('starts at the boundary nearest the run start', () => {
    const { edges } = snapModuleRun({ start: 10.15, module: 0.55, widths }, { pitch: 0.4, origin: 0 });
    expect(edges[0]).toBeCloseTo(10.0, 9);
  });

  it('keeps a module narrower than a dot at one dot, and takes a fixed count when given one', () => {
    const axis = { pitch: 0.4, origin: 0 };
    expect(snapModuleRun({ start: 0, module: 0.1, widths }, axis).dots).toBe(1);
    const fixed = snapModuleRun({ start: 0, module: 0.55, widths }, axis, { dots: 3 });
    expect(fixed.dots).toBe(3);
    expect(fixed.edges[1]).toBeCloseTo(2 * 3 * 0.4, 9);
  });

  it('rounds fractional widths where their running total lands, so the total holds', () => {
    const { edges } = snapModuleRun({ start: 0, module: 1, widths: [0.5, 0.5, 0.5, 0.5] }, { pitch: 1, origin: 0 });
    expect(edges.at(-1)).toBe(2);
  });
});
