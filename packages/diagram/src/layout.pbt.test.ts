/**
 * The layouts on any small graph, edges and pins included: each answers finite positions for nodes it may move,
 * never moves a pinned node, keeps the boxes of a layout that promises it apart, and moves nothing on a second run.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { chain } from './chain';
import { grid } from './grid';
import { graphOf as buildGraphOf } from './graph';
import { layered, layeredPlan } from './layered';
import type { LayoutDirection, LayoutFn, LayoutOptions } from './layout';
import { at, graphOf, moved, type Box } from './layoutFixture';
import { nonFinite, runs, tally, timeoutFor } from './pbt.fixture';
import { radial } from './radial';
import { tree } from './tree';

const RUNS = 150;

interface Spec {
  boxes: Record<string, Box>;
  edges: [string, string][];
  pins: string[];
  direction: LayoutDirection;
}

const spec: fc.Arbitrary<Spec> = fc.integer({ min: 1, max: 8 }).chain((n) => {
  const ids = Array.from({ length: n }, (_, k) => `n${k}`);
  return fc.record({
    boxes: fc.tuple(...ids.map(() => fc.tuple(
      fc.integer({ min: -40, max: 40 }).map((v) => v * 10), fc.integer({ min: -40, max: 40 }).map((v) => v * 10),
      fc.integer({ min: 2, max: 15 }).map((v) => v * 10), fc.integer({ min: 2, max: 8 }).map((v) => v * 10),
    ))).map((bs) => Object.fromEntries(bs.map((b, k) => [ids[k]!, b as Box]))),
    edges: fc.array(fc.tuple(fc.constantFrom(...ids), fc.constantFrom(...ids)), { maxLength: 10 }),
    pins: fc.subarray(ids, { maxLength: Math.min(2, n) }),
    direction: fc.constantFrom<LayoutDirection>('down', 'up', 'right', 'left'),
  });
});

/** Layouts, and whether each keeps every box clear of every other. */
const LAYOUTS: [string, LayoutFn, boolean][] = [
  ['layered', layered, true],
  ['tree', tree, true],
  ['grid', grid, true],
  ['radial', radial, false],
  ['chain', chain, false],
];

const overlap = (a: Box, b: Box) =>
  a[0] < b[0] + b[2]! - 1e-6 && b[0] < a[0] + a[2]! - 1e-6 && a[1] < b[1] + b[3]! - 1e-6 && b[1] < a[1] + a[3]! - 1e-6;

describe.each(LAYOUTS)('%s', (_name, layout, apart) => {
  it('places movable nodes at finite points, leaves pins, and moves nothing on a second run', () => {
    const seen = tally();
    fc.assert(fc.property(spec, ({ boxes, edges, pins, direction }) => {
      const opts: LayoutOptions = { direction };
      const first = layout(graphOf(boxes, edges, pins), opts);
      expect(nonFinite([...first.values()])).toEqual([]);
      for (const id of first.keys()) {
        expect(boxes[id]).toBeDefined();
        expect(pins).not.toContain(id);
      }
      if (first.size > 0) seen.count('moved');
      const after = moved(boxes, first);
      if (apart && pins.length === 0) {
        const ids = Object.keys(after);
        for (const a of ids) for (const b of ids) if (a < b) expect(overlap(after[a]!, after[b]!), `${a} ${b} ${JSON.stringify(after)}`).toBe(false);
      }
      // A re-run reads the routes the first one laid out, as a scene holding them does.
      const routes = layout === layered ? layeredPlan(graphOf(boxes, edges, pins), opts).waypoints : new Map<string, never>();
      const bare = graphOf(after, edges, pins);
      const next = buildGraphOf([...bare.nodes], bare.edges.map((e) => {
        const w = routes.get(e.id);
        return w === undefined ? e : { ...e, waypoints: w };
      }), [...(bare.groups ?? [])]);
      const second = layout(next, opts);
      expect([...second].map(([id, p]) => [id, p, at(after, new Map(), id)])).toEqual([]);
    }), runs(RUNS));
    seen.atLeast('moved', RUNS / 4);
  }, timeoutFor(RUNS, 20));
});
