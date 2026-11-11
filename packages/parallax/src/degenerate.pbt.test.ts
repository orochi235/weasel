/**
 * Property tests of the planes at degenerate views and lattices: a view zoomed to 0, to a denormal, or past what a
 * double holds, panned anywhere its own transform stays finite (a parallax camera anywhere at all), on a canvas of
 * no size; a period that is 0, negative, `NaN`, infinite, or
 * named on one axis only, fixed or read per draw. Whatever the view, a tiled layer and a parallax plane over it draw
 * only finite numbers; a screen source inside a tiled layer lands where it would drawn alone, whenever the view has
 * a finite inverse; and a lattice the view cannot resolve draws nothing of its world sources rather than a wrong copy.
 * A plane's listeners hear every source and plane change until they unsubscribe, and nothing after.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { drawOneLayer, type View } from '@weasel-js/core';
import { createTiledLayer, type TilePeriod } from './createTiledLayer';
import { createParallaxLayer } from './createParallaxLayer';
import { createParallaxPlane } from './createParallaxPlane';
import { coord, nonFinite, recordingSource, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const scale = fc.oneof(
  { weight: 3, arbitrary: fc.double({ min: 0.05, max: 20, noNaN: true }) },
  fc.constantFrom(0, -0, 5e-324, -5e-324, 1e-300, 1e300, -1e300, Number.MAX_VALUE),
);
const degenerateView: fc.Arbitrary<View> = fc.record({ x: fc.oneof(coord(1e6), fc.constantFrom(1e300, -Number.MAX_VALUE)), y: coord(1e6), sx: scale, sy: scale })
  .map(({ x, y, sx, sy }) => ({ x, y, scale: { x: sx, y: sy } }));
/** One the canvas itself can draw a world layer through: core's own transform for it is finite. */
const drawableView = degenerateView.filter((v) => Number.isFinite(v.x * v.scale.x) && Number.isFinite(v.y * v.scale.y));
const dims = fc.record({ width: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 2000 })), height: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 2000 })), dpr: fc.constant(1) });
const edgePeriod = fc.oneof(fc.double({ min: 1e-3, max: 1e6, noNaN: true }), fc.constantFrom(0, -1, NaN, Infinity, 5e-324));
const tilePeriod: fc.Arbitrary<TilePeriod> = fc.oneof(edgePeriod, fc.record({ x: edgePeriod, y: edgePeriod }, { requiredKeys: [] }));

type Cmd = { transform?: ArrayLike<number>; children?: Cmd[] };
const everyCommand = (cmds: readonly unknown[]): Cmd[] => (cmds as Cmd[]).flatMap((c) => [c, ...everyCommand(c.children ?? [])]);

/** Whether the view's world-to-screen map has a finite inverse on both axes. */
const invertible = (v: View) => [1 / v.scale.x, 1 / v.scale.y].every(Number.isFinite) && v.scale.x !== 0 && v.scale.y !== 0;

describe('a tiled layer at a degenerate view', () => {
  it('draws only finite numbers, and a screen source where it lands drawn alone', () => {
    const seen = tally();
    fc.assert(fc.property(drawableView, dims, tilePeriod, fc.boolean(), (view, d, period, perDraw) => {
      const world = recordingSource('world');
      const screen = recordingSource('screen');
      const tiled = createTiledLayer({ id: 't', label: 't', source: [world.layer, screen.layer], period: perDraw ? () => period : period });
      const out = drawOneLayer(tiled, undefined, view, d);
      expect(nonFinite(out)).toEqual([]);
      if (!invertible(view)) {
        seen.count('no inverse');
        return;
      }
      // The plane is drawn through the view; the screen group undoes it.
      const group = everyCommand(out).find((c) => c.transform?.[0] === 1 / view.scale.x && c.transform?.[4] === 1 / view.scale.y
        && c.transform?.[6] === view.x && c.transform?.[7] === view.y);
      seen.count('screen source placed');
      expect(group).toBeDefined();
      expect(screen.views).toHaveLength(1);
    }), runs(RUNS));
    seen.atLeast('no inverse', RUNS / 10);
    seen.atLeast('screen source placed', RUNS / 4);
  }, timeoutFor(RUNS, 10));
});

describe('a parallax plane at a degenerate view', () => {
  it('draws only finite numbers over a tiled lattice, whatever the camera', () => {
    fc.assert(fc.property(degenerateView, dims, tilePeriod, fc.double({ min: -4, max: 4, noNaN: true }), fc.option(scale, { nil: undefined }), (view, d, period, pan, zoom) => {
      const world = recordingSource('world');
      const screen = recordingSource('screen');
      const tiled = createTiledLayer({ id: 't', label: 't', source: [world.layer, screen.layer], period });
      const plane = createParallaxLayer({ id: 'p', label: 'p', source: [tiled, screen.layer], parallax: { pan, ...(zoom !== undefined ? { zoom } : {}) } });
      expect(nonFinite(drawOneLayer(plane, undefined, view, d))).toEqual([]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 10));

  it('tells its listeners of every source and plane change until they unsubscribe', () => {
    const seen = tally();
    type Op = { op: 'plane'; pan: number } | { op: 'source' } | { op: 'listen' } | { op: 'drop'; n: number };
    const op: fc.Arbitrary<Op> = fc.oneof(
      fc.integer({ min: 0, max: 3 }).map((pan) => ({ op: 'plane' as const, pan })),
      fc.constant({ op: 'source' as const }),
      fc.constant({ op: 'listen' as const }),
      fc.nat().map((n) => ({ op: 'drop' as const, n })),
    );
    fc.assert(fc.property(fc.array(op, { maxLength: 30 }), (ops) => {
      const sourceListeners = new Set<() => void>();
      const src = { ...recordingSource('world').layer, subscribe: (fn: () => void) => { sourceListeners.add(fn); return () => sourceListeners.delete(fn); } };
      const live = createParallaxPlane({ pan: 0 });
      const layer = createParallaxLayer({ id: 'p', label: 'p', source: [src], parallax: live });
      const listening: { heard: number; want: number; off: () => void }[] = [];
      const dropped: { heard: number }[] = [];
      let pan = 0;
      for (const o of ops) {
        if (o.op === 'listen') {
          const l = { heard: 0, want: 0, off: () => {} };
          l.off = layer.subscribe!(() => { l.heard++; });
          listening.push(l);
        } else if (o.op === 'drop') {
          if (listening.length === 0) continue;
          const [l] = listening.splice(o.n % listening.length, 1);
          l!.off();
          l!.off();
          dropped.push(l!);
          seen.count('dropped');
        } else if (o.op === 'source') {
          for (const fn of [...sourceListeners]) fn();
          for (const l of listening) l.want++;
        } else {
          live.set({ pan: o.pan });
          if (o.pan !== pan) for (const l of listening) l.want++;
          pan = o.pan;
        }
        for (const l of listening) expect(l.heard).toBe(l.want);
      }
      const before = dropped.map((l) => l.heard);
      live.set({ pan: pan + 1 });
      for (const fn of [...sourceListeners]) fn();
      expect(dropped.map((l) => l.heard)).toEqual(before);
      if (listening.length === 0) expect(sourceListeners.size).toBe(0);
    }), runs(RUNS));
    seen.atLeast('dropped', RUNS / 2);
  }, timeoutFor(RUNS, 2));
});
