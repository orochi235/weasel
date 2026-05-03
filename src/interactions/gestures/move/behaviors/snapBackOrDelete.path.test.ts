import { describe, expect, it } from 'vitest';
import { snapBackOrDelete } from './snapBackOrDelete';
import { polygonFromPoints, pathOriginProjection, type Path } from '../../../../features/paths';
import type { GestureContext } from '../../types';

function ctx(originPose: Path, currentPose: Path): GestureContext<Path> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', originPose]]),
    current: new Map([['a', currentPose]]),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 },
    adapter: {
      getObject: (id: string) => ({ id }),
    } as any,
    scratch: {},
  };
}

const TRI = polygonFromPoints([
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 5, y: 10 },
]);

describe('snapBackOrDelete + pathOriginProjection', () => {
  it('snaps back (returns null) when the Path bounds origin moved less than radius', () => {
    const b = snapBackOrDelete<Path>({
      radius: 5,
      onFreeRelease: 'snap-back',
      origin: pathOriginProjection,
    });
    const moved = pathOriginProjection.translate(TRI, 1, 2); // delta (1,2), |d|≈2.24
    expect(b.onEnd!(ctx(TRI, moved))).toBeNull();
  });

  it('emits a delete op when the Path bounds origin moved beyond radius and policy is delete', () => {
    const b = snapBackOrDelete<Path>({
      radius: 5,
      onFreeRelease: 'delete',
      origin: pathOriginProjection,
    });
    const moved = pathOriginProjection.translate(TRI, 50, 50);
    const ops = b.onEnd!(ctx(TRI, moved));
    expect(Array.isArray(ops)).toBe(true);
    expect((ops as any[])[0].label).toMatch(/delete/i);
  });
});
