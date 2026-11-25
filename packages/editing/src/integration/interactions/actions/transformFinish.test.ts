import { describe, expect, it, vi } from 'vitest';
import type { ActionDeps, ImmediateInvoker, InvocationCtx, OngoingHandle, OngoingInvoker, SelectionApi } from '@weasel-js/routing';
import { createScene, commitTransformOps, type TransformFollower } from '@weasel-js/core/engine';
import type { Op } from '@weasel-js/core';
import type { RectPose } from '@weasel-js/core/engine';
import { lastTransform } from '@weasel-js/core';
import { alignRightAction, distributeHorizontalAction, flipAction, nudgeRightAction, swapAction, transformSelection } from '@weasel-js/editing';
import { ActionDisabledReason, type Action } from '@weasel-js/routing';
import { moveAction } from '../../../actions/move/action';
import * as coreOps from '@weasel-js/core/ops';

const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

function fixture(answer: 'follow' | 'refuse') {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const a = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 0) });
  const b = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(50, 0) });
  const transformOps = vi.fn((ops: readonly Op[], label: string) => (answer === 'refuse' ? null : [
    ...ops, coreOps.setData({ id: b, from: {}, to: { followed: label }, label }),
  ]));
  const deps = {
    operands: { get: () => [a], adapterMethods: undefined } as unknown as SelectionApi,
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

  it('records no nudge for Transform Again when the dep refuses it', () => {
    const { scene, a, deps } = fixture('refuse');
    (nudgeRightAction.invoker as ImmediateInvoker).run(deps, undefined);
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(lastTransform(scene)).toBeUndefined();
  });

  it('finishes an align, in the align\'s one undo step', () => {
    const { scene, a, b, deps } = fixture('follow');
    const both = { ...deps, operands: { get: () => [a, b], adapterMethods: undefined } } as unknown as ActionDeps;
    (alignRightAction.invoker as ImmediateInvoker).run(both, undefined);
    expect(scene.get(a)!.pose).toEqual(box(50, 0));
    expect(scene.get(b)!.data).toEqual({ followed: 'Align' });
    scene.undo();
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
    expect(scene.get(b)!.data).toEqual({});
  });

  it('previews the nodes the dep says change with each frame of a move', () => {
    const { scene, a, b, deps } = fixture('follow');
    drag(deps, (handle) => {
      expect([...handle.previewIds!()!]).toEqual([a, b]);
      expect(handle.previewPose).toBeUndefined();
      expect(scene.overrides.read(a)?.pose).toEqual(box(100, 0));
      expect(scene.overrides.read(b)?.pose).toEqual(box(50, 50));
      expect(handle.previewData!(b)).toEqual({ followed: 'preview' });
      expect(handle.previewData!(a)).toBeNull();
    });
  });

  it('pins no override on a node a follower previews at its own pose, so a derived one keeps deriving', () => {
    const { scene, a, b, deps } = fixture('follow');
    const keep: TransformFollower = {
      finish: (ops) => [...ops],
      preview: (frame) => (frame.has(a) ? [{ id: b, pose: scene.get(b)!.pose, data: { kept: true } }] : []),
    };
    drag({ ...deps, transformFollowers: [keep] } as unknown as ActionDeps, (handle) => {
      expect([...handle.previewIds!()!]).toEqual([a, b]);
      expect(scene.overrides.read(b)).toBeUndefined();
      expect(handle.previewData!(b)).toEqual({ kept: true });
    });
  });

  it('composes two followers: the second finishes the first one\'s batch, and previews over its frame', () => {
    const { scene, a, b, deps } = fixture('follow');
    const c = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(90, 0) });
    const first = (deps as unknown as { transformFollowers: TransformFollower[] }).transformFollowers[0]!;
    const second: TransformFollower = {
      finish: (ops, label) => [...ops, coreOps.setData({ id: c, from: {}, to: { after: ops.length, label }, label })],
      preview: (frame) => (frame.has(b) ? [{ id: c, pose: box(90, 90) }] : []),
    };
    const both = { ...deps, transformFollowers: [first, second] } as unknown as ActionDeps;
    drag(both, (handle) => {
      expect([...handle.previewIds!()!]).toEqual([a, b, c]);
      expect(scene.overrides.read(c)?.pose).toEqual(box(90, 90));
    });
    expect(scene.get(b)!.data).toEqual({ followed: 'Move' });
    expect(scene.get(c)!.data).toEqual({ after: 2, label: 'Move' });
    scene.undo();
    expect(scene.get(c)!.data).toEqual({});
  });

  it('hands each follower the data the ones before it previewed', () => {
    const { b, deps } = fixture('follow');
    const first = (deps as unknown as { transformFollowers: TransformFollower[] }).transformFollowers[0]!;
    const heard: unknown[] = [];
    const second: TransformFollower = {
      finish: (ops) => [...ops],
      preview: (_frame, data) => { heard.push(data.get(b)); return []; },
    };
    drag({ ...deps, transformFollowers: [first, second] } as unknown as ActionDeps, (handle) => {
      handle.previewIds!();
    });
    expect(heard.at(-1)).toEqual({ followed: 'preview' });
  });

  it('commits nothing when any follower refuses', () => {
    const { scene, a, deps } = fixture('follow');
    const first = (deps as unknown as { transformFollowers: TransformFollower[] }).transformFollowers[0]!;
    const refuse: TransformFollower = { finish: () => null, preview: () => [] };
    drag({ ...deps, transformFollowers: [first, refuse] } as unknown as ActionDeps);
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
  });

  it('reports no commit when the scene refuses the batch', () => {
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const g = scene.add({ kind: 'group', layer: 'main', data: {}, pose: box(0, 0) });
    scene.setArrivalHandler(() => null);
    const op = coreOps.insert({ node: { id: 'n', kind: 'mark', layer: 'main', parent: g, data: {}, pose: box(0, 0) }, label: 'Add' });
    expect(commitTransformOps({ scene } as unknown as ActionDeps, [op], 'Add')).toBe(false);
    expect(scene.childrenOf(g)).toEqual([]);
  });
});

