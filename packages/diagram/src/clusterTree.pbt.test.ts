/**
 * `nestClusters` on any declaration, members naming nodes, clusters, themselves, each other in cycles, and ids that are
 * neither: the result is a forest whose clusters each hold a node, a node sits directly in the first cluster naming it,
 * and a cluster's members are its direct nodes and its direct clusters' members, in order.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { nestClusters, type DeclaredCluster } from './clusterTree';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;

const NODES = ['a', 'b', 'c', 'd', 'e'];
const CLUSTERS = ['G', 'H', 'I', 'J', 'K', '__proto__', 'constructor'];
const id = fc.constantFrom(...NODES, ...CLUSTERS, 'x', 'toString');

const declared: fc.Arbitrary<DeclaredCluster[]> = fc.uniqueArray(fc.constantFrom(...CLUSTERS), { maxLength: CLUSTERS.length })
  .chain((ids) => fc.tuple(...ids.map((g) => fc.array(id, { maxLength: 5 }).map((members) => ({ id: g, members })))));

const isNode = (s: string) => NODES.includes(s);

describe('nestClusters', () => {
  it('settles a forest of clusters each holding a node, every node in the first cluster naming it', () => {
    const seen = tally();
    fc.assert(fc.property(declared, (clusters) => {
      const out = nestClusters(clusters, isNode);
      const byId = new Map(out.map((g) => [g.id, g]));
      expect(byId.size).toBe(out.length);
      const order = clusters.map((g) => g.id);
      expect(out.map((g) => g.id)).toEqual(order.filter((g) => byId.has(g)));
      if (out.some((g) => g.parent !== undefined)) seen.count('nested');
      if (out.length < clusters.length) seen.count('dropped');

      const placed = new Map<string, string>();
      for (const g of out) {
        const named = clusters.find((d) => d.id === g.id)!.members;
        expect(g.members.length).toBeGreaterThan(0);
        for (const m of g.direct) {
          expect(named).toContain(m);
          expect(isNode(m) || byId.has(m)).toBe(true);
          expect(placed.has(m)).toBe(false);
          placed.set(m, g.id);
        }
        expect(g.members).toEqual(g.direct.flatMap((m) => (isNode(m) ? [m] : byId.get(m)!.members)));
      }
      for (const g of out) {
        expect(g.parent).toBe(placed.get(g.id));
        const chain = new Set<string>();
        for (let at: string | undefined = g.id; at !== undefined; at = byId.get(at)!.parent) {
          expect(chain.has(at)).toBe(false);
          chain.add(at);
        }
      }
      for (const n of NODES) {
        const first = clusters.find((d) => d.members.includes(n));
        expect(placed.get(n)).toBe(first?.id);
      }
      for (const d of clusters) {
        const claims = d.members.some((m) => isNode(m) && clusters.find((e) => e.members.includes(m)) === d);
        if (claims) expect(byId.has(d.id)).toBe(true);
      }
    }), runs(RUNS));
    seen.atLeast('nested', RUNS / 10);
    seen.atLeast('dropped', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});
