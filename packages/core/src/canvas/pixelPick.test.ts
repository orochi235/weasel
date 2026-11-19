import { describe, it, expect } from 'vitest';
import type { IdBuffer } from '@weasel-js/renderer';
import { pixelPickEvery } from './pixelPick';
import type { ScenePickIds } from './scenePickIds';

const names: Record<number, string> = { 1: 'back', 2: 'front' };
const ids = { idOfPickId: (n: number) => names[n] ?? null } as unknown as ScenePickIds;
const order: Record<string, number> = { back: 0, front: 1 };

describe('pixelPickEvery', () => {
  it('returns its hits back-to-front when a later pass cannot read', () => {
    let pass = 0;
    // Buffer order puts the front node first; the second pass has nothing to read.
    const readIds = (): IdBuffer | null =>
      pass++ === 0 ? ({ width: 2, height: 1, data: new Uint32Array([2, 1]) } as unknown as IdBuffer) : null;
    expect(pixelPickEvery(readIds, ids, { x: 0, y: 0 }, 1, (id) => order[id]!)).toEqual(['back', 'front']);
  });
});
