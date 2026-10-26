/**
 * The `canDropInto` dep: a container it refuses takes no drop, whichever pass
 * would have put the dragged nodes into it — reparent-on-drop, a layout drop,
 * or a layout exit landing on the plain container under the drop.
 */
import { describe, it, expect } from 'vitest';
import type { BindingOpts, InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { createTransformOp } from 'core/ops/transform';
import { asNodeId, type NodeId, type RectPose } from 'core/scene/types';
import type { LayoutStrategy } from '../../../layout/types';
import { moveAction } from './action';

const A = asNodeId('a');
const OUTER = asNodeId('outer');
const INNER = asNodeId('inner');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const HOME: RectPose = { x: 0, y: 0, width: 10, height: 10 };

function makeScene(home?: NodeId) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  if (home) scene.add({ id: home, kind: 'group', layer: 'main', data: {}, pose: { x: -50, y: -50, width: 70, height: 70 } });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: HOME, ...(home ? { parent: home } : {}) });
  scene.add({ id: OUTER, kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 300, height: 300 } });
  scene.add({ id: INNER, kind: 'group', layer: 'main', parent: OUTER, data: {}, pose: { x: 50, y: 50, width: 100, height: 100 } });
  return scene;
}

function drag(
  scene: ReturnType<typeof makeScene>,
  deps: object,
  params: Record<string, unknown> = {},
  to = 200,
) {
  const base = { world: { x: 5, y: 5 }, modifiers: MODS, deps: { selection: { get: () => [A] }, scene, ...deps } };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(base as unknown as InvocationCtx, { params } as BindingOpts);
  const d = { start: { x: 5, y: 5 }, current: { x: to, y: to }, delta: { x: to - 5, y: to - 5 } };
  const at = { ...base, world: d.current, drag: d } as unknown as InvocationCtx;
  handle.onMove!(at);
  handle.onEnd!(at, 'commit');
}

const refuseInner = (parent: string) => parent !== INNER;

describe('moveAction — canDropInto', () => {
  it('reparent-on-drop passes over a refused container to the next one up', () => {
    const scene = makeScene();
    drag(scene, { nodeAtPoint: () => INNER, canDropInto: refuseInner }, { reparentOnDrop: 'top' });
    expect(scene.get(A)!.parent).toBe(OUTER);
  });

  it('reparent-on-drop lands at the top level when every container refuses', () => {
    const scene = makeScene();
    drag(scene, { nodeAtPoint: () => INNER, canDropInto: () => false }, { reparentOnDrop: 'top' });
    expect(scene.get(A)!.parent).toBe(null);
  });

  it('a layout drop skips a refused container for the one around it', () => {
    const scene = makeScene();
    const free = {
      snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
      childPoses: () => new Map(),
      getDropTargets: (_c: unknown, _k: unknown, d: { pose: RectPose }) => [{ pose: d.pose, origin: { x: d.pose.x, y: d.pose.y } }],
      reflowPoses: () => new Map(),
      commitDrop: (_c: unknown, _k: unknown, d: { id: string; originPose: RectPose; pose: RectPose }) =>
        [createTransformOp<RectPose>({ id: d.id, from: d.originPose, to: d.pose, label: 'Drop' })],
    } as unknown as LayoutStrategy<unknown>;
    const asked: [string, readonly string[]][] = [];
    const canDropInto = (parent: string, ids: readonly string[]) => {
      asked.push([parent, ids]);
      return parent !== INNER;
    };
    drag(scene, { layout: { getLayout: () => free }, canDropInto });
    expect(scene.get(A)!.parent).toBe(OUTER);
    expect(asked).toContainEqual([INNER, [A]]);
  });

  it('a child leaving its layout container does not land in a refused plain container', () => {
    const home = asNodeId('home');
    const scene = makeScene(home);
    const keeps = {
      snap: { pickTarget: () => null },
      childPoses: () => new Map(),
      getDropTargets: () => [],
      reflowPoses: () => new Map(),
      commitDrop: () => [],
    } as unknown as LayoutStrategy<unknown>;
    drag(scene, { layout: { getLayout: (id: NodeId) => (id === home ? keeps : null) }, canDropInto: refuseInner });
    expect(scene.get(A)!.parent).toBe(OUTER);
  });
});
