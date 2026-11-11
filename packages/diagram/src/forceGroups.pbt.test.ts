/**
 * The group forces of the force layout, one tick at a time on random bodies and groups, nested through `nestGroups`.
 * Cohesion pulls each member straight at its group's centroid and moves no group's center of mass; separation never
 * pushes a group against one it holds, leaves boxes already clear alone, and one tick's push, taken as a move, clears
 * two overlapping groups, or a group and one outsider.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { insetOf } from './cluster';
import type { ForceBody } from './force';
import { groupCohesion, separateGroups } from './forceGroups';
import type { GraphGroup } from './graph';
import { nestGroups } from './groupTree';
import { nonFinite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
const GROUP_IDS = ['G', 'H', 'I'];

const bodiesArb = fc.tuple(...IDS.map((id) => fc.record({
  x: fc.integer({ min: -20, max: 20 }).map((n) => n * 10),
  y: fc.integer({ min: -20, max: 20 }).map((n) => n * 10),
  hw: fc.integer({ min: 0, max: 40 }),
  hh: fc.integer({ min: 0, max: 40 }),
}).map((b): ForceBody => ({ id, ...b, vx: 0, vy: 0 }))));

const insetArb = fc.oneof(fc.constant(12), fc.integer({ min: 0, max: 20 }), fc.record({
  top: fc.nat(20), right: fc.nat(20), bottom: fc.nat(20), left: fc.nat(20),
}));

const groupsArb: fc.Arbitrary<GraphGroup[]> = fc.tuple(
  fc.tuple(...GROUP_IDS.map(() => fc.subarray([...IDS, ...GROUP_IDS], { maxLength: 4 }))),
  fc.tuple(...GROUP_IDS.map(() => insetArb)),
).map(([members, insets]) => nestGroups(GROUP_IDS.map((id, i) => ({ id, members: members[i]! })), (id) => IDS.includes(id))
  .map((g): GraphGroup => ({ id: g.id, members: g.members, inset: insetOf(insets[GROUP_IDS.indexOf(g.id)]), ...(g.parent ? { parent: g.parent } : {}) })));

const byIdOf = (bodies: readonly ForceBody[]) => new Map(bodies.map((b) => [b.id, b]));

interface Box { x0: number; y0: number; x1: number; y1: number }
function boxOf(g: GraphGroup, byId: ReadonlyMap<string, ForceBody>, groups: readonly GraphGroup[]): Box {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const id of g.members) {
    const b = byId.get(id)!;
    x0 = Math.min(x0, b.x - b.hw); y0 = Math.min(y0, b.y - b.hh); x1 = Math.max(x1, b.x + b.hw); y1 = Math.max(y1, b.y + b.hh);
  }
  for (const child of groups.filter((c) => c.parent === g.id)) {
    const b = boxOf(child, byId, groups);
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
const holds = (outer: GraphGroup, inner: GraphGroup, groups: readonly GraphGroup[]): boolean => {
  for (let at = inner.parent; at !== undefined; at = groups.find((g) => g.id === at)?.parent) if (at === outer.id) return true;
  return false;
};
/** Each body moved by its velocity, as the integrator would. */
const stepped = (bodies: readonly ForceBody[]) => bodies.map((b) => ({ ...b, x: b.x + b.vx!, y: b.y + b.vy!, vx: 0, vy: 0 }));

describe('groupCohesion', () => {
  it('pulls each member at its group\'s centroid and moves no group\'s center of mass', () => {
    const seen = tally();
    fc.assert(fc.property(bodiesArb, groupsArb, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (bodies, groups, strength, alpha) => {
      for (const g of groups) {
        const fresh = bodies.map((b) => ({ ...b }));
        const byId = byIdOf(fresh);
        groupCohesion([g], byId, strength)(alpha);
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
        seen.count('group');
      }
    }), runs(RUNS));
    seen.atLeast('group', RUNS);
  }, timeoutFor(RUNS, 1));
});

describe('separateGroups', () => {
  it('leaves clear boxes alone and never pushes a group against one it holds', () => {
    const seen = tally();
    fc.assert(fc.property(bodiesArb, groupsArb, fc.nat(20), (drawn, groups, padding) => {
      const bodies = drawn.map((b) => ({ ...b }));
      const byId = byIdOf(bodies);
      separateGroups(groups, bodies, byId, padding)(1);
      expect(nonFinite(bodies)).toEqual([]);
      const reset = bodies.map((b) => ({ ...b, vx: 0, vy: 0 }));
      const byReset = byIdOf(reset);
      const boxes = groups.map((g) => boxOf(g, byReset, groups));
      const allClear = groups.every((g, i) => groups.every((h, j) => i === j || holds(g, h, groups) || holds(h, g, groups) || clear(boxes[i]!, boxes[j]!, padding))
        && reset.every((b) => g.members.includes(b.id) || clear(boxes[i]!, bodyBox(b), padding)));
      if (allClear) {
        seen.count('clear');
        expect(bodies.every((b) => b.vx === 0 && b.vy === 0)).toBe(true);
      } else seen.count('overlap');
      for (const g of groups) {
        for (const h of groups) {
          if (g === h || !holds(g, h, groups)) continue;
          const pair = reset.map((b) => ({ ...b }));
          const chain = groups.filter((k) => k === g || k === h || (holds(g, k, groups) && holds(k, h, groups)));
          separateGroups(chain, [], byIdOf(pair), padding)(1);
          expect(pair.every((b) => b.vx === 0 && b.vy === 0)).toBe(true);
          seen.count('nested');
        }
      }
    }), runs(RUNS));
    seen.atLeast('clear', RUNS / 20);
    seen.atLeast('overlap', RUNS / 4);
    seen.atLeast('nested', RUNS / 10);
  }, timeoutFor(RUNS, 1));

  it('clears two sibling groups, or a group and one outsider, in one tick taken as a move', () => {
    const seen = tally();
    fc.assert(fc.property(bodiesArb, groupsArb, fc.nat(20), (bodies, groups, padding) => {
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i]!;
        for (const h of groups.slice(i + 1)) {
          if (holds(g, h, groups) || holds(h, g, groups) || g.members.some((m) => h.members.includes(m))) continue;
          const pair = bodies.map((b) => ({ ...b }));
          const nest = [g, h];
          const was = byIdOf(pair);
          if (clear(boxOf(g, was, nest), boxOf(h, was, nest), padding)) continue;
          separateGroups([g, h], [], was, padding)(1);
          const after = byIdOf(stepped(pair));
          seen.count('groups');
          expect(clear(boxOf(g, after, nest), boxOf(h, after, nest), padding)).toBe(true);
        }
        for (const outsider of bodies) {
          if (g.members.includes(outsider.id)) continue;
          const nest = [g];
          const fresh = bodies.map((b) => ({ ...b }));
          const was = byIdOf(fresh);
          const o = was.get(outsider.id)!;
          if (clear(boxOf(g, was, nest), bodyBox(o), padding)) continue;
          separateGroups([g], [o], was, padding)(1);
          const after = byIdOf(stepped(fresh));
          seen.count('outsider');
          expect(clear(boxOf(g, after, nest), bodyBox(after.get(o.id)!), padding)).toBe(true);
        }
      }
    }), runs(RUNS));
    seen.atLeast('groups', RUNS / 10);
    seen.atLeast('outsider', RUNS / 2);
  }, timeoutFor(RUNS, 2));
});
