/** A swap armed over a sibling in a layout container previews the swap, as its release commits it. */
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import type { InvocationCtx, OngoingHandle, OngoingInvoker } from '@weasel-js/routing';
import { createScene, asNodeId, type RectPose } from '@weasel-js/core/engine';
import type { LayoutStrategy } from '@weasel-js/core/engine';
import type { NodeId } from '@weasel-js/core';
import * as ops from '@weasel-js/core/ops';
import { moveAction } from './action';

const L = asNodeId('list');
const A = asNodeId('a');
const B = asNodeId('b');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

/** Takes a drop anywhere, and makes room by pushing every other child 100 to the right. */
const layout = {
  snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
  childPoses: () => new Map(),
  getDropTargets: () => [{ pose: box(0, 0), origin: { x: 0, y: 0 } }],
  reflowPoses: (_c: unknown, kids: { id: string; pose: RectPose }[], dragged: { id: string }) =>
    new Map(kids.filter((k) => k.id !== dragged.id).map((k) => [k.id, { ...k.pose, x: k.pose.x + 100 }])),
  commitDrop: (_c: unknown, _k: unknown, dragged: { id: string; originPose: RectPose }, target: { pose: RectPose }) =>
    [ops.setPose<RectPose>({ id: dragged.id, from: dragged.originPose, to: target.pose, label: 'Drop' })],
} as unknown as LayoutStrategy<unknown>;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('moveAction with swapOnDrop: dwell, inside a layout container', () => {
  it('previews the armed swap rather than the layout making room, and commits the swap', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ id: L, kind: 'group', layer: 'main', data: {}, pose: box(0, 0, 300, 100) });
    scene.add({ id: A, kind: 'mark', layer: 'main', parent: L, data: {}, pose: box(0, 0) });
    scene.add({ id: B, kind: 'mark', layer: 'main', parent: L, data: {}, pose: box(50, 0) });
    const nodeAtPoint = (p: { x: number; y: number }, exclude?: Iterable<NodeId>) => {
      const out = new Set(exclude ?? []);
      return !out.has(B) && p.x >= 50 && p.x <= 60 && p.y >= 0 && p.y <= 10 ? B : null;
    };
    const deps = { operands: { get: () => [A] }, scene, nodeAtPoint, layout: { getLayout: (id: string) => (id === L ? layout : null) } };
    const at = (x: number, y: number) => ({
      world: { x, y }, screen: { x, y }, modifiers: MODS, deps,
      drag: { start: { x: 5, y: 5 }, current: { x, y }, delta: { x: x - 5, y: y - 5 } },
    }) as unknown as InvocationCtx;
    const h = (moveAction.invoker as OngoingInvoker).start(
      { world: { x: 5, y: 5 }, screen: { x: 5, y: 5 }, modifiers: MODS, deps } as unknown as InvocationCtx,
      { params: { swapOnDrop: 'dwell' } },
    ) as OngoingHandle;
    h.onMove!(at(55, 5));
    vi.advanceTimersByTime(1000);
    h.onMove!(at(56, 5));
    expect(scene.overrides.read(B)?.pose).toEqual(box(0, 0));
    h.onEnd!(at(56, 5), 'commit');
    expect(scene.get(A)!.pose).toEqual(box(50, 0));
    expect(scene.get(B)!.pose).toEqual(box(0, 0));
  });
});
