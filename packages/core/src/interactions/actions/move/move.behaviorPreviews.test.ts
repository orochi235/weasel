/**
 * What a move behavior's `onMove` can show beyond the dragged nodes: a preview
 * pose for any node (`BehaviorResult.poses`), and which previews paint settled
 * rather than as ghosts (`BehaviorResult.opaque`).
 */
import { describe, it, expect } from 'vitest';
import { moveAction } from './action';
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { effectivePose } from 'core/scene/effectivePose';
import type { NodeId, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { BehaviorResult, MoveBehavior } from '../../gestures/types';
import type { LayoutStrategy } from '../../../layout/types';

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

/** A dragged leaf and two bystanders the drag does not touch. */
function fixture(deps: Record<string, unknown> = {}) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const dragged = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: box(0, 0) });
  const near = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: box(50, 0) });
  const far = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: box(90, 0) });
  const ctx = (dx?: number): InvocationCtx => ({
    world: { x: dx ?? 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [dragged] } as unknown as SelectionApi, scene, ...deps },
    drag: dx === undefined ? undefined : { start: { x: 0, y: 0 }, current: { x: dx, y: 0 }, delta: { x: dx, y: 0 } },
  }) as unknown as InvocationCtx;
  const start = (...behaviors: MoveBehavior<unknown>[]): OngoingHandle =>
    (moveAction.invoker as OngoingInvoker).start(ctx(), { behaviors } as BindingOpts) as OngoingHandle;
  const shown = (id: NodeId) => effectivePose(scene, scene.get(id)!);
  return { scene, dragged, near, far, ctx, start, shown };
}

/** A behavior answering each `onMove` with the next of `frames`, then nothing. */
function scripted(...frames: Array<BehaviorResult<unknown> | undefined>): MoveBehavior<unknown> {
  let at = 0;
  return { onMove: () => frames[at++] };
}

describe('BehaviorResult.poses — a node the drag does not move', () => {
  it('is previewed where the behavior put it, and published to the scene', () => {
    const { near, ctx, start, shown } = fixture();
    const handle = start(scripted({ poses: new Map([[near, box(50, 30)]]) }));
    handle.onMove!(ctx(5));
    expect([...(handle.previewIds!() ?? [])]).toContain(near);
    expect(shown(near)).toEqual(box(50, 30));
  });

  it('takes the last behavior\'s pose when two answer for it', () => {
    const { near, ctx, start, shown } = fixture();
    const handle = start(
      scripted({ poses: new Map([[near, box(50, 30)]]) }),
      scripted({ poses: new Map([[near, box(50, 60)]]) }),
    );
    handle.onMove!(ctx(5));
    expect(shown(near)).toEqual(box(50, 60));
  });

  it('goes back to its stored pose on the first frame no behavior returns it', () => {
    const { scene, dragged, near, ctx, start, shown } = fixture();
    const handle = start(scripted({ poses: new Map([[near, box(50, 30)]]) }, undefined));
    handle.onMove!(ctx(5));
    expect(shown(near)).toEqual(box(50, 30));
    handle.onMove!(ctx(6));
    expect(scene.overrides.get(near)).toBeUndefined();
    expect(shown(near)).toEqual(box(50, 0));
    // The dragged node is still previewed.
    expect(shown(dragged)).toEqual(box(6, 0));
  });

  it('is released when the gesture ends, and the behavior is left to commit it', () => {
    const { scene, near, ctx, start, shown } = fixture();
    const handle = start(scripted({ poses: new Map([[near, box(50, 30)]]) }));
    handle.onMove!(ctx(5));
    expect(shown(near)).toEqual(box(50, 30));
    handle.onEnd!(ctx(5), 'commit');
    expect(scene.overrides.get(near)).toBeUndefined();
    expect(scene.get(near)!.pose).toEqual(box(50, 0));
  });
});

describe('BehaviorResult.transform', () => {
  it('is the one way a behavior moves the drag: a pose on the result is not read', () => {
    const { dragged, ctx, start, shown } = fixture();
    const stray = { pose: box(40, 0) } as unknown as BehaviorResult<unknown>;
    const handle = start(scripted(stray, { transform: { kind: 'translate', dx: 8, dy: 0 } }));
    handle.onMove!(ctx(5));
    expect(shown(dragged)).toEqual(box(5, 0));
    handle.onMove!(ctx(5));
    expect(shown(dragged)).toEqual(box(8, 0));
  });
});

describe('BehaviorResult.opaque', () => {
  it('names the previews that paint at full opacity, from every behavior', () => {
    const { dragged, near, far, ctx, start } = fixture();
    const handle = start(scripted({ opaque: [near] }), scripted({ opaque: new Set([far, dragged]) }));
    handle.onMove!(ctx(5));
    expect(new Set(handle.previewOpaqueIds!())).toEqual(new Set([near, far, dragged]));
  });

  it('holds for one frame', () => {
    const { near, ctx, start } = fixture();
    const handle = start(scripted({ opaque: [near] }, undefined));
    handle.onMove!(ctx(5));
    expect([...handle.previewOpaqueIds!()!]).toEqual([near]);
    handle.onMove!(ctx(6));
    expect(handle.previewOpaqueIds!()).toBeNull();
  });

  it('adds to the siblings a layout drop reflows', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const target = scene.add({ kind: 'container', layer: 'main', data: {}, pose: box(100, 100, 200, 200) });
    const sibling = scene.add({ kind: 'leaf', layer: 'main', parent: target, data: {}, pose: box(110, 110) });
    const dragged = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: box(0, 0) });
    const other = scene.add({ kind: 'leaf', layer: 'main', data: {}, pose: box(0, 50) });
    const slot = box(120, 130);
    const layout = {
      snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
      childPoses: () => new Map(),
      getDropTargets: () => [{ pose: slot, origin: { x: slot.x, y: slot.y } }],
      reflowPoses: () => new Map([[sibling as string, box(110, 150)]]),
      commitDrop: () => [],
    } as unknown as LayoutStrategy<unknown>;
    const base = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => [dragged] as NodeId[] },
        scene,
        layout: { getLayout: (id: string) => (id === target ? layout : null) },
      },
    };
    const drag = { start: { x: 5, y: 5 }, current: { x: 200, y: 200 }, delta: { x: 195, y: 195 } };
    const handle = (moveAction.invoker as OngoingInvoker).start(
      base as unknown as InvocationCtx,
      { behaviors: [scripted({ opaque: [other] })] } as BindingOpts,
    ) as OngoingHandle;
    handle.onMove!({ ...base, world: drag.current, drag } as unknown as InvocationCtx);
    expect(new Set(handle.previewOpaqueIds!())).toEqual(new Set([sibling, other]));
  });
});
