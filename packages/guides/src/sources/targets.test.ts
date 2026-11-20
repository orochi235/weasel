import { describe, expect, it } from 'vitest';
import type { Bounds, SnapCollect } from '@weasel-js/core';
import { cachedPerScene } from './targets';
import { sceneOf } from './testing/session';

describe('cachedPerScene', () => {
  const { scene } = sceneOf([{ x: 0, y: 0, width: 10, height: 10 }]);
  const query = (pad: number): SnapCollect => ({
    exclude: [], scene, drawnBox: (): Bounds => ({ x: -pad, y: -pad, width: 10 + 2 * pad, height: 10 + 2 * pad }),
  } as unknown as SnapCollect);

  it('keeps its value while one session asks, with the scene unchanged', () => {
    const derive = (boxes: readonly Bounds[]) => boxes.map((b) => b.x);
    const cached = cachedPerScene(derive);
    const q = query(1);
    const first = cached(q);
    expect(cached(q)).toBe(first);
  });

  it('measures again for a session whose boxes are measured otherwise, as after a zoom', () => {
    const cached = cachedPerScene((boxes) => boxes.map((b) => b.x));
    expect(cached(query(5))).toEqual([-5]);
    expect(cached(query(50))).toEqual([-50]);
  });
});
