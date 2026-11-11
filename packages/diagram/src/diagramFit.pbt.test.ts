/**
 * `fitDiagram` on any small diagram in any box: a finite view, never above `maxScale`, that shows every node box and
 * route point unless it had to stop at its least scale, and kept inside `bounds` along each axis they are the wider on.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { viewportWorldRect } from '@weasel-js/core';
import { diagramViewBounds, fitDiagram } from './diagramFit';
import { diagramScene } from './fromData';
import { nonFinite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

const at = fc.integer({ min: -100, max: 100 }).map((n) => n * 10);
const nodes = fc.array(fc.record({ x: at, y: at, width: fc.integer({ min: 10, max: 200 }), height: fc.integer({ min: 10, max: 120 }) }), { minLength: 1, maxLength: 5 });
const waypoints = fc.array(fc.record({ x: at, y: at }), { maxLength: 3 });
const size = fc.record({ width: fc.integer({ min: 50, max: 600 }), height: fc.integer({ min: 50, max: 400 }) });

describe('fitDiagram', () => {
  it('shows every node box and route point, finite and never above its largest scale', () => {
    const seen = tally();
    fc.assert(fc.property(nodes, waypoints, size, fc.constantFrom<'center' | 'start'>('center', 'start'), fc.option(fc.integer({ min: 0, max: 40 }), { nil: undefined }), (boxes, route, box, anchor, padding) => {
      const specs = diagramScene({
        nodes: boxes.map((b, k) => ({ id: `n${k}`, lines: [], width: b.width, height: b.height, at: { x: b.x, y: b.y } })),
        edges: boxes.length > 1 ? [{ from: 'n0', to: 'n1', waypoints: route }] : [],
      }, { layout: 'none' });
      const view = fitDiagram(specs, box, { anchor, ...(padding !== undefined ? { padding } : {}) })!;
      expect(view).toBeDefined();
      expect(nonFinite(view)).toEqual([]);
      expect(view.scale.x).toBeLessThanOrEqual(1);
      if (view.scale.x <= 0.1 + 1e-12) return;
      seen.count('fit');
      const shown = viewportWorldRect(view, box);
      const eps = 1e-6 * (Math.abs(shown.x) + Math.abs(shown.y) + shown.width + shown.height);
      const inside = (x: number, y: number) =>
        x >= shown.x - eps && x <= shown.x + shown.width + eps && y >= shown.y - eps && y <= shown.y + shown.height + eps;
      for (const b of boxes) {
        expect(inside(b.x, b.y) && inside(b.x + b.width, b.y + b.height), JSON.stringify({ b, shown })).toBe(true);
      }
      if (boxes.length > 1) for (const w of route) expect(inside(w.x, w.y)).toBe(true);

      const bounds = diagramViewBounds(specs, 16)!;
      const held = fitDiagram(specs, box, { anchor, bounds })!;
      const inBounds = viewportWorldRect(held, box);
      // Along each axis the view stays inside the bounds, or, wider than they are, holds them whole.
      for (const [lo, len] of [['x', 'width'], ['y', 'height']] as const) {
        const [v0, v1, b0, b1] = [inBounds[lo], inBounds[lo] + inBounds[len], bounds[lo], bounds[lo] + bounds[len]];
        if (inBounds[len] <= bounds[len]) {
          seen.count('bounded');
          expect(v0 >= b0 - eps && v1 <= b1 + eps, JSON.stringify({ lo, inBounds, bounds })).toBe(true);
        } else {
          seen.count('holds bounds');
          expect(v0 <= b0 + eps && v1 >= b1 - eps, JSON.stringify({ lo, inBounds, bounds })).toBe(true);
        }
      }
    }), runs(RUNS));
    seen.atLeast('fit', RUNS / 2);
    seen.atLeast('holds bounds', RUNS / 2);
  }, timeoutFor(RUNS, 20));
});
