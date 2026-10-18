import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { snap } from '../../gestures/shared/snap';
import type { SnapDep } from '../snapDep';
import { moveAction } from './action';
import { captureMovePathSnap, snapMoveDelta } from './pathSnap';

const PRESS = { x: 11, y: 11 };

describe('a move snapping to paths', () => {
  it('takes its base point from the dragged geometry, then snaps it to everything else', () => {
    const toTargets = vi.fn((p: { x: number; y: number }, at?: { include?: readonly string[] }) =>
      (at?.include ? { x: 10, y: 10 } : p.x > 45 ? { x: 50, y: 50 } : null));
    const s = captureMovePathSnap({ point: (p) => p, toTargets } as SnapDep, PRESS, ['a']);
    expect(s?.base).toEqual({ x: 10, y: 10 });
    expect(toTargets).toHaveBeenCalledWith({ x: 11, y: 11 }, { include: ['a'] });

    expect(snapMoveDelta(s, 5, 5)).toEqual({ dx: 5, dy: 5, held: false });
    expect(snapMoveDelta(s, 38, 41)).toEqual({ dx: 40, dy: 40, held: true });
    expect(toTargets).toHaveBeenLastCalledWith({ x: 48, y: 51 }, { origin: { x: 10, y: 10 }, exclude: ['a'] });
  });

  it('leaves the delta alone without a snap dep that snaps to paths', () => {
    expect(captureMovePathSnap({ point: (p) => p }, PRESS, ['a'])).toBeNull();
    expect(snapMoveDelta(null, 3, 4)).toEqual({ dx: 3, dy: 4, held: false });
  });
});

describe('a move held by a snap target', () => {
  it('stays on the target, whatever the binding\'s own snapping says', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } }) as string;
    const END = { x: 50, y: 50 };
    const deps = {
      scene,
      selection: { get: () => [id], set: () => {} } as unknown as SelectionApi,
      snap: {
        point: (p) => p,
        toTargets: (p, at) => (!at?.include && Math.hypot(p.x - END.x, p.y - END.y) <= 5 ? END : null),
      } satisfies SnapDep,
    };
    // A grid of 7, which would put the origin at (49, 49).
    const grid = snap<RectPose>({
      snap: (pose) => ({ ...pose, x: Math.round(pose.x / 7) * 7, y: Math.round(pose.y / 7) * 7 }),
    });
    const from = { x: 5, y: 5 };
    const at = (p: { x: number; y: number }) => ({
      world: p, screen: p, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps,
      drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y } },
    }) as unknown as InvocationCtx;
    const handle = (moveAction.invoker as OngoingInvoker).start(at(from), { behaviors: [grid] } as never);
    handle.onMove!(at({ x: 53, y: 52 }));
    handle.onEnd!(at({ x: 53, y: 52 }), 'commit');
    expect(scene.get(id as never)!.pose).toMatchObject({ x: 45, y: 45 });
  });
});
