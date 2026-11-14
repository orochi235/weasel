import { describe, expect, it } from 'vitest';
import { reviveSnapshot } from './persistence';

describe('a drawing saved before the path effect and warp renames', () => {
  it('reopens a blend as a tween and each old warp under its new kind', () => {
    const saved = {
      nodes: [
        { id: 'fx', data: { pathEffect: { kind: 'blend', steps: 3 } } },
        { id: 'a', data: { warp: { id: 'w', warp: { kind: 'puppet', pins: [] } } } },
        { id: 'b', data: { warp: { id: 'v', warp: { kind: 'distort', mode: 'free' } } } },
        { id: 'c', data: { warp: { id: 'u', warp: { kind: 'envelope', mapping: 'bicubic' } } } },
      ],
    };
    expect(reviveSnapshot(saved).nodes.map((n) => n.data)).toEqual([
      { pathEffect: { kind: 'tween', steps: 3 } },
      { warp: { id: 'w', warp: { kind: 'pin', pins: [] } } },
      { warp: { id: 'v', warp: { kind: 'plane', mode: 'free' } } },
      { warp: { id: 'u', warp: { kind: 'cloth', mapping: 'bicubic' } } },
    ]);
  });

  it('leaves a paint blend mode and a node kind alone', () => {
    const saved = { nodes: [{ id: 'x', kind: 'blend', data: { blendMode: 'multiply', fill: { paint: { color: '#000' } } } }] };
    expect(reviveSnapshot(structuredClone(saved))).toEqual(saved);
  });
});
