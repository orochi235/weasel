/**
 * Property tests of the tiled lattice and the parallax plane: the copies a draw makes cover the view with no gap
 * and no copy twice, at any offset, zoom, bleed, and plane depth; a view moved by one period draws the same
 * picture; and nothing drawn carries a non-finite number, at a depth of 0, of 1, or past the double range.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { drawOneLayer, viewportWorldRect, type View } from '@weasel-js/core';
import { tiledProject } from './tiledProject';
import { createTiledLayer } from './createTiledLayer';
import { createParallaxLayer } from './createParallaxLayer';
import { createParallaxPlane } from './createParallaxPlane';
import { coord, dims, nonFinite, offsetOf, period, recordingSource, runs, tally, timeoutFor, view } from './pbt.fixture';

const RUNS = 300;

describe('tiledProject', () => {
  it('names every cell the widened range touches, and no other', () => {
    const seen = tally();
    fc.assert(fc.property(coord(1e6), fc.double({ min: 0, max: 1e5, noNaN: true }), period, fc.double({ min: 0, max: 1e3, noNaN: true }),
      (start, span, p, bleed) => {
        const end = start + span;
        const { from, to } = tiledProject(start, end, p, bleed);
        seen.count(to - from > 0 ? 'several' : 'one');
        expect(Number.isSafeInteger(from) && Number.isSafeInteger(to)).toBe(true);
        expect(to).toBeGreaterThanOrEqual(from);
        // Cell k is [k p, (k + 1) p], placed where the layer places it.
        expect(from * p).toBeLessThanOrEqual(start - bleed);
        expect((to + 1) * p).toBeGreaterThanOrEqual(end + bleed);
        expect((from + 1) * p).toBeGreaterThan(start - bleed);
        expect(to * p).toBeLessThanOrEqual(end + bleed);
      }), runs(RUNS));
    seen.atLeast('several', RUNS / 4);
    seen.atLeast('one', RUNS / 20);
  }, timeoutFor(RUNS, 2));

  it('moves by whole cells as the range moves by whole periods', () => {
    fc.assert(fc.property(fc.integer({ min: -1e6, max: 1e6 }), fc.integer({ min: 0, max: 1e5 }), fc.integer({ min: 1, max: 5000 }),
      fc.integer({ min: 0, max: 1000 }), fc.integer({ min: -1000, max: 1000 }),
      (start, span, p, bleed, n) => {
        const a = tiledProject(start, start + span, p, bleed);
        const b = tiledProject(start + n * p, start + span + n * p, p, bleed);
        expect(b).toEqual({ from: a.from + n, to: a.to + n });
      }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

const bleedArb = fc.oneof(fc.constant(0), fc.double({ min: 0, max: 500, noNaN: true }));

describe('createTiledLayer', () => {
  it('draws each cell over the view once, with no gap, at any offset, zoom, and bleed', () => {
    const seen = tally();
    fc.assert(fc.property(view, dims, period, period, bleedArb, bleedArb, (v, d, px, py, bx, by) => {
      const { layer } = recordingSource();
      const tiled = createTiledLayer({ id: 't', label: 't', source: [layer], period: { x: px, y: py }, bleed: { x: bx, y: by } });
      const out = tiled.draw(undefined, v, d);
      const shown = viewportWorldRect(v, d);
      const kx = tiledProject(shown.x, shown.x + shown.width, px, bx);
      const ky = tiledProject(shown.y, shown.y + shown.height, py, by);
      const want = (kx.to - kx.from + 1) * (ky.to - ky.from + 1);
      if (want > 4096) { seen.count('too many'); expect(out).toEqual([]); return; }
      seen.count(want > 1 ? 'several' : 'one');
      expect(out).toHaveLength(want);
      const cells = out.map((c) => { const [tx, ty] = offsetOf(c); return [Math.round(tx / px), Math.round(ty / py)] as const; });
      out.forEach((c, n) => { expect(offsetOf(c).map((z) => z + 0)).toEqual([cells[n]![0] * px + 0, cells[n]![1] * py + 0]); });
      expect(new Set(cells.map(([i, j]) => `${i},${j}`)).size).toBe(want);
      const is = cells.map(([i]) => i);
      const js = cells.map(([, j]) => j);
      const [i0, i1, j0, j1] = [Math.min(...is), Math.max(...is), Math.min(...js), Math.max(...js)];
      expect((i1 - i0 + 1) * (j1 - j0 + 1)).toBe(want);
      expect(i0 * px).toBeLessThanOrEqual(shown.x - bx);
      expect((i1 + 1) * px).toBeGreaterThanOrEqual(shown.x + shown.width + bx);
      expect(j0 * py).toBeLessThanOrEqual(shown.y - by);
      expect((j1 + 1) * py).toBeGreaterThanOrEqual(shown.y + shown.height + by);
    }), runs(RUNS));
    seen.atLeast('several', RUNS / 4);
    seen.atLeast('too many', RUNS / 50);
  }, timeoutFor(RUNS, 20));

  it('draws the same picture with the view moved by one period', () => {
    const seen = tally();
    const intView = fc.record({
      x: fc.integer({ min: -1e6, max: 1e6 }), y: fc.integer({ min: -1e6, max: 1e6 }),
      sx: fc.constantFrom(0.25, 0.5, 1, 2, 4, -1, -2), sy: fc.constantFrom(0.25, 0.5, 1, 2, -1, -0.5),
    }).map(({ x, y, sx, sy }): View => ({ x, y, scale: { x: sx, y: sy } }));
    fc.assert(fc.property(intView, dims, fc.integer({ min: 1, max: 3000 }), fc.integer({ min: 1, max: 3000 }),
      fc.integer({ min: -3, max: 3 }), fc.integer({ min: -3, max: 3 }), fc.integer({ min: 0, max: 300 }),
      (v, d, px, py, nx, ny, bleed) => {
        const draw = (at: View) => {
          const { layer, views } = recordingSource();
          const tiled = createTiledLayer({ id: 't', label: 't', source: [layer], period: { x: px, y: py }, bleed });
          const out = tiled.draw(undefined, at, d);
          // Where each copy lands on screen: its offset seen through the view.
          const placed = out.map((c) => { const [tx, ty] = offsetOf(c); return `${(tx - at.x) * at.scale.x},${(ty - at.y) * at.scale.y}`; });
          return { placed: placed.sort(), views: views.map((w) => `${w.x},${w.y}`).sort() };
        };
        const a = draw(v);
        const b = draw({ ...v, x: v.x + nx * px, y: v.y + ny * py });
        seen.count(a.placed.length > 0 ? 'drew' : 'empty');
        expect(b).toEqual(a);
      }), runs(RUNS));
    seen.atLeast('drew', RUNS / 2);
  }, timeoutFor(RUNS, 30));
});

describe('createParallaxLayer', () => {
  const depth = fc.oneof(
    fc.constantFrom(0, 1, -1, 1e-300, 1e300, -1e300, Number.MAX_VALUE),
    fc.double({ min: -10, max: 10, noNaN: true }),
  );
  it('draws only finite numbers at any depth, a tiled lattice and a screen source inside it', () => {
    const seen = tally();
    fc.assert(fc.property(view, dims, depth, depth, fc.option(depth, { nil: undefined }), period, fc.record({ x: coord(1e6), y: coord(1e6) }),
      (v, d, panX, panY, z, p, anchor) => {
        const world = recordingSource('world');
        const screen = recordingSource('screen');
        const tiled = createTiledLayer({ id: 't', label: 't', source: [world.layer, screen.layer], period: { x: p, y: p } });
        const plane = createParallaxLayer({
          id: 'p', label: 'p', source: [tiled],
          parallax: createParallaxPlane({ pan: { x: panX, y: panY }, ...(z !== undefined ? { zoom: z } : {}), anchor }),
        });
        const out = drawOneLayer(plane, undefined, v, d);
        seen.count(world.views.length > 0 ? 'tiled' : 'untiled');
        expect(nonFinite(out)).toEqual([]);
        expect(world.views.flatMap((w) => nonFinite(w))).toEqual([]);
      }), runs(RUNS));
    seen.atLeast('tiled', RUNS / 4);
  }, timeoutFor(RUNS, 30));
});

describe('createParallaxPlane', () => {
  const xy = fc.record({ x: fc.integer({ min: -3, max: 3 }), y: fc.integer({ min: -3, max: 3 }) });
  const scalarOrXY = fc.oneof(fc.integer({ min: -3, max: 3 }), xy);
  const patch = fc.record({ pan: scalarOrXY, zoom: scalarOrXY, anchor: xy }, { requiredKeys: [] });
  it('reads back every write merged over the last, and notifies exactly when the opts change', () => {
    const seen = tally();
    fc.assert(fc.property(fc.record({ pan: scalarOrXY }), fc.array(fc.oneof(patch, fc.constant('again' as const)), { maxLength: 12 }), (initial, writes) => {
      const plane = createParallaxPlane(initial);
      let model: Record<string, unknown> = structuredClone(initial);
      let heard = 0;
      plane.subscribe(() => { heard++; });
      for (const write of writes) {
        const before = plane.get();
        const w = write === 'again' ? structuredClone(before) : write;
        const next = { ...model, ...structuredClone(w) };
        const changes = JSON.stringify(next) !== JSON.stringify(model) || Object.keys(next).length !== Object.keys(model).length;
        const was = heard;
        plane.set(w);
        seen.count(changes ? 'change' : 'same');
        expect(heard - was).toBe(changes ? 1 : 0);
        if (!changes) expect(plane.get()).toBe(before);
        model = next;
        expect(plane.get()).toEqual(model);
      }
    }), runs(RUNS));
    seen.atLeast('change', RUNS);
    seen.atLeast('same', RUNS / 5);
  }, timeoutFor(RUNS, 5));
});
