/**
 * Reparent-on-drop of a container: it lands in the target's frame, and its
 * children ride in its own.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { InvocationCtx } from '@weasel-js/routing';
import type { NodeAtPointDep } from '../depSchema';
import { unionOfChildren } from 'core/scene/kitRegistry';
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

function dragOntoTarget(scene: Scene<unknown, string, unknown>, dx: number, selected: NodeId[] = [G]) {
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const nodeAtPoint: NodeAtPointDep = () => T;
  const base = {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => selected }, scene, nodeAtPoint },
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
    expect(scene.get(G)!.pose).toEqual({ x: 10, y: 0, width: 20, height: 20 });
    expect(scene.get(C)!.parent).toBe(G);
    expect(scene.get(C)!.pose).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });

  it('keeps a selected child in its container, riding in its frame', () => {
    const scene = makeScene();
    dragOntoTarget(scene, 50, [G, C]);
    expect(scene.get(G)!.parent).toBe(T);
    expect(scene.get(C)!.parent).toBe(G);
    expect(scene.get(C)!.pose).toEqual({ x: 5, y: 5, width: 10, height: 10 });
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

describe('moveAction — reparentOnDrop of an envelope', () => {
  it('stores its children in the target\'s frame, where the drag left them', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({
      id: G, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 },
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    scene.add({ id: C, kind: 'mark', layer: 'main', parent: G, data: {}, pose: { x: 5, y: 5, width: 10, height: 10 } });
    scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 40, y: 0, width: 100, height: 100 } });
    dragOntoTarget(scene as unknown as Scene<unknown, string, unknown>, 50);
    expect(scene.get(G)!.parent).toBe(T);
    // World x 55, in the target's frame at x 40.
    expect(scene.get(C)!.pose).toEqual({ x: 15, y: 5, width: 10, height: 10 });
  });

  it('takes its children, a selected one too, onto the target\'s layer, where the drag left them', () => {
    const D = asNodeId('d');
    const scene = createScene<unknown, 'main' | 'top', RectPose>({ systemLayers: [{ id: 'main' }, { id: 'top' }] });
    scene.add({
      id: G, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 },
      dependsOn: 'children', derivePose: unionOfChildren,
    });
    scene.add({ id: C, kind: 'mark', layer: 'main', parent: G, data: {}, pose: { x: 5, y: 5, width: 10, height: 10 } });
    scene.add({ id: D, kind: 'mark', layer: 'main', parent: G, data: {}, pose: { x: 20, y: 5, width: 10, height: 10 } });
    scene.add({ id: T, kind: 'group', layer: 'top', data: {}, pose: { x: 40, y: 0, width: 100, height: 100 } });
    dragOntoTarget(scene as unknown as Scene<unknown, string, unknown>, 50, [G, C]);
    expect(scene.get(G)!.parent).toBe(T);
    for (const id of [G, C, D]) expect(scene.get(id)!.layer).toBe('top');
    expect(scene.get(C)!.parent).toBe(G);
    expect(scene.get(D)!.parent).toBe(G);
    // World x 55 and 70, in the target's frame at x 40.
    expect(scene.get(C)!.pose).toEqual({ x: 15, y: 5, width: 10, height: 10 });
    expect(scene.get(D)!.pose).toEqual({ x: 30, y: 5, width: 10, height: 10 });
  });
});
