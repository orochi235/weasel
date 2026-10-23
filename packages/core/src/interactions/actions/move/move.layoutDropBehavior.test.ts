/**
 * A layout drop in the move's behavior chain: where it stands behind the
 * binding's own behaviors, and what it answers when a drop it took has
 * nothing to write.
 */
import { describe, it, expect, vi } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { asNodeId, type RectPose } from 'core/scene/types';
import type { LayoutStrategy, ReflowTransition } from '../../../layout/types';
import type { MoveBehavior } from '../../gestures/types';
import { moveAction } from './action';

const T = asNodeId('target');
const KID = asNodeId('kid');
const SIB = asNodeId('sib');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });
const HOME = box(110, 110);
const SLOT = box(150, 150);

type Hooks = Pick<LayoutStrategy<RectPose>, 'commitDrop' | 'releaseDrop'>;

/** A container holding the dragged `kid` and a sibling its drop displaces. */
function fixture(hooks: Partial<Hooks>, more: { behaviors?: MoveBehavior<unknown>[]; reflow?: ReflowTransition<unknown>; deps?: object } = {}) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 200, height: 200 } });
  scene.add({ id: KID, kind: 'mark', layer: 'main', parent: T, data: {}, pose: HOME });
  scene.add({ id: SIB, kind: 'mark', layer: 'main', parent: T, data: {}, pose: box(150, 110) });
  const layout = {
    snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
    childPoses: () => new Map(),
    getDropTargets: () => [{ pose: SLOT, origin: { x: SLOT.x, y: SLOT.y } }],
    reflowPoses: () => new Map([[SIB as string, box(110, 150)]]),
    commitDrop: () => [],
    ...hooks,
  } as unknown as LayoutStrategy<unknown>;
  const onGestureEnd = vi.fn();
  const base = {
    world: { x: 115, y: 115 },
    modifiers: MODS,
    deps: {
      selection: { get: () => [KID] },
      scene,
      layout: { getLayout: (id: string) => (id === T ? layout : null), reflow: more.reflow },
      ...more.deps,
    },
  };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(
    base as unknown as InvocationCtx,
    { behaviors: more.behaviors ?? [], params: { onGestureEnd } } as BindingOpts,
  );
  const dragTo = (x: number, y: number): InvocationCtx => ({
    ...base,
    world: { x, y },
    drag: { start: { x: 115, y: 115 }, current: { x, y }, delta: { x: x - 115, y: y - 115 } },
  }) as unknown as InvocationCtx;
  return { scene, handle, dragTo, onGestureEnd };
}

/** Records what a move asks of the reflow transition. */
function recorder() {
  const calls: string[] = [];
  const reflow: ReflowTransition<unknown> = {
    glide: (id) => { calls.push(`glide:${id}`); },
    settle: (id, opts) => { calls.push(`settle:${id}${opts?.from === undefined ? '' : `:from${(opts.from as RectPose).x}`}`); },
    stop: (id) => { calls.push(`stop:${id}`); },
    poseOf: () => undefined,
  };
  return { calls, reflow };
}

describe('moveAction — a layout drop behind the binding\'s behaviors', () => {
  it('leaves the commit to a binding behavior that answers at end, and still settles its glides', () => {
    const commitDrop = vi.fn((): Op[] => [createTransformOp<RectPose>({ id: KID, from: HOME, to: SLOT, label: 'Drop' })]);
    const { calls, reflow } = recorder();
    const claims: MoveBehavior<unknown> = { onEnd: () => [] };
    const { scene, handle, dragTo, onGestureEnd } = fixture({ commitDrop }, { behaviors: [claims], reflow });
    handle.onMove!(dragTo(155, 155));
    expect(calls).toEqual(['glide:sib']);
    handle.onEnd!(dragTo(155, 155), 'commit');
    expect(commitDrop).not.toHaveBeenCalled();
    expect(scene.get(KID)!.pose).toEqual(HOME);
    expect(onGestureEnd).toHaveBeenCalledWith(true);
    expect(calls.slice(1)).toEqual(['settle:sib', 'settle:kid:from150']);
  });

  it('still glides the dragged node home from where it was let go when a binding behavior\'s onEnd throws', () => {
    const commitDrop = vi.fn((): Op[] => []);
    const { calls, reflow } = recorder();
    const throws: MoveBehavior<unknown> = { onEnd: () => { throw new Error('behavior failed'); } };
    const { scene, handle, dragTo, onGestureEnd } = fixture({ commitDrop }, { behaviors: [throws], reflow });
    handle.onMove!(dragTo(155, 155));
    expect(() => handle.onEnd!(dragTo(155, 155), 'commit')).toThrow('behavior failed');
    expect(calls.slice(1)).toEqual(['settle:sib', 'settle:kid:from150']);
    expect(commitDrop).not.toHaveBeenCalled();
    expect(scene.get(KID)!.pose).toEqual(HOME);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('asks no source layout to release when a binding behavior answers at end', () => {
    const releaseDrop = vi.fn((): Op[] | null => []);
    const claims: MoveBehavior<unknown> = { onEnd: () => [] };
    const { handle, dragTo } = fixture({ releaseDrop }, { behaviors: [claims] });
    handle.onMove!(dragTo(500, 500));
    handle.onEnd!(dragTo(500, 500), 'commit');
    expect(releaseDrop).not.toHaveBeenCalled();
  });
});

describe('moveAction — a layout drop with nothing to write', () => {
  it('commits nothing and does not translate when the accepted drop yields no ops', () => {
    const applyOps = vi.fn();
    const { scene, handle, dragTo, onGestureEnd } = fixture({ commitDrop: () => [] }, { deps: { applyOps } });
    handle.onMove!(dragTo(155, 155));
    handle.onEnd!(dragTo(155, 155), 'commit');
    expect(applyOps).not.toHaveBeenCalled();
    expect(scene.get(KID)!.pose).toEqual(HOME);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('commits nothing and does not translate when a release claims the drop with no ops', () => {
    const applyOps = vi.fn();
    const { scene, handle, dragTo, onGestureEnd } = fixture({ releaseDrop: () => [] }, { deps: { applyOps } });
    handle.onMove!(dragTo(500, 500));
    handle.onEnd!(dragTo(500, 500), 'commit');
    expect(applyOps).not.toHaveBeenCalled();
    expect(scene.get(KID)!.pose).toEqual(HOME);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });
});
