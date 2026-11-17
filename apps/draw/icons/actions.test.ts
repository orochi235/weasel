import { describe, expect, it } from 'vitest';
import { ACTIONS } from './actions.mjs';

const nums = (s: string) => s.trim().split(/[\s,]+/).map(Number);

describe('draw:rotation', () => {
  it('carries its head on a straight run that leaves the arc, pointing the way the run travels', () => {
    const d = [...ACTIONS.rotation.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]!);
    const shaft = d[0]!.match(/^M([^A]+)A([^L]+)L(.+)$/);
    expect(shaft, d[0]).not.toBeNull();
    const [ax, ay] = nums(shaft![2]!).slice(5);
    const [runX, runY] = nums(shaft![3]!);
    const run = [runX! - ax!, runY! - ay!];
    expect(run[0] === 0 || run[1] === 0, 'run on an axis').toBe(true);

    const [b1x, b1y, tipX, tipY, b2x, b2y] = nums(d[1]!.replace(/[ML]/g, ' '));
    expect([tipX, tipY]).toEqual([runX, runY]);
    // Both barbs trail back against the run's direction.
    const back = (bx: number, by: number) => (bx - tipX!) * run[0]! + (by - tipY!) * run[1]!;
    expect(back(b1x!, b1y!)).toBeLessThan(0);
    expect(back(b2x!, b2y!)).toBeLessThan(0);
  });
});
