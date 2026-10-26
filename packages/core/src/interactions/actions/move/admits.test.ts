/** Drop admission: with no `canDropInto` dep a group takes a drop and a mark does not. */
import { describe, it, expect } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { moveAction } from './action';

const A = asNodeId('a');
const OUTER = asNodeId('outer');
const GROUP = asNodeId('group');
const MARK = asNodeId('mark');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };

function makeScene() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const at = (x: number): RectPose => ({ x, y: x, width: 100, height: 100 });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } });
  scene.add({ id: OUTER, kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 400, height: 400 } });
  scene.add({ id: GROUP, kind: 'group', layer: 'main', parent: OUTER, data: {}, pose: at(150) });
  scene.add({ id: MARK, kind: 'mark', layer: 'main', parent: OUTER, data: {}, pose: at(300) });
  return scene;
}

function dropOnto(target: string, deps: object = {}) {
  const scene = makeScene();
  const base = { world: { x: 5, y: 5 }, modifiers: MODS, deps: { selection: { get: () => [A] }, scene, nodeAtPoint: () => target, ...deps } };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(base as unknown as InvocationCtx, { params: { reparentOnDrop: 'top' } } as BindingOpts);
  const d = { start: { x: 5, y: 5 }, current: { x: 200, y: 200 }, delta: { x: 195, y: 195 } };
  const at = { ...base, world: d.current, drag: d } as unknown as InvocationCtx;
  handle.onMove!(at);
  handle.onEnd!(at, 'commit');
  return scene.get(A)!.parent;
}

describe('moveAction — default drop admission', () => {
  it('lands inside a group', () => {
    expect(dropOnto(GROUP)).toBe(GROUP);
  });

  it('lands beside a mark', () => {
    expect(dropOnto(MARK)).toBe(OUTER);
  });

  it('lands inside a mark when canDropInto says so', () => {
    expect(dropOnto(MARK, { canDropInto: (parent: string) => parent === MARK })).toBe(MARK);
  });
});
