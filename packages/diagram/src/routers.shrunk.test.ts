/** Counterexamples `routers.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { nonFinite } from './pbt.fixture';
import { bezier, orthogonal } from './routers';
import type { Port } from './types';

const M = Number.MAX_VALUE;
const at = (x: number, y: number, normal: Port['normal']): Port => ({ id: 'p', nodeId: 'n', point: { x, y }, normal });

describe('routers near the double range', () => {
  it('orthogonal turns halfway between two far ends without overflowing', () => {
    const out = orthogonal({ from: at(M, 0, { x: 1, y: 0 }), to: at(1e300, 10, { x: -1, y: 0 }), waypoints: [] });
    expect(nonFinite(out)).toEqual([]);
    expect(out[1]!.x).toBe(M / 2 + 5e299);
  });

  it('bezier stays finite on a leg whose length passes the double range', () => {
    const out = bezier({
      from: at(0, 0, { x: 1, y: 0 }), to: at(M, -M, { x: -Math.SQRT1_2, y: Math.SQRT1_2 }), waypoints: [{ x: -M, y: 0 }],
    });
    expect(nonFinite(out)).toEqual([]);
  });

  it('bezier stays finite past a waypoint far out', () => {
    const out = bezier({
      from: at(0, 0, { x: 1, y: 0 }), to: at(0, 0, { x: Math.SQRT1_2, y: Math.SQRT1_2 }), waypoints: [{ x: 1e300, y: 0 }],
    });
    expect(nonFinite(out)).toEqual([]);
  });

  it('bezier stays finite where the leg reach divides one overflow by another', () => {
    const out = bezier({
      from: at(0, 1e300, { x: Math.SQRT1_2, y: Math.SQRT1_2 }), to: at(-M, 0, { x: 1, y: 0 }),
      waypoints: [{ x: 1e300, y: -1e300 }, { x: 0, y: -3.280811678258314e300 }],
    });
    expect(nonFinite(out)).toEqual([]);
  });
});
