/**
 * The cluster forces of the force layout, one tick at a time on random bodies and clusters, nested through `nestClusters`.
 * Cohesion pulls each member straight at its cluster's centroid and moves no cluster's center of mass; separation never
 * pushes a cluster against one it holds, leaves boxes already clear alone, and one tick's push, taken as a move, clears
 * two overlapping clusters, or a cluster and one outsider.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { insetOf } from './cluster';
import type { ForceBody } from './force';
import { clusterCohesion, separateClusters } from './forceClusters';
import type { GraphCluster } from './graph';
import { nestClusters } from './clusterTree';
import { nonFinite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const CLUSTER_IDS = ['G', 'H', 'I'];

const bodiesArb = fc.tuple(...IDS.map((id) => fc.record({
  x: fc.integer({ min: -20, max: 20 }).map((n) => n * 10),
  y: fc.integer({ min: -20, max: 20 }).map((n) => n * 10),
  hw: fc.integer({ min: 0, max: 40 }),
  hh: fc.integer({ min: 0, max: 40 }),
}).map((b): ForceBody => ({ id, ...b, vx: 0, vy: 0 }))));

const insetArb = fc.oneof(fc.constant(12), fc.integer({ min: 0, max: 20 }), fc.record({
  top: fc.nat(20), right: fc.nat(20), bottom: fc.nat(20), left: fc.nat(20),
}));

const clustersArb: fc.Arbitrary<GraphCluster[]> = fc.tuple(
  fc.tuple(...CLUSTER_IDS.map(() => fc.subarray([...IDS, ...CLUSTER_IDS], { maxLength: 4 }))),
  fc.tuple(...CLUSTER_IDS.map(() => insetArb)),
).map(([members, insets]) => nestClusters(CLUSTER_IDS.map((id, i) => ({ id, members: members[i]! })), (id) => IDS.includes(id))
  .map((g): GraphCluster => ({ id: g.id, members: g.members, inset: insetOf(insets[CLUSTER_IDS.indexOf(g.id)]), ...(g.parent ? { parent: g.parent } : {}) })));

const byIdOf = (bodies: readonly ForceBody[]) => new Map(bodies.map((b) => [b.id, b]));

interface Box { x0: number; y0: number; x1: number; y1: number }
function boxOf(g: GraphCluster, byId: ReadonlyMap<string, ForceBody>, clusters: readonly GraphCluster[]): Box {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const id of g.members) {
    const b = byId.get(id)!;
    x0 = Math.min(x0, b.x - b.hw); y0 = Math.min(y0, b.y - b.hh); x1 = Math.max(x1, b.x + b.hw); y1 = Math.max(y1, b.y + b.hh);
  }
  for (const child of clusters.filter((c) => c.parent === g.id)) {
    const b = boxOf(child, byId, clusters);
    x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
  }
  return { x0: x0 - g.inset.left, y0: y0 - g.inset.top, x1: x1 + g.inset.right, y1: y1 + g.inset.bottom };
}
const bodyBox = (b: ForceBody): Box => ({ x0: b.x - b.hw, y0: b.y - b.hh, x1: b.x + b.hw, y1: b.y + b.hh });
/** Whether `a` and `b` stand at least `padding` apart on some axis, within rounding. */
const clear = (a: Box, b: Box, padding: number) => {
  const reach = (a0: number, a1: number, b0: number, b1: number) => (a1 - a0 + b1 - b0 - Math.abs(b0 + b1 - a0 - a1)) / 2 + padding;
  return reach(a.x0, a.x1, b.x0, b.x1) <= 1e-9 || reach(a.y0, a.y1, b.y0, b.y1) <= 1e-9;
};
const holds = (outer: GraphCluster, inner: GraphCluster, clusters: readonly GraphCluster[]): boolean => {
  for (let at = inner.parent; at !== undefined; at = clusters.find((g) => g.id === at)?.parent) if (at === outer.id) return true;
  return false;
};
/** Each body moved by its velocity, as the integrator would. */
const stepped = (bodies: readonly ForceBody[]) => bodies.map((b) => ({ ...b, x: b.x + b.vx!, y: b.y + b.vy!, vx: 0, vy: 0 }));

