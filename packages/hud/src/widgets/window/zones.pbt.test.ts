/**
 * Property tests of a HUD window's zones: which part of the frame a point falls in, the interior rect, and what a
 * drag from each zone does to the bounds.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally } from '../../pbt.fixture';
import { applyWindowDrag, cursorForZone, windowContentRect, zoneAt, type WindowMetrics, type WindowZone } from './zones';

const RUNS = 300;

const metrics: fc.Arbitrary<WindowMetrics> = fc.record({
  titleH: fc.integer({ min: 8, max: 40 }),
  edge: fc.integer({ min: 1, max: 12 }),
  closeSize: fc.integer({ min: 4, max: 20 }),
  grip: fc.integer({ min: 4, max: 20 }),
}).filter((m) => m.titleH >= m.edge);

/** A window on the pixel grid at least twice its edge each way, wide enough for its close box. */
const framed = metrics.chain((m) => fc.record({
  m: fc.constant(m),
  b: fc.record({
    x: fc.integer({ min: -500, max: 500 }),
    y: fc.integer({ min: -500, max: 500 }),
    w: fc.integer({ min: 2 * m.edge + m.closeSize, max: 400 }),
    h: fc.integer({ min: m.titleH + m.edge, max: 400 }),
  }),
}));

const EDGE_ZONES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
const ALL_ZONES: WindowZone[] = [...EDGE_ZONES, 'title', 'close', 'content'];
const mirrorX: Record<string, string> = { e: 'w', w: 'e', ne: 'nw', nw: 'ne', se: 'sw', sw: 'se', n: 'n', s: 's' };

describe('zoneAt', () => {
  it('names a zone for each pixel inside the window and none outside, edges and corners by distance to the frame', () => {
    const seen = tally();
    const near = (n: number) => fc.oneof(fc.integer({ min: -3, max: 24 }), fc.integer({ min: n - 24, max: n + 2 }), fc.integer({ min: 0, max: n - 1 }));
    const at = framed.chain((f) => fc.tuple(fc.constant(f), near(f.b.w), near(f.b.h)));
    fc.assert(fc.property(at, ([{ m, b }, i, j]) => {
      const x = b.x + i + 0.5, y = b.y + j + 0.5;
      const z = zoneAt(b, m, x, y);
      if (i < 0 || j < 0 || i >= b.w || j >= b.h) { expect(z).toBeNull(); seen.hit('outside'); return; }
      expect(z).not.toBeNull();
      seen.hit(z!);
      const ns = j < m.edge ? 'n' : j >= b.h - m.edge ? 's' : '';
      const we = i < m.edge ? 'w' : i >= b.w - m.edge ? 'e' : '';
      if (ns || we) { expect(z).toBe(ns + we); return; }
      if (j < m.titleH) expect(z).toBe(i >= b.w - m.edge - m.closeSize ? 'close' : 'title');
      else expect(z).toBe('content');
    }), runs(RUNS * 10));
    for (const z of [...ALL_ZONES, 'outside']) seen.atLeast(z, 5);
  });

  it('is the same under a translation, and mirrored across the vertical center line for the frame zones', () => {
    fc.assert(fc.property(framed, fc.nat(), fc.nat(), fc.integer({ min: -300, max: 300 }), fc.integer({ min: -300, max: 300 }),
      ({ m, b }, ii, jj, tx, ty) => {
        const i = ii % b.w, j = jj % b.h;
        const z = zoneAt(b, m, b.x + i + 0.5, b.y + j + 0.5);
        expect(zoneAt({ ...b, x: b.x + tx, y: b.y + ty }, m, b.x + tx + i + 0.5, b.y + ty + j + 0.5)).toBe(z);
        const mirrored = zoneAt(b, m, b.x + (b.w - 1 - i) + 0.5, b.y + j + 0.5);
        if (z && z in mirrorX) expect(mirrored).toBe(mirrorX[z]);
      }), runs(RUNS * 3));
  });

  it('puts every content pixel inside the content rect, and every pixel of the rect below the titlebar in content', () => {
    fc.assert(fc.property(framed, fc.nat(), fc.nat(), ({ m, b }, ii, jj) => {
      const i = ii % b.w, j = jj % b.h;
      const x = b.x + i + 0.5, y = b.y + j + 0.5;
      const r = windowContentRect(b, m);
      const inRect = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
      if (zoneAt(b, m, x, y) === 'content') expect(inRect).toBe(true);
      if (inRect) expect(zoneAt(b, m, x, y)).toBe('content');
    }), runs(RUNS * 3));
  });
});

