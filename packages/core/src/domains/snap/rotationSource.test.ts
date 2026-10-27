import { describe, expect, it, vi } from 'vitest';
import type { Scene } from 'core/scene/types';
import { rotationSnapSource } from './rotationSource';
import type { AngleCollect } from './types';

const QUARTERS = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

describe('rotationSnapSource', () => {
  it('reads the other nodes\' rotations once per gesture and scene version, not every frame', () => {
    let version = 1;
    const scene = {
      nodes: new Map([['a', {}], ['b', {}], ['me', {}]]),
      isHidden: () => false,
      getVersion: () => version,
    } as unknown as Scene<unknown, string, unknown>;
    const rotationOf = vi.fn((id: string) => (id === 'a' ? 0.3 : 0.7));
    const q = {
      pivot: { x: 0, y: 0 }, press: { x: 1, y: 0 }, theta0: 0, theta: 0.2, ids: ['me'], exclude: ['me'],
      mods: { suspend: false, constrain: false }, scene, rotationOf,
    } satisfies AngleCollect;
    const source = rotationSnapSource();
    const angles = () => [...source.angles!(q)].map((a) => a.angle);

    expect(angles()).toEqual([...QUARTERS, 0.3, 0.7]);
    expect(angles()).toEqual([...QUARTERS, 0.3, 0.7]);
    expect(rotationOf).toHaveBeenCalledTimes(2);
    version = 2;
    angles();
    expect(rotationOf).toHaveBeenCalledTimes(4);
  });
});
