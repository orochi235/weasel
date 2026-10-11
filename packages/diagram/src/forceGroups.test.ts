import { describe, it, expect } from 'vitest';
import { insetOf } from './cluster';
import type { ForceBody } from './force';
import { separateGroups } from './forceGroups';
import type { GraphGroup } from './graph';

const body = (id: string, x: number, y = 0): ForceBody => ({ id, x, y, hw: 10, hh: 10, vx: 0, vy: 0 });

/** `p` in P, P and `s` in System, and an outsider `o`. Insets are 12, so P's
 *  box reaches 22 from `p` and System's a further 12 beyond that. */
function run(at: { p: number; s: number; o: number }) {
  const bodies = [body('p', at.p), body('s', at.s), body('o', at.o)];
  const groups: GraphGroup[] = [
    { id: 'System', members: ['p', 's'], inset: insetOf(12) },
    { id: 'P', members: ['p'], inset: insetOf(12), parent: 'System' },
  ];
  separateGroups(groups, bodies, new Map(bodies.map((b) => [b.id, b])), 0)(1);
  expect(bodies.map((b) => b.vy)).toEqual([0, 0, 0]);
  return Object.fromEntries(bodies.map((b) => [b.id, b.vx]));
}

describe('separateGroups with a group inside a group', () => {
  it('does not push a group away from the group that holds it', () => {
    expect(run({ p: 0, s: 100, o: 1000 })).toEqual({ p: 0, s: 0, o: 0 });
  });

  it('pushes the outer group\'s own node out of the inner box', () => {
    const v = run({ p: 0, s: 25, o: 1000 });
    expect(v.s).toBeGreaterThan(0);
    expect(v.p).toBeLessThan(0);
  });

  it('measures the outer box around the inner box, not around its nodes', () => {
    // `o` is 40 left of `p`: clear of p's box grown by one inset (reach 22,
    // o's edge at 30), inside it grown by both (reach 34).
    const v = run({ p: 0, s: 100, o: -40 });
    expect(v.o).toBeLessThan(0);
  });
});