describe('cursorForZone', () => {
  it('shows a resize cursor along the axis a frame zone resizes, move on the title, and the default elsewhere', () => {
    const want: Record<WindowZone, string> = {
      n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', ne: 'nesw-resize', sw: 'nesw-resize',
      nw: 'nwse-resize', se: 'nwse-resize', title: 'move', close: 'default', content: 'default',
    };
    for (const z of ALL_ZONES) expect(cursorForZone(z)).toBe(want[z]);
  });
});

const box = fc.record({
  x: fc.integer({ min: -500, max: 500 }), y: fc.integer({ min: -500, max: 500 }),
  w: fc.integer({ min: 0, max: 400 }), h: fc.integer({ min: 0, max: 400 }),
});
const delta = fc.oneof(fc.integer({ min: -600, max: 600 }), fc.double({ min: -600, max: 600, noNaN: true }));
const zone = fc.constantFrom(...ALL_ZONES);

describe('applyWindowDrag', () => {
  it('holds the edge opposite the one dragged, keeps the size at its minimum, and moves on the title', () => {
    const seen = tally();
    fc.assert(fc.property(box, zone, delta, delta, fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 200 }),
      (start, z, dx, dy, minW, minH) => {
        const out = applyWindowDrag(start, z, dx, dy, minW, minH);
        expect([out.x, out.y, out.w, out.h].every(Number.isFinite)).toBe(true);
        seen.hit(z);
        if (z === 'title') { expect(out).toEqual({ x: start.x + dx, y: start.y + dy, w: start.w, h: start.h }); return; }
        if (z === 'content' || z === 'close') { expect(out).toEqual(start); return; }
        const west = z.includes('w'), east = z.includes('e'), north = z.includes('n'), south = z.includes('s');
        if (west) {
          expect(out.x + out.w).toBeCloseTo(start.x + start.w, 9);
          expect(out.w).toBe(Math.max(minW, start.w - dx));
          if (start.w - dx < minW) seen.hit('clamped');
        } else if (east) {
          expect(out.x).toBe(start.x);
          expect(out.w).toBe(Math.max(minW, start.w + dx));
        } else expect([out.x, out.w]).toEqual([start.x, start.w]);
        if (north) {
          expect(out.y + out.h).toBeCloseTo(start.y + start.h, 9);
          expect(out.h).toBe(Math.max(minH, start.h - dy));
        } else if (south) {
          expect(out.y).toBe(start.y);
          expect(out.h).toBe(Math.max(minH, start.h + dy));
        } else expect([out.y, out.h]).toEqual([start.y, start.h]);
      }), runs(RUNS * 3));
    for (const z of ['clamped', ...EDGE_ZONES, 'title']) seen.atLeast(z, 5);
  });

  it('adds up: two drags from one zone that never reach the minimum land where one drag of their sum does', () => {
    fc.assert(fc.property(box, zone, fc.integer({ min: -300, max: 300 }), fc.integer({ min: -300, max: 300 }),
      fc.integer({ min: -300, max: 300 }), fc.integer({ min: -300, max: 300 }),
      (start, z, dx1, dy1, dx2, dy2) => {
        const once = applyWindowDrag(start, z, dx1, dy1, 0, 0);
        const sum = applyWindowDrag(start, z, dx1 + dx2, dy1 + dy2, 0, 0);
        fc.pre([once, sum].every((b) => b.w > 0 && b.h > 0));
        expect(applyWindowDrag(once, z, dx2, dy2, 0, 0)).toEqual(sum);
      }), runs(RUNS));
  });
});
