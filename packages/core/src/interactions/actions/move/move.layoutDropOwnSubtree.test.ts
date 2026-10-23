/**
 * A layout container inside the dragged subtree is not a drop target: taking
 * the drop would reparent a node under its own descendant.
 */
import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { createTransformOp } from 'core/ops/transform';
import type { LayoutStrategy } from '../../../layout/types';

interface P { x: number; y: number; width: number; height: number }

describe('moveAction — a layout container inside the dragged subtree', () => {
  it('does not take the drop of the root that holds it', () => {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const group = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100 } });
    const inner = scene.add({ kind: 'group', layer: 'main', parent: group, data: {}, pose: { x: 10, y: 10, width: 80, height: 80 } });
    const slot: P = { x: 20, y: 20, width: 100, height: 100 };
    const getDropTargets = vi.fn(() => [{ pose: slot, origin: { x: slot.x, y: slot.y } }]);
    const layout = {
      snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
      childPoses: () => new Map(),
      getDropTargets,
      reflowPoses: () => new Map(),
      commitDrop: (_c: unknown, _k: unknown, dragged: { id: string; originPose: P }, target: { pose: P }) =>
        [createTransformOp<P>({ id: dragged.id, from: dragged.originPose, to: target.pose, label: 'Drop' })],
    } as unknown as LayoutStrategy<unknown>;

    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => [group] as NodeId[] },
        scene,
        layout: { getLayout: (cid: string) => (cid === inner ? layout : null) },
      },
    };
    // The group's center stays over where the document still holds `inner`.
    const drag = { start: { x: 50, y: 50 }, current: { x: 55, y: 55 }, delta: { x: 5, y: 5 } };
    const handle = invoker.start(base as unknown as InvocationCtx, undefined);
    handle.onMove!({ ...base, world: drag.current, drag } as unknown as InvocationCtx);
    expect(getDropTargets).not.toHaveBeenCalled();
    handle.onEnd!({ ...base, world: drag.current, drag } as unknown as InvocationCtx, 'commit');

    expect(scene.get(group)!.parent).toBe(null);
    expect(scene.get(group)!.pose).toEqual({ x: 5, y: 5, width: 100, height: 100 });
    expect(scene.get(inner)!.parent).toBe(group);
    expect(scene.get(inner)!.pose).toEqual({ x: 15, y: 15, width: 80, height: 80 });
  });
});
