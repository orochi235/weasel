/**
 * Reparent-on-drop against the end context the dispatcher really hands over.
 * It pumps `onEnd` with an empty deps bag, and `cancelAll('commit')` ends a
 * gesture with no drag and a world point of (0, 0).
 */
import { describe, it, expect, vi } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import type { NodeAtPointDep } from '../depSchema';
import { moveAction } from './action';

const A = asNodeId('a');
const T = asNodeId('target');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 40, y: 0, width: 100, height: 100 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function startAndMove(
  scene: Scene<unknown, string, unknown>,
  nodeAtPoint: NodeAtPointDep,
  params: BindingOpts['params'] = { reparentOnDrop: 'top' },
) {
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(
    {
      world: { x: 5, y: 5 },
      modifiers: MODS,
      deps: { selection: { get: () => [A] as NodeId[] }, scene, nodeAtPoint },
    } as unknown as InvocationCtx,
    { params },
  );
  handle.onMove!({
    world: { x: 55, y: 5 },
    modifiers: MODS,
    deps: {},
    drag: { start: { x: 5, y: 5 }, current: { x: 55, y: 5 }, delta: { x: 50, y: 0 } },
  } as unknown as InvocationCtx);
  return handle;
}

describe('moveAction — reparentOnDrop as the dispatcher ends it', () => {
  it('reparents on a release whose context carries no deps', () => {
    const scene = makeScene();
    const nodeAtPoint = vi.fn<NodeAtPointDep>(() => T);
    const handle = startAndMove(scene, nodeAtPoint);
    handle.onEnd!({
      world: { x: 60, y: 5 },
      modifiers: MODS,
      deps: {},
      drag: { start: { x: 5, y: 5 }, current: { x: 60, y: 5 }, delta: { x: 55, y: 0 } },
    } as unknown as InvocationCtx, 'commit');

    expect(nodeAtPoint.mock.calls[0][0]).toEqual({ x: 60, y: 5 });
    expect(scene.get(A)!.parent).toBe(T);
  });

  it('hit-tests the last pointer it saw when the end carries no pointer', () => {
    const scene = makeScene();
    const nodeAtPoint = vi.fn<NodeAtPointDep>(() => T);
    const handle = startAndMove(scene, nodeAtPoint);
    handle.onEnd!({ world: { x: 0, y: 0 }, modifiers: MODS, deps: {} } as unknown as InvocationCtx, 'commit');

    expect(nodeAtPoint.mock.calls[0][0]).toEqual({ x: 55, y: 5 });
    expect(scene.get(A)!.parent).toBe(T);
  });

  it('reads a thunked reparentOnDrop at release', () => {
    const scene = makeScene();
    const nodeAtPoint = vi.fn<NodeAtPointDep>(() => T);
    let mode = 'off';
    const handle = startAndMove(scene, nodeAtPoint, () => ({ reparentOnDrop: mode }));
    mode = 'top';
    handle.onEnd!({
      world: { x: 60, y: 5 },
      modifiers: MODS,
      deps: {},
      drag: { start: { x: 5, y: 5 }, current: { x: 60, y: 5 }, delta: { x: 55, y: 0 } },
    } as unknown as InvocationCtx, 'commit');

    expect(scene.get(A)!.parent).toBe(T);
  });
});
