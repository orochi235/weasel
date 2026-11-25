/**
 * A layout child and a plain root dragged together out of the layout: the
 * plain root lands by reparent-on-drop, as it would dragged alone.
 */
import { describe, expect, it } from 'vitest';
import type { BindingOptions, InvocationCtx } from '@weasel-js/routing';
import { asNodeId, createScene, type LayoutStrategy, type RectPose } from '@weasel-js/core/engine';
import { moveAction } from './action';

const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const G = asNodeId('g');
const N = asNodeId('n');
const P = asNodeId('p');
const T = asNodeId('t');
const stack = { childPoses: () => new Map() } as unknown as LayoutStrategy<unknown>;

describe('moveAction — a plain root dragged out beside a layout child', () => {
  it('is reparented under the node it is let go over', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ id: G, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 40, height: 40 } });
    scene.add({ id: N, kind: 'mark', layer: 'main', parent: G, data: {}, pose: { x: 5, y: 10, width: 20, height: 10 } });
    scene.add({ id: P, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 50, width: 10, height: 10 } });
    scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 200, y: 0, width: 100, height: 100 } });
    const from = { x: 15, y: 15 };
    const deps = {
      operands: { get: () => [N, P] }, scene, nodeAtPoint: () => T,
      layout: { getLayout: (id: string) => (id === G ? stack : null) },
    };
    const base = { world: from, modifiers: MODS, deps };
    const invoker = moveAction.invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(base as unknown as InvocationCtx, { params: { reparentOnDrop: 'into' } } as BindingOptions);
    const to = { x: 235, y: 15 };
    const at = { ...base, world: to, drag: { start: from, current: to, delta: { x: 220, y: 0 } } } as unknown as InvocationCtx;
    handle.onMove!(at);
    handle.onEnd!(at, 'commit');
    expect(scene.get(N)!.parent).toBe(T);
    expect(scene.get(P)!.parent).toBe(T);
    expect(scene.get(P)!.pose).toEqual({ x: 20, y: 50, width: 10, height: 10 });
  });
});
