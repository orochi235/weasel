/**
 * `diagramScene` on random data, ids drawn from the characters its own part ids are spelled with. It builds specs
 * whose ids are all different or refuses the data with its own error, never a scene's id collision later: every node
 * is there once, every edge whose ends are nodes or groups once under `edgeIdOf`, a repeat of one dropped. Shuffling the nodes
 * or the edges changes no spec's id, nor what an edge's spec holds.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScene, type RectPose } from '@weasel-js/core';
import type { DataEdge, DataNode, DiagramData } from './dataTypes';
import { withDiagramRegistry } from './edge';
import { edgeIdOf } from './edgeId';
import { diagramScene } from './fromData';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;

const ID = fc.constantFrom('a', 'b', 'c', 'a/1', 'a/label', 'G', 'G/label', 'a/mark:0', 'e', 'e/label', 'a.b', 'a>b', '__proto__', 'constructor', '');
const nodeArb = (id: string, i: number): fc.Arbitrary<DataNode> => fc.record({
  lines: fc.array(fc.constantFrom('x', 'a longer line'), { minLength: 1, maxLength: 2 }),
  marks: fc.option(fc.constant([{ d: 'M0 0 L1 1' }]), { freq: 4, nil: undefined }),
}).map(({ lines, marks }) => ({ id, lines, at: { x: i * 200, y: 0 }, ...(marks ? { marks } : {}) }));

const dataArb: fc.Arbitrary<DiagramData> = fc.uniqueArray(ID, { minLength: 1, maxLength: 5 }).chain((ids) => fc.record({
  nodes: fc.tuple(...ids.map(nodeArb)),
  edges: fc.array(fc.record({
    from: fc.oneof(fc.constantFrom(...ids), ID),
    to: fc.constantFrom(...ids),
    label: fc.option(fc.constantFrom('L', 'a/b'), { nil: undefined }),
    id: fc.option(fc.constantFrom('e', 'f', 'a', 'edge:a->b'), { freq: 3, nil: undefined }),
  }, { requiredKeys: ['from', 'to'] }).map((e) => Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined)) as unknown as DataEdge), { maxLength: 5 }),
  groups: fc.option(fc.constant([{ id: 'G', members: ids.slice(0, 2), label: 'T' }]), { freq: 3, nil: undefined }),
})).map(({ nodes, edges, groups }) => ({ nodes, edges, ...(groups && !nodes.some((n) => n.id === 'G') ? { groups } : {}) }));

const build = (data: DiagramData) => diagramScene(data, { layout: 'none' });

describe('diagramScene', () => {
  it('names every node and edge once, or refuses the data with its own error', () => {
    const seen = tally();
    fc.assert(fc.property(dataArb, (data) => {
      let specs;
      try {
        specs = build(data);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).not.toBeInstanceOf(TypeError);
        expect((e as Error).message).toMatch(/^diagramScene: /);
        seen.count('refused');
        return;
      }
      seen.count('built');
      const ids = specs.map((s) => String(s.id));
      expect(new Set(ids).size).toBe(ids.length);
      for (const n of data.nodes) expect(ids.filter((id) => id === n.id)).toHaveLength(1);
      const known = new Set([...data.nodes.map((n) => n.id), ...(data.groups ?? []).map((g) => g.id)]);
      const kept = new Set(data.edges.filter((e) => known.has(e.from) && known.has(e.to)).map(edgeIdOf));
      const edgeIds = specs.filter((s) => (s.data as { diagram?: { router?: unknown } }).diagram?.router !== undefined).map((s) => String(s.id));
      expect(new Set(edgeIds)).toEqual(kept);
      if (data.edges.length > kept.size) seen.count('dropped');
      expect(() => createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: specs as never, registry: withDiagramRegistry() })).not.toThrow();
    }), runs(RUNS));
    seen.atLeast('built', RUNS / 4);
    seen.atLeast('refused', RUNS / 10);
    seen.atLeast('dropped', RUNS / 10);
  }, timeoutFor(RUNS, 10));

  it('gives every spec the same id and every edge the same spec in any order of nodes and edges', () => {
    const seen = tally();
    fc.assert(fc.property(dataArb, fc.nat(), (data, seed) => {
      const turn = <T,>(xs: readonly T[]) => xs.map((x, i) => ({ x, k: (i * 7919 + seed) % 97 })).sort((p, q) => p.k - q.k).map(({ x }) => x);
      let specs;
      try { specs = build(data); } catch { return; }
      const again = build({ ...data, nodes: turn(data.nodes), edges: turn(data.edges) });
      seen.count('compared');
      expect(new Set(again.map((s) => s.id))).toEqual(new Set(specs.map((s) => s.id)));
      const edgeSpecs = (xs: typeof specs) => new Map(xs.filter((s) => String(s.id).startsWith('edge:') || data.edges.some((e) => e.id === s.id)).map((s) => [s.id, s]));
      expect(edgeSpecs(again)).toEqual(edgeSpecs(specs));
    }), runs(RUNS));
    seen.atLeast('compared', RUNS / 4);
  }, timeoutFor(RUNS, 20));
});
