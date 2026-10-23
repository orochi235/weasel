/**
 * Reparent-on-drop of a node grabbed while a reflow transition is still gliding
 * it: the drag is measured from where the node was shown, not from the pose the
 * document holds.
 */
import { describe, it, expect } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { ReflowTransition } from '../../../layout/types';
import { moveAction } from './action';
import { heldPose } from '../testUtils';

const A = asNodeId('a');
const KID = asNodeId('kid');
const T = asNodeId('target');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const box = (x: number, y: number): RectPose => ({ x, y, width: 10, height: 10 });

/** `gliding` shown 20 short of its document pose by a reflow still running. */
function fixture(gliding: NodeId, selected: NodeId[]) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 30, height: 30 } });
  scene.add({ id: KID, kind: 'mark', layer: 'main', parent: A, data: {}, pose: box(10, 10) });
  scene.add({ id: T, kind: 'group', layer: 'main', data: {}, pose: { x: 40, y: 0, width: 100, height: 100 } });
  const home = scene.get(gliding)!.pose;
  const shown: RectPose = { ...home, x: home.x - 20 };
  const glide = scene.overrides.hold();
  glide.set([[gliding, shown]]);
  const reflow: ReflowTransition<unknown> = {
    glide: () => {},
    settle: () => { glide.set([]); },
    stop: () => { glide.set([]); },
    poseOf: (id) => (id === gliding ? shown : undefined),
  };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(
    {
      world: { x: 5, y: 5 },
      modifiers: MODS,
      deps: {
        selection: { get: () => selected },
        scene: scene as unknown as Scene<unknown, string, unknown>,
        nodeAtPoint: () => T,
        layout: { getLayout: () => null, reflow },
      },
    } as unknown as InvocationCtx,
    { params: { reparentOnDrop: 'top' } },
  );
  const at = { start: { x: 5, y: 5 }, current: { x: 55, y: 5 }, delta: { x: 50, y: 0 } };
  const ctx = { world: { x: 55, y: 5 }, modifiers: MODS, deps: {}, drag: at } as unknown as InvocationCtx;
  handle.onMove!(ctx);
  const preview = (id: NodeId) => heldPose(scene, id as string) as RectPose;
  const shownAtDrop = { a: preview(A), kid: preview(KID) };
  handle.onEnd!(ctx, 'commit');
  return { scene, shownAtDrop };
}

describe('moveAction — reparentOnDrop of a node caught mid-glide', () => {
  it('lands a caught root where the drag showed it', () => {
    const { scene, shownAtDrop } = fixture(A, [A]);
    expect(shownAtDrop.a).toMatchObject({ x: 30, y: 0 });
    expect(scene.get(A)!.parent).toBe(T);
    expect(scene.get(A)!.pose).toEqual(shownAtDrop.a);
  });

  it('lands a caught descendant of the dragged root where the drag showed it', () => {
    const { scene, shownAtDrop } = fixture(KID, [A]);
    expect(shownAtDrop.kid).toMatchObject({ x: 40, y: 10 });
    expect(scene.get(A)!.parent).toBe(T);
    expect(scene.get(KID)!.pose).toEqual(shownAtDrop.kid);
  });
});