describe('clusterCohesion', () => {
  it('pulls each member at its cluster\'s centroid and moves no cluster\'s center of mass', () => {
    const seen = tally();
    fc.assert(fc.property(bodiesArb, clustersArb, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (bodies, clusters, strength, alpha) => {
      for (const g of clusters) {
        const fresh = bodies.map((b) => ({ ...b }));
        const byId = byIdOf(fresh);
        clusterCohesion([g], byId, strength)(alpha);
        const members = g.members.map((id) => byId.get(id)!);
        const cx = members.reduce((s, m) => s + m.x, 0) / members.length;
        const cy = members.reduce((s, m) => s + m.y, 0) / members.length;
        const scale = strength * alpha;
        for (const m of members) {
          expect(m.vx).toBeCloseTo((cx - m.x) * scale, 9);
          expect(m.vy).toBeCloseTo((cy - m.y) * scale, 9);
        }
        expect(members.reduce((s, m) => s + m.vx!, 0)).toBeCloseTo(0, 6);
        expect(members.reduce((s, m) => s + m.vy!, 0)).toBeCloseTo(0, 6);
        for (const b of fresh) if (!g.members.includes(b.id)) expect([b.vx, b.vy]).toEqual([0, 0]);
        seen.count('cluster');
      }
    }), runs(RUNS));
    seen.atLeast('cluster', RUNS);
  }, timeoutFor(RUNS, 1));
});

describe('separateClusters', () => {
  it('leaves clear boxes alone and never pushes a cluster against one it holds', () => {
    const seen = tally();
    fc.assert(fc.property(bodiesArb, clustersArb, fc.nat(20), (drawn, clusters, padding) => {
      const bodies = drawn.map((b) => ({ ...b }));
      const byId = byIdOf(bodies);
      separateClusters(clusters, bodies, byId, padding)(1);
      expect(nonFinite(bodies)).toEqual([]);
      const reset = bodies.map((b) => ({ ...b, vx: 0, vy: 0 }));
      const byReset = byIdOf(reset);
      const boxes = clusters.map((g) => boxOf(g, byReset, clusters));
      const allClear = clusters.every((g, i) => clusters.every((h, j) => i === j || holds(g, h, clusters) || holds(h, g, clusters) || clear(boxes[i]!, boxes[j]!, padding))
        && reset.every((b) => g.members.includes(b.id) || clear(boxes[i]!, bodyBox(b), padding)));
      if (allClear) {
        seen.count('clear');
        expect(bodies.every((b) => b.vx === 0 && b.vy === 0)).toBe(true);
      } else seen.count('overlap');
      for (const g of clusters) {
        for (const h of clusters) {
          if (g === h || !holds(g, h, clusters)) continue;
          const pair = reset.map((b) => ({ ...b }));
          const chain = clusters.filter((k) => k === g || k === h || (holds(g, k, clusters) && holds(k, h, clusters)));
          separateClusters(chain, [], byIdOf(pair), padding)(1);
          expect(pair.every((b) => b.vx === 0 && b.vy === 0)).toBe(true);
          seen.count('nested');
        }
      }
    }), runs(RUNS));
    seen.atLeast('clear', RUNS / 20);
    seen.atLeast('overlap', RUNS / 4);
    seen.atLeast('nested', RUNS / 10);
  }, timeoutFor(RUNS, 1));

  it('clears two sibling clusters, or a cluster and one outsider, in one tick taken as a move', () => {
    const seen = tally();
    fc.assert(fc.property(bodiesArb, clustersArb, fc.nat(20), (bodies, clusters, padding) => {
      for (let i = 0; i < clusters.length; i++) {
        const g = clusters[i]!;
        for (const h of clusters.slice(i + 1)) {
          if (holds(g, h, clusters) || holds(h, g, clusters) || g.members.some((m) => h.members.includes(m))) continue;
          const pair = bodies.map((b) => ({ ...b }));
          const nest = [g, h];
          const was = byIdOf(pair);
          if (clear(boxOf(g, was, nest), boxOf(h, was, nest), padding)) continue;
          separateClusters([g, h], [], was, padding)(1);
          const after = byIdOf(stepped(pair));
          seen.count('clusters');
          expect(clear(boxOf(g, after, nest), boxOf(h, after, nest), padding)).toBe(true);
        }
        for (const outsider of bodies) {
          if (g.members.includes(outsider.id)) continue;
          const nest = [g];
          const fresh = bodies.map((b) => ({ ...b }));
          const was = byIdOf(fresh);
          const o = was.get(outsider.id)!;
          if (clear(boxOf(g, was, nest), bodyBox(o), padding)) continue;
          separateClusters([g], [o], was, padding)(1);
          const after = byIdOf(stepped(fresh));
          seen.count('outsider');
          expect(clear(boxOf(g, after, nest), bodyBox(after.get(o.id)!), padding)).toBe(true);
        }
      }
    }), runs(RUNS));
    seen.atLeast('clusters', RUNS / 10);
    seen.atLeast('outsider', RUNS / 2);
  }, timeoutFor(RUNS, 2));
});
