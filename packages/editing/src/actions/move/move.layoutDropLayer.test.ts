/**
 * A layout drop into a container on another layer moves the dropped node onto
 * that layer, as a reparent-on-drop does.
 */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { moveAction } from './action';
import { createScene } from '@weasel-js/core/engine';
import type { NodeId, RectPose } from '@weasel-js/core';
import type { ContainerBounds, LayoutStrategy } from '@weasel-js/core/engine';
import * as ops from '@weasel-js/core/ops';

const slot = (b: ContainerBounds): RectPose => ({ x: b.x, y: b.y, width: 20, height: 10 });
const first = {
  snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
  childPoses: () => new Map(),
  getDropTargets: (c: { bounds: ContainerBounds }) => [{ pose: slot(c.bounds), origin: { x: c.bounds.x, y: c.bounds.y } }],
  reflowPoses: () => new Map(),
  commitDrop: (_c: unknown, _k: unknown, d: { id: string; originPose: RectPose }, target: { pose: RectPose }) => [
    ops.setPose<RectPose>({ id: d.id, from: d.originPose, to: target.pose, label: 'Drop' }),
  ],
} as unknown as LayoutStrategy<unknown>;

describe('moveAction — layout drop across layers', () => {
  it.each([['above', 'top', 'main'], ['below', 'main', 'top']])('lands a node in a container on the layer %s it', (_, boxLayer, nodeLayer) => {
    const scene = createScene<object, 'main' | 'top', RectPose>({ systemLayers: [{ id: 'main' }, { id: 'top' }] });
    const box = scene.add({ kind: 'group', layer: boxLayer as 'main', data: {}, pose: { x: 100, y: 100, width: 100, height: 100 } });
    const dragged = scene.add({ kind: 'mark', layer: nodeLayer as 'main', data: {}, pose: { x: 0, y: 0, width: 20, height: 10 } });
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const base = {
      world: { x: 10, y: 5 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        operands: { get: () => [dragged] as NodeId[] },
        scene,
        layout: { getLayout: (cid: string) => (cid === box ? first : null) },
      },
    };
    const drag = { start: { x: 10, y: 5 }, current: { x: 150, y: 150 }, delta: { x: 140, y: 145 } };
    const handle: OngoingHandle = invoker.start(base as unknown as InvocationCtx, undefined);
    const at = { ...base, world: drag.current, drag } as unknown as InvocationCtx;
    handle.onMove!(at);
    handle.onEnd!(at, 'commit');
    expect(scene.get(dragged)!.parent).toBe(box);
    expect(scene.get(dragged)!.layer).toBe(boxLayer);
  });
});
