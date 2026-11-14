import { describe, expect, it } from 'vitest';
import { asPolygonPath, rectPath } from '@weasel-js/geom';
import { planeOver } from '@weasel-js/geom/warp';
import { heldPathWarpOf, resolvePathWarp } from './pathWarp';

const box = { x: 0, y: 0, width: 10, height: 10 };
const held = (warp: unknown) => ({ id: 'w', source: asPolygonPath(rectPath(0, 0, 10, 10)), warp, tolerance: 0.5, frame: [1, 0, 0, 1, 0, 0] });

describe('a held warp of a kind this build does not know', () => {
  // A document saved by a later build with a kind added. Kinds renamed since a save read under their new names.
  const old = held({ ...planeOver(box), kind: 'twirl' });

  it('is no held warp', () => {
    expect(heldPathWarpOf({ warp: old })).toBeNull();
    expect(heldPathWarpOf({ warp: held(planeOver(box)) })).not.toBeNull();
  });

  it('resolves to none rather than throwing', () => {
    const node = { kind: 'mark', pose: box, data: { path: asPolygonPath(rectPath(0, 0, 10, 10)), warp: old } };
    expect(resolvePathWarp(node as never)).toBeNull();
  });
});
