/**
 * The live producers run to the end on any graph. `easedProducer` walks every unpinned node from where it stood
 * toward its target, never back, lands on the target exactly on its last frame, and on a graph already at its target
 * moves nothing; `forceProducer` finishes, stays finite, and answers a graph the same way twice.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { NodeId, RectPose } from '@weasel-js/core';
import { graphOf, type Graph, type GraphEdge, type GraphNode } from './graph';
import type { LayoutFn } from './layout';
import { easedProducer, forceProducer } from './liveProducers';
import { anyCoord, coord, nonFinite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

const IDS = ['a', 'b', 'c', 'd', 'e'];

const nodesArb = (c: fc.Arbitrary<number>) => fc.uniqueArray(fc.constantFrom(...IDS), { minLength: 1, maxLength: IDS.length })
  .chain((ids) => fc.tuple(...ids.map((id) => fc.record({ x: c, y: c, w: fc.integer({ min: 0, max: 80 }), h: fc.integer({ min: 0, max: 40 }) })
    .map(({ x, y, w, h }): GraphNode => ({ id, bounds: { x, y, width: w, height: h }, pinned: false })))));

const graphArb = (c: fc.Arbitrary<number>): fc.Arbitrary<Graph> => nodesArb(c).chain((nodes) => fc.tuple(
  fc.constant(nodes),
  fc.array(fc.tuple(fc.constantFrom(...nodes.map((n) => n.id)), fc.constantFrom(...nodes.map((n) => n.id))), { maxLength: 6 }),
)).map(([nodes, ends]) => graphOf(nodes, ends.map(([from, to], i): GraphEdge => ({ id: `e${i}`, from, to }))));

/** A layout answering `targets` for whichever of its nodes it names. */
const fixed = (targets: ReadonlyMap<string, { x: number; y: number }>): LayoutFn => () => targets;

const easedCase = (c: fc.Arbitrary<number>) => graphArb(c).chain((graph) => fc.record({
  graph: fc.constant(graph),
  targets: fc.tuple(...graph.nodes.map((n) => fc.option(fc.record({ x: c, y: c }), { freq: 4 }).map((t) => [n.id, t] as const)))
    .map((pairs) => new Map(pairs.flatMap(([id, t]) => (t === null ? [] : [[id, t] as const])))),
  pinned: fc.subarray(graph.nodes.map((n) => n.id)),
  frames: fc.integer({ min: 1, max: 30 }),
}));

const between = (v: number, a: number, b: number) => v >= Math.min(a, b) && v <= Math.max(a, b);

describe('easedProducer', () => {
  it.each([['grid', coord], ['any size', anyCoord]] as const)('walks each node toward its target and lands on it, %s', (_, c) => {
    const seen = tally();
    fc.assert(fc.property(easedCase(c), ({ graph, targets, pinned, frames }) => {
      const pins = new Map(pinned.map((id) => [id as NodeId, { x: 0, y: 0, width: 1, height: 1 } as RectPose]));
      const produce = easedProducer<RectPose>(graph, fixed(targets), { frames });
      const start = new Map(graph.nodes.map((n) => [n.id, n.bounds]));
      let last = new Map(graph.nodes.map((n) => [n.id, { x: n.bounds.x, y: n.bounds.y }]));
      for (let frame = 0; frame < frames; frame++) {
        const { result, done } = produce({ pinned: pins, frame });
        expect(done).toBe(frame === frames - 1);
        expect(nonFinite([...result.values()])).toEqual([]);
        for (const id of pinned) expect(result.has(id)).toBe(false);
        for (const [id, at] of result) {
          const to = targets.get(id)!;
          const was = last.get(id)!;
          expect(between(at.x, was.x, to.x) && between(at.y, was.y, to.y)).toBe(true);
          last.set(id, at);
        }
        if (done) {
          for (const [id, to] of targets) {
            if (pins.has(id as NodeId)) continue;
            seen.count('landed');
            expect(result.get(id)).toEqual(to);
            if (start.get(id)!.x !== to.x) seen.count('moved');
          }
        }
      }
    }), runs(RUNS));
    seen.atLeast('landed', RUNS);
    seen.atLeast('moved', RUNS / 2);
  }, timeoutFor(RUNS, 2));

  it('moves nothing on a graph that already stands at its target', () => {
    fc.assert(fc.property(graphArb(anyCoord), fc.integer({ min: 1, max: 30 }), fc.integer({ min: 0, max: 40 }), (graph, frames, frame) => {
      const here = new Map(graph.nodes.map((n) => [n.id, { x: n.bounds.x, y: n.bounds.y }]));
      const { result } = easedProducer<RectPose>(graph, fixed(here), { frames })({ pinned: new Map(), frame });
      expect(result).toEqual(here);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('forceProducer', () => {
  const FORCE_RUNS = 40;
  it('finishes finite, and answers the same graph the same way twice', () => {
    const seen = tally();
    fc.assert(fc.property(graphArb(coord), (graph) => {
      const play = () => {
        const produce = forceProducer<RectPose>(graph);
        const frames: [string, { x: number; y: number }][][] = [];
        for (let frame = 0; frame < 2000; frame++) {
          const { result, done } = produce({ pinned: new Map(), frame });
          frames.push([...result]);
          if (done) return frames;
        }
        throw new Error('the run never finished');
      };
      const once = play();
      seen.count(once.length > 5 ? 'ran' : 'short');
      expect(nonFinite(once)).toEqual([]);
      expect(play()).toEqual(once);
    }), runs(FORCE_RUNS));
    seen.atLeast('ran', FORCE_RUNS / 4);
  }, timeoutFor(FORCE_RUNS, 100));
});
