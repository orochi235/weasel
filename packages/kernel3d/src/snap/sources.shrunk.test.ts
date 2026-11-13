/** Counterexamples `sources.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import type { SnapCollect } from '@weasel-js/core';
import type { Vec3 } from '@weasel-js/geom/3d';
import { groundGridSource } from './sources';

const at = (p: Vec3) => ({ gesture: 'point', probes: [{ id: 'p', at: p, role: 'pointer' }], delta0: { x: 0, y: 0, z: 0 }, exclude: [], reachWorld: (px: number) => px, reachPx: 1 }) as unknown as SnapCollect<Vec3>;

describe('groundGridSource (shrunk)', () => {
  it('offers no line along an axis where lines a step apart are one number', () => {
    const lines = [...groundGridSource({ world: {}, step: 0.001 }).collect(at({ x: 0, y: 0, z: 17592186044416 }))];
    expect(lines.map((l) => (l.locus.at as Vec3).x)).toEqual([0, 0.001]);
  });

  it('offers no line of NaN for a subnormal step', () => {
    expect([...groundGridSource({ world: {}, step: 5e-324 }).collect(at({ x: 1, y: 0, z: 2 }))]).toEqual([]);
  });
});
