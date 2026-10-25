import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import type { RenderLayer } from '@weasel-js/core';
import { createScene } from '@weasel-js/core';
import type { NodeId, RectPose } from '@weasel-js/core';
import { jointPositions } from '@weasel-js/animator';
import { placeSkeleton } from '@weasel-js/core';
import type { Skin } from '@weasel-js/animator';
import type { Skeleton } from '@weasel-js/animator';
import { createRigEditState } from './rigEditState';
import { useBoneTool } from './useBoneTool';
import { JOINT_RADIUS_PX } from './boneOverlay';
import { boundsOfPath } from '@weasel-js/geom';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import type { ReactNode } from 'react';

type Data = { skeleton?: Skeleton; skin?: Skin; label?: string };

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const MODS = { alt: false, ctrl: false, meta: false, shift: false };

function setup(settings?: KitSettingsOverrides) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const rig = scene.add({ kind: 'group', layer: 'main', pose: { x: 100, y: 100, width: 200, height: 100 }, data: { label: 'arm' } });
  const sleeve = scene.add({
    kind: 'mark', layer: 'main', parent: rig, pose: { x: 100, y: 100, width: 10, height: 10 },
    data: { skin: { joint: [1, 0], joint2: [0, 1] } },
  });
  let target: NodeId | null = rig;
  const state = createRigEditState();
  const { result } = renderHook(() => useBoneTool({ scene: scene as never, rig: () => target, state }), {
    ...(settings ? { wrapper: ({ children }: { children: ReactNode }) => <KitSettingsProvider value={settings}>{children}</KitSettingsProvider> } : {}),
  });
  const deps = { view: { get: () => VIEW, set: () => {} } } as unknown as ActionDeps;
  const actionOf = (id: string): Action => {
    const a = (result.current.actions ?? []).find((x) => x.id === id);
    if (!a) throw new Error(`${id} not declared on the tool`);
    return a;
  };
  const ctx = (x: number, y: number, from = { x, y }): InvocationCtx => ({
    world: { x, y }, screen: { x, y }, modifiers: MODS, deps,
    drag: { start: from, current: { x, y }, delta: { x: x - from.x, y: y - from.y } },
  });
  /** Press at `from`, move to `to`, and release or cancel. */
  const drag = (from: [number, number], to: [number, number], reason: 'commit' | 'cancel' = 'commit', peek?: () => void) => {
    const invoker = actionOf('bone.drag').invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('bone.drag is not ongoing');
    const handle = invoker.start(ctx(from[0], from[1]), undefined);
    handle.onMove?.(ctx(to[0], to[1], { x: from[0], y: from[1] }));
    peek?.();
    handle.onEnd?.({ ...ctx(to[0], to[1]), deps: {} as ActionDeps }, reason);
    return handle;
  };
  const fire = (id: string, params?: Record<string, unknown>): boolean => {
    const action = actionOf(id);
    if (action.enabled && action.enabled(deps) !== true) return false;
    if (action.invoker?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
    action.invoker.run(deps, params);
    return true;
  };
  const joints = (): [string, number, number][] => {
    const node = scene.get(rig)!;
    const skeleton = node.data.skeleton;
    if (!skeleton) return [];
    return [...jointPositions(placeSkeleton(skeleton, node.pose))].map(([n, p]) => [n, Math.round(p.x), Math.round(p.y)]);
  };
  const painted = () => (result.current.overlay as RenderLayer<unknown>).draw(undefined, VIEW, { width: 400, height: 400, dpr: 1 });
  return { scene, rig, sleeve, state, drag, fire, joints, painted, setTarget: (id: NodeId | null) => { target = id; } };
}

