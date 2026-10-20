import { describe, expect, it, vi } from 'vitest';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { createSetDataOp } from 'core/ops/setData';
import type { Op } from 'core/ops/types';
import type { RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { moveAction } from './move/action';
import { nudgeRightAction } from './defaults/nudge';
import { alignRightAction } from './align/action';
import type { TransformFollower } from './transformFinish';

const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

function fixture(answer: 'follow' | 'refuse') {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: box(0, 0) });
  const b = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: box(50, 0) });
  const transformOps = vi.fn((ops: readonly Op[], label: string) => (answer === 'refuse' ? null : [
    ...ops, createSetDataOp({ id: b, from: {}, to: { followed: label }, label }),
  ]));
  const deps = {
    selection: { get: () => [a], adapterMethods: undefined } as unknown as SelectionApi,
    scene,
    transformFollowers: [{
      finish: transformOps,
      preview: (poses: ReadonlyMap<string, unknown>) =>
        (poses.has(a) ? [{ id: b, pose: box(50, 50), data: { followed: 'preview' } }] : []),
    }],
  } as unknown as ActionDeps;
  return { scene, a, b, deps, transformOps };
}

const DRAG = { start: { x: 5, y: 5 }, current: { x: 105, y: 5 }, delta: { x: 100, y: 0 } };

function drag(deps: ActionDeps, during?: (handle: OngoingHandle) => void): void {
  const ctx = (moving: boolean) => ({
    world: moving ? DRAG.current : DRAG.start, screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps, drag: moving ? DRAG : undefined,
  }) as unknown as InvocationCtx;
  const handle = (moveAction.invoker as OngoingInvoker).start(ctx(false), undefined) as OngoingHandle;
  handle.onMove!(ctx(true));
  during?.(handle);
  handle.onEnd!(ctx(true), 'commit');
}

describe('whole-node transforms finish through the transformFollowers dep', () => {
  it('commits what a move changes beside the moved node in its history entry', () => {
    const { scene, a, b, deps, transformOps } = fixture('follow');
    drag(deps);
    expect(transformOps).toHaveBeenCalledTimes(1);
    expect(scene.get(a)!.pose).toEqual(box(100, 0));
    expect(scene.get(b)!.data).toEqual({ followed: 'Move' });
    scene.undo();
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(scene.get(b)!.data).toEqual({});
  });

  it('commits nothing when the dep refuses the move', () => {
    const { scene, a, deps } = fixture('refuse');
    drag(deps);
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
  });

  it('finishes a nudge the same way', () => {
    const { scene, b, deps } = fixture('follow');
    (nudgeRightAction.invoker as ImmediateInvoker).run(deps, undefined);
    expect(scene.get(b)!.data).toEqual({ followed: 'Nudge' });
  });

  it('finishes an align, in the align\'s one undo step', () => {
    const { scene, a, b, deps } = fixture('follow');
    const both = { ...deps, selection: { get: () => [a, b], adapterMethods: undefined } } as unknown as ActionDeps;
    (alignRightAction.invoker as ImmediateInvoker).run(both, undefined);
    expect(scene.get(a)!.pose).toEqual(box(50, 0));
    expect(scene.get(b)!.data).toEqual({ followed: 'Align' });
    scene.undo();
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(scene.get(b)!.data).toEqual({});
  });

  it('previews the nodes the dep says change with each frame of a move', () => {
    const { a, b, deps } = fixture('follow');
    drag(deps, (handle) => {
      expect([...handle.previewIds!()!]).toEqual([a, b]);
      expect(handle.previewPose!(a)).toEqual(box(100, 0));
      expect(handle.previewPose!(b)).toEqual(box(50, 50));
      expect(handle.previewData!(b)).toEqual({ followed: 'preview' });
      expect(handle.previewData!(a)).toBeNull();
    });
  });

  it('composes two followers: the second finishes the first one\'s batch, and previews over its frame', () => {
    const { scene, a, b, deps } = fixture('follow');
    const c = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: box(90, 0) });
    const first = (deps as unknown as { transformFollowers: TransformFollower[] }).transformFollowers[0]!;
    const second: TransformFollower = {
      finish: (ops, label) => [...ops, createSetDataOp({ id: c, from: {}, to: { after: ops.length, label }, label })],
      preview: (frame) => (frame.has(b) ? [{ id: c, pose: box(90, 90) }] : []),
    };
    const both = { ...deps, transformFollowers: [first, second] } as unknown as ActionDeps;
    drag(both, (handle) => {
      expect([...handle.previewIds!()!]).toEqual([a, b, c]);
      expect(handle.previewPose!(c)).toEqual(box(90, 90));
    });
    expect(scene.get(b)!.data).toEqual({ followed: 'Move' });
    expect(scene.get(c)!.data).toEqual({ after: 2, label: 'Move' });
    scene.undo();
    expect(scene.get(c)!.data).toEqual({});
  });

  it('commits nothing when any follower refuses', () => {
    const { scene, a, deps } = fixture('follow');
    const first = (deps as unknown as { transformFollowers: TransformFollower[] }).transformFollowers[0]!;
    const refuse: TransformFollower = { finish: () => null, preview: () => [] };
    drag({ ...deps, transformFollowers: [first, refuse] } as unknown as ActionDeps);
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
  });
});