describe('commands ask enabled of the batch the followers finish, as run commits it', () => {
  function rig(answer: 'follow' | 'refuse' | 'lock') {
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const ids = [box(0, 0), box(30, 7), box(80, 3)].map((pose) => scene.add({ kind: 'mark', layer: 'main', data: {}, pose }));
    const pinned = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: box(0, 90), locked: answer === 'lock' } as never) as string;
    const finish = (ops: readonly Op[], label: string) => (answer === 'refuse' ? null : [
      ...ops, coreOps.setData({ id: pinned, from: {}, to: { followed: label }, label }),
    ]);
    const deps = {
      operands: { get: () => ids, adapterMethods: undefined } as unknown as SelectionApi,
      scene,
      transformFollowers: [{ finish, preview: () => [] }],
    } as unknown as ActionDeps;
    return { scene, ids, deps };
  }
  const commands: [string, Action, Record<string, unknown> | undefined][] = [
    ['align', alignRightAction, undefined],
    ['distribute', distributeHorizontalAction, undefined],
    ['flip', flipAction, { axis: 'x', pivot: 'union' }],
    ['swap', swapAction, undefined],
    ['nudge', nudgeRightAction, undefined],
  ];

  for (const [name, action, params] of commands) {
    it(`${name}: on when the followers accept, off when they refuse or write a locked node`, () => {
      const pair = (deps: ActionDeps, ids: string[]) =>
        (name === 'swap' ? { ...deps, operands: { get: () => ids.slice(0, 2), adapterMethods: undefined } } : deps) as ActionDeps;
      const ok = rig('follow');
      expect(action.enabled!(pair(ok.deps, ok.ids), undefined, undefined, params as never)).toBe(true);
      const refused = rig('refuse');
      expect(action.enabled!(pair(refused.deps, refused.ids), undefined, undefined, params as never)).toBe(ActionDisabledReason.NotApplicable);
      const locked = rig('lock');
      const deps = pair(locked.deps, locked.ids);
      expect(action.enabled!(deps, undefined, undefined, params as never)).toBe(ActionDisabledReason.Locked);
      const before = locked.ids.map((id) => locked.scene.get(id)!.pose);
      expect(() => (action.invoker as ImmediateInvoker).run(deps, params as never)).not.toThrow();
      expect(locked.ids.map((id) => locked.scene.get(id)!.pose)).toEqual(before);
    });
  }

  it('transformSelection commits nothing when the finished batch writes a locked node', () => {
    const { scene, ids, deps } = rig('lock');
    expect(transformSelection(deps, { kind: 'translate', dx: 5, dy: 0 }, 'Move')).toBe(false);
    expect(scene.get(ids[0]!)!.pose).toEqual(box(0, 0));
  });
});
