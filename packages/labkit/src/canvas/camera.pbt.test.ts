/**
 * Properties of a lab's 2D camera: projecting a world point to the screen and back under any frame, zooming about a
 * screen point so the world under it stays put, centering on a point, labkit's camera restated as a weasel `View`
 * and back, a zoom held to its range about its anchor, and a client point restated in a scaled host's layout pixels.
 */
import type { View } from '@weasel-js/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Point, ViewTransform } from '../instrument/types';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { centerOn, zoomAt } from './camera';
import { clampZoomAbout, frameLocalToWorld, fromCameraView, toCameraView } from './cameraView';
import { screenToWorld, worldToScreen } from './canvasCoords';
import { clientToHost, type HostBox, hostToClient } from './hostBox';
import type { WorldFrame } from './worldSpec';

const RUNS = 300;

const coord = fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true });
/** A zoom spread evenly over six orders of magnitude. */
const zoom = fc.double({ min: -3, max: 3, noNaN: true }).map((e) => 10 ** e);
const pt: fc.Arbitrary<Point> = fc.record({ x: coord, y: coord });
const view: fc.Arbitrary<ViewTransform> = fc.record({ zoom, pan: pt });
const frame: fc.Arbitrary<WorldFrame> = fc.record({
  originPx: fc.record({
    x: fc.double({ min: 0, max: 2000, noNaN: true }),
    y: fc.double({ min: 0, max: 2000, noNaN: true }),
  }),
  yDir: fc.constantFrom(1 as const, -1 as const),
});

/** Equal to a relative 1e-9 of the largest magnitude that went into them. */
const close = (a: number, b: number, ...scale: number[]) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b), ...scale.map(Math.abs));

