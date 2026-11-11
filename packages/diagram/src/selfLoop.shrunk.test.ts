/** Counterexamples `selfLoop.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { selfLoop } from './selfLoop';
import type { Port } from './types';

const port = (id: string, x: number, y: number, normal: Port['normal']): Port => ({ id, nodeId: 'n', point: { x, y }, normal });

describe('selfLoop, shrunk', () => {
  it('takes the same corner of a box with no east side however its ports are listed', () => {
    const ports = [port('w', 0, 0.5, { x: -1, y: 0 }), port('s', 0.5, 1, { x: 0, y: 1 }), port('n', 0.5, 0, { x: 0, y: -1 })];
    const ids = (ps: Port[]) => { const l = selfLoop(ps, 0)!; return [l.from.id, l.to.id]; };
    expect(ids(ports)).toEqual(['n', 'w']);
    expect(ids([...ports].reverse())).toEqual(['n', 'w']);
  });
});
