/**
 * Reparent-on-drop of a container, on a scene with the default absolute
 * poses: its children store world coordinates of their own.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { InvocationCtx } from '@weasel-js/routing';
import type { NodeAtPointDep } from '../depSchema';
import { moveAction } from './action';

const G = asNodeId('g');
const C = asNodeId('c');
const T = asNodeId('target');

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: G, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 20, height: 20 } });
  scene.add({ id: C, kind: 'mark', layer: 'main', parent: G, data: {}, pose: { x: 5, y: 5, width: 10, height: 10 } });
  scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 40, y: 0, width: 100, height: 100 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function dragOntoTarget(scene: Scene<unknown, string, unknown>, dx: number) {
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const nodeAtPoint: NodeAtPointDep = () => T;
  const base = {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [G] as NodeId[] }, scene, nodeAtPoint },
  };
  const drag = { start: { x: 0, y: 0 }, current: { x: dx, y: 0 }, delta: { x: dx, y: 0 } };
  const handle = invoker.start(base as unknown as InvocationCtx, { params: { reparentOnDrop: 'top' } });
  handle.onMove!({ ...base, drag } as unknown as InvocationCtx);
  handle.onEnd!({ ...base, world: { x: dx, y: 0 }, drag } as unknown as InvocationCtx, 'commit');
}

describe('moveAction — reparentOnDrop of a container with children', () => {
  it('brings the children to where the drag left them', () => {
    const scene = makeScene();
    dragOntoTarget(scene, 50);
    expect(scene.get(G)!.parent).toBe(T);
    expect(scene.get(G)!.pose).toEqual({ x: 50, y: 0, width: 20, height: 20 });
    expect(scene.get(C)!.parent).toBe(G);
    expect(scene.get(C)!.pose).toEqual({ x: 55, y: 5, width: 10, height: 10 });
  });

  it('undoes the reparent and the children in one step', () => {
    const scene = makeScene();
    dragOntoTarget(scene, 50);
    scene.undo();
    expect(scene.get(G)!.parent).toBeNull();
    expect(scene.get(G)!.pose).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(scene.get(C)!.pose).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });
});
