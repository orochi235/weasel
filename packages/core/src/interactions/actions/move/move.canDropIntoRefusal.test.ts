/**
 * A `canDropInto` refusal with a reason: the drag over the container draws it
 * refused with the reason at the pointer, and a release there moves nothing.
 * A silent `false` still passes the container over.
 */
import { describe, it, expect, vi } from 'vitest';
import type { BindingOpts, InvocationCtx, OngoingOverlay } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { createTransformOp } from 'core/ops/transform';
import { asNodeId, type RectPose } from 'core/scene/types';
import type { DropVerdict } from '../dropVerdict';
import type { LayoutStrategy } from '../../../layout/types';
import { moveAction } from './action';

const A = asNodeId('a');
const OUTER = asNodeId('outer');
const INNER = asNodeId('inner');
const MODS = { alt: false, ctrl: false, meta: false, shift: false };
const HOME: RectPose = { x: 0, y: 0, width: 10, height: 10 };

const free = {
  snap: { pickTarget: (targets: unknown[]) => targets[0] ?? null },
  childPoses: () => new Map(),
  getDropTargets: (_c: unknown, _k: unknown, d: { pose: RectPose }) => [{ pose: d.pose, origin: { x: d.pose.x, y: d.pose.y } }],
  reflowPoses: () => new Map(),
  commitDrop: (_c: unknown, _k: unknown, d: { id: string; originPose: RectPose; pose: RectPose }) =>
    [createTransformOp<RectPose>({ id: d.id, from: d.originPose, to: d.pose, label: 'Drop' })],
} as unknown as LayoutStrategy<unknown>;

function makeScene() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'mark', layer: 'main', data: {}, pose: HOME });
  scene.add({ id: OUTER, kind: 'group', layer: 'main', data: {}, pose: { x: 100, y: 100, width: 300, height: 300 } });
  scene.add({ id: INNER, kind: 'group', layer: 'main', parent: OUTER, data: {}, pose: { x: 50, y: 50, width: 100, height: 100 } });
  return scene;
}

function drag(canDropInto: (parent: string) => DropVerdict, deps: object = {}, params: Record<string, unknown> = {}) {
  const scene = makeScene();
  const onGestureEnd = vi.fn();
  const base = {
    world: { x: 5, y: 5 },
    modifiers: MODS,
    deps: { selection: { get: () => [A] }, scene, layout: { getLayout: () => free }, canDropInto, ...deps },
  };
  const invoker = moveAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(base as unknown as InvocationCtx, { params: { onGestureEnd, ...params } } as BindingOpts);
  const d = { start: { x: 5, y: 5 }, current: { x: 200, y: 200 }, delta: { x: 195, y: 195 } };
  const at = { ...base, world: d.current, drag: d } as unknown as InvocationCtx;
  handle.onMove!(at);
  const raw = handle.overlay?.() ?? [];
  const overlays = (Array.isArray(raw) ? raw : [raw]) as OngoingOverlay[];
  handle.onEnd!(at, 'commit');
  return { scene, overlays, onGestureEnd };
}

const refuseInner = (parent: string): DropVerdict => (parent === INNER ? { refuse: 'Inner is full' } : true);

describe('moveAction — a canDropInto refusal with a reason', () => {
  it('draws the refused container and the reason at the pointer while over it', () => {
    const { overlays } = drag(refuseInner);
    expect(overlays).toContainEqual({ kind: 'reason', at: { x: 200, y: 200 }, text: 'Inner is full' });
    const outline = overlays.find((o) => o.kind === 'polyline');
    expect(outline).toMatchObject({ kind: 'polyline', role: 'refused' });
    const xs = (outline as { points: readonly { x: number; y: number }[] }).points.map((p) => p.x);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([150, 250]);
  });

  it('moves nothing on a release over it, and reports no commit', () => {
    const { scene, onGestureEnd } = drag(refuseInner);
    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual(HOME);
    expect(onGestureEnd).toHaveBeenCalledWith(false);
  });

  it('a silent false still passes the container over, and draws nothing', () => {
    const { scene, overlays } = drag((parent) => parent !== INNER);
    expect(scene.get(A)!.parent).toBe(OUTER);
    expect(overlays).toEqual([]);
  });

  it('refuses the same way when reparent-on-drop finds the container under the pointer', () => {
    const { scene, overlays } = drag(refuseInner, { layout: undefined, nodeAtPoint: () => INNER }, { reparentOnDrop: 'top' });
    expect(overlays).toContainEqual({ kind: 'reason', at: { x: 200, y: 200 }, text: 'Inner is full' });
    expect(scene.get(A)!.parent).toBe(null);
    expect(scene.get(A)!.pose).toEqual(HOME);
  });
});
