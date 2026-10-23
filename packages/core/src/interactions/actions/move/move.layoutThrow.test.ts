/**
 * A layout strategy that throws mid-drag drops that frame, the way a throwing
 * binding behavior does, and must not leave the drop the frame before it
 * resolved deciding the commit: that drop is no longer where the pointer is.
 */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { createTransformOp } from 'core/ops/transform';
import type { LayoutStrategy } from '../../../layout/types';

interface P { x: number; y: number; width: number; height: number }

describe('moveAction — a layout pass that throws', () => {
  it("commits the last frame that held as a plain move, not as that frame's drop", () => {
    const scene = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
    const box = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 200, height: 200 } });
    const leaf = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 40, height: 40 } });
    const slot: P = { x: 120, y: 130, width: 40, height: 40 };
    let calls = 0;
    const layout = {
      snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
      childPoses: () => new Map(),
      getDropTargets: () => {
        calls += 1;
        if (calls > 1) throw new Error('layout failed');
        return [{ pose: slot, origin: { x: slot.x, y: slot.y } }];
      },
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
        selection: { get: () => [leaf] as NodeId[] },
        scene,
        layout: { getLayout: (cid: string) => (cid === box ? layout : null) },
      },
    };
    const first = { start: { x: 20, y: 20 }, current: { x: 200, y: 200 }, delta: { x: 180, y: 180 } };
    const second = { start: { x: 20, y: 20 }, current: { x: 210, y: 200 }, delta: { x: 190, y: 180 } };
    const handle = invoker.start(base as unknown as InvocationCtx, undefined);
    handle.onMove!({ ...base, world: first.current, drag: first } as unknown as InvocationCtx);
    expect(() => handle.onMove!({ ...base, world: second.current, drag: second } as unknown as InvocationCtx))
      .toThrow('layout failed');
    handle.onEnd!({ ...base, world: second.current, drag: second } as unknown as InvocationCtx, 'commit');

    expect(scene.get(leaf)!.parent).toBe(null);
    expect(scene.get(leaf)!.pose).toEqual({ x: 180, y: 180, width: 40, height: 40 });
  });
});