describe('the 2D camera', () => {
  it(
    'unprojects a projected world point to itself under any frame',
    () => {
      fc.assert(
        fc.property(pt, view, frame, (world, v, fr) => {
          const back = screenToWorld(worldToScreen(world, v, fr), v, fr);
          const reach = [
            v.pan.x / v.zoom,
            v.pan.y / v.zoom,
            fr.originPx.x / v.zoom,
            fr.originPx.y / v.zoom,
          ];
          expect(close(back.x, world.x, ...reach)).toBe(true);
          expect(close(back.y, world.y, ...reach)).toBe(true);
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );

  it(
    'zooms about a screen point, keeping the world under it there and the zoom inside its bounds',
    () => {
      const t = tally();
      fc.assert(
        fc.property(
          view,
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          pt,
          frame,
          fc.option(fc.tuple(zoom, zoom), { nil: undefined }),
          (v, factor, at, fr, bounds) => {
            const [min, max] = bounds
              ? [Math.min(...bounds), Math.max(...bounds)]
              : [undefined, undefined];
            const next = zoomAt(v, factor, at, { frame: fr, min, max });
            expect(Number.isFinite(next.zoom) && next.zoom > 0).toBe(true);
            if (min !== undefined && max !== undefined) {
              expect(next.zoom).toBeGreaterThanOrEqual(min);
              expect(next.zoom).toBeLessThanOrEqual(max);
              if (v.zoom * factor < min || v.zoom * factor > max) t.count('clamped');
            }
            const before = screenToWorld(at, v, fr);
            const after = screenToWorld(at, next, fr);
            const reach = [at.x, at.y, v.pan.x, v.pan.y, fr.originPx.x, fr.originPx.y].map(
              (n) => n / Math.min(v.zoom, next.zoom),
            );
            expect(close(after.x, before.x, ...reach)).toBe(true);
            expect(close(after.y, before.y, ...reach)).toBe(true);
            t.count('zoomed');
          },
        ),
        runs(RUNS),
      );
      t.atLeast('clamped', RUNS / 10);
    },
    timeoutFor(RUNS, 1),
  );

  it(
    'centers on a world point: the point lands in the middle of the viewport',
    () => {
      fc.assert(
        fc.property(
          pt,
          zoom,
          fc.record({ width: fc.nat(4000), height: fc.nat(4000) }),
          frame,
          (world, z, size, fr) => {
            const s = worldToScreen(world, centerOn(world, z, size, fr), fr);
            const reach = [
              world.x * z,
              world.y * z,
              fr.originPx.x,
              fr.originPx.y,
              size.width,
              size.height,
            ];
            expect(close(s.x, size.width / 2, ...reach)).toBe(true);
            expect(close(s.y, size.height / 2, ...reach)).toBe(true);
          },
        ),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );

  it(
    "as a weasel View places each frame-local point where labkit's camera places the world point, and comes back unchanged",
    () => {
      fc.assert(
        fc.property(pt, view, frame, (world, v, fr) => {
          const wv = toCameraView(v, fr);
          const local = frameLocalToWorld(world, fr);
          const labkit = worldToScreen(world, v, fr);
          const weasel = { x: (local.x - wv.x) * wv.scale.x, y: (local.y - wv.y) * wv.scale.y };
          const reach = [
            world.x * v.zoom,
            world.y * v.zoom,
            v.pan.x,
            v.pan.y,
            fr.originPx.x,
            fr.originPx.y,
          ];
          expect(close(weasel.x, labkit.x, ...reach)).toBe(true);
          expect(close(weasel.y, labkit.y, ...reach)).toBe(true);
          const back = fromCameraView(wv, fr);
          expect(back.zoom).toBe(v.zoom);
          expect(close(back.pan.x, v.pan.x, fr.originPx.x)).toBe(true);
          expect(close(back.pan.y, v.pan.y, fr.originPx.y)).toBe(true);
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );

  it(
    'holds a zoom step to its range about the screen point the step was anchored on',
    () => {
      const t = tally();
      const weaselView = (s: number, x: number, y: number): View => ({
        x,
        y,
        scale: { x: s, y: s },
      });
      fc.assert(
        fc.property(
          fc.record({ s: zoom, x: coord, y: coord }),
          fc.double({ min: 0.05, max: 20, noNaN: true }),
          pt,
          fc.tuple(zoom, zoom).map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const),
          ({ s, x, y }, factor, anchor, [min, max]) => {
            const prev = weaselView(s, x, y);
            const s1 = s * factor;
            if (s1 === s) return;
            // The step `zoomAt` would take: the world under `anchor` stays under it.
            const wx = x + anchor.x / s;
            const wy = y + anchor.y / s;
            const next = weaselView(s1, wx - anchor.x / s1, wy - anchor.y / s1);
            const held = clampZoomAbout(prev, next, min, max);
            expect(held.scale.x).toBe(held.scale.y);
            expect(held.scale.x).toBe(Math.min(max, Math.max(min, s1)));
            if (held.scale.x === s1) {
              expect(held).toBe(next);
              return;
            }
            t.count('clamped');
            const hx = held.x + anchor.x / held.scale.x;
            const hy = held.y + anchor.y / held.scale.x;
            const reach = [
              x,
              y,
              anchor.x / s,
              anchor.y / s,
              anchor.x / s1,
              anchor.y / s1,
              anchor.x / held.scale.x,
              anchor.y / held.scale.x,
            ];
            // The anchor is solved from the two views, which loses precision as their scales draw together.
            const slack = (1e3 * Math.max(1, s, s1)) / Math.abs(s1 - s);
            expect(Math.abs(hx - wx)).toBeLessThanOrEqual(
              1e-9 * slack * Math.max(1, ...reach.map(Math.abs)),
            );
            expect(Math.abs(hy - wy)).toBeLessThanOrEqual(
              1e-9 * slack * Math.max(1, ...reach.map(Math.abs)),
            );
          },
        ),
        runs(RUNS),
      );
      t.atLeast('clamped', RUNS / 5);
    },
    timeoutFor(RUNS, 1),
  );

  it(
    "restates a client point in a scaled host's layout pixels and back",
    () => {
      const scale = fc.double({ min: 0.1, max: 10, noNaN: true });
      const box: fc.Arbitrary<HostBox> = fc.record({
        left: coord,
        top: coord,
        width: fc.nat(4000),
        height: fc.nat(4000),
        scaleX: scale,
        scaleY: scale,
      });
      fc.assert(
        fc.property(box, pt, (b, c) => {
          const host = clientToHost(b, c.x, c.y);
          const back = hostToClient(b, host.x, host.y);
          expect(close(back.x, c.x, b.left)).toBe(true);
          expect(close(back.y, c.y, b.top)).toBe(true);
          expect(clientToHost(null, c.x, c.y)).toEqual(c);
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});