describe('useBoneTool', () => {
  it('sizes its joint dots from targets.boneJointRadiusPx, else JOINT_RADIUS_PX', () => {
    const jointWidths = (t: ReturnType<typeof setup>) => t.painted()
      .flatMap((c) => (c.kind === 'path' && c.fill ? [boundsOfPath(c.path).width] : []));
    const plain = setup();
    plain.drag([120, 150], [200, 150]);
    expect(new Set(jointWidths(plain))).toEqual(new Set([2 * JOINT_RADIUS_PX]));
    const set = setup({ targets: { boneJointRadiusPx: 7 } });
    set.drag([120, 150], [200, 150]);
    expect(new Set(jointWidths(set))).toEqual(new Set([14]));
  });

  it('draws a first bone from the press to the release, kept relative to the node\'s box', () => {
    const t = setup();
    t.drag([120, 150], [200, 150]);
    expect(t.joints()).toEqual([['joint', 120, 150], ['joint2', 200, 150]]);
    expect(t.scene.get(t.rig)!.data.skeleton!.joints[0].bind).toMatchObject({ x: 20, y: 50 });
    expect(t.scene.get(t.rig)!.data.label).toBe('arm');
    expect(t.state.active()).toBe('joint2');
  });

  it('draws the next bone from the active joint, wherever the press lands', () => {
    const t = setup();
    t.drag([120, 150], [200, 150]);
    t.drag([300, 300], [260, 180]);
    expect(t.joints()).toEqual([['joint', 120, 150], ['joint2', 200, 150], ['joint3', 260, 180]]);
    expect(t.scene.get(t.rig)!.data.skeleton!.joints[2].parent).toBe('joint2');
  });

  it('moves a pressed joint by the drag, carrying the joints under it, as one undo entry', () => {
    const t = setup();
    t.drag([120, 150], [200, 150]);
    t.drag([123, 152], [133, 172]);
    expect(t.joints()).toEqual([['joint', 130, 170], ['joint2', 210, 170]]);
    expect(t.state.active()).toBe('joint');
    t.scene.undo();
    expect(t.joints()).toEqual([['joint', 120, 150], ['joint2', 200, 150]]);
  });

  it('shows the bone being drawn, and leaves the document alone on a cancel', () => {
    const t = setup();
    let during = 0;
    t.drag([120, 150], [200, 150], 'cancel', () => { during = t.painted().length; });
    // One bone and two joints.
    expect(during).toBe(3);
    expect(t.painted()).toEqual([]);
    expect(t.scene.get(t.rig)!.data.skeleton).toBeUndefined();
    expect(t.state.active()).toBeNull();
  });

  it('picks the joint under a click and clears on a click elsewhere', () => {
    const t = setup();
    t.drag([120, 150], [200, 150]);
    t.fire('bone.pick', { pressX: 118, pressY: 151 });
    expect(t.state.active()).toBe('joint');
    t.fire('bone.pick', { pressX: 300, pressY: 300 });
    expect(t.state.active()).toBeNull();
  });

  it('removes the active joint with those under it and their weights, as one undo entry', () => {
    const t = setup();
    t.drag([120, 150], [200, 150]);
    t.drag([0, 0], [260, 180]);
    t.state.setActive('joint2');
    expect(t.fire('bone.remove')).toBe(true);
    expect(t.joints()).toEqual([['joint', 120, 150]]);
    expect(t.scene.get(t.sleeve)!.data.skin).toEqual({ joint: [1, 0] });
    expect(t.state.active()).toBe('joint');
    t.scene.undo();
    expect(t.joints()).toHaveLength(3);
    expect(t.scene.get(t.sleeve)!.data.skin).toEqual({ joint: [1, 0], joint2: [0, 1] });
  });

  it('declines Delete and Escape with no joint active, and everything with no rig', () => {
    const t = setup();
    expect(t.fire('bone.remove')).toBe(false);
    expect(t.fire('bone.clear')).toBe(false);
    t.setTarget(null);
    expect(t.fire('bone.pick', { pressX: 0, pressY: 0 })).toBe(false);
    expect(t.drag([0, 0], [10, 10])).toEqual({});
  });
});
