import { describe, it, expect } from 'vitest';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose, type Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { moveAction } from '../move/action';
import { rotateAction } from '../rotate/action';
import { resizeAction } from '../resize/action';
import { cloneAction } from '../clone/action';
import { duplicateAction } from '../defaults/duplicate';
import { nudgeRightAction } from '../defaults/nudge';
import { transformAgainAction } from './action';
import { lastTransform, recordTransform } from './memory';

type AnyScene = Scene<unknown, string, unknown>;

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

function setup(poses: RectPose[] = [box(0, 0)]) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const ids = poses.map((pose) => scene.add({ kind: 'mark', layer: 'main', data: {}, pose }) as string);
  let current: string[] = [...ids];
  const selection = {
    get: () => current,
    set: (next: string[]) => { current = [...next]; },
  } as unknown as SelectionApi;
  const s = scene as unknown as AnyScene;
  const deps = { scene: s, selection, resizePolicy: { constraints: [], expandIds: (x: string[]) => x } };
  const pose = (id: string) => scene.get(id as never)!.pose as RectPose;
  const ctx = (world: { x: number; y: number }, extra: Record<string, unknown> = {}) => ({
    world,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
    ...extra,
  }) as unknown as InvocationCtx;
  const immediate = (a: { invoker?: unknown }) => (a.invoker as ImmediateInvoker).run(deps as never);
  return { scene: s, ids, selection, deps, pose, ctx, immediate, again: () => immediate(transformAgainAction) };
}

type Rig = ReturnType<typeof setup>;

function drag(rig: Rig, action: { invoker?: unknown }, from: { x: number; y: number }, to: { x: number; y: number }, extra: Record<string, unknown> = {}, opts?: unknown) {
  const at = (p: { x: number; y: number }) => rig.ctx(p, {
    drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y }, ...extra },
  });
  const handle = (action.invoker as OngoingInvoker).start(at(from), opts as never);
  handle.onMove!(at(to));
  handle.onEnd!(at(to), 'commit');
}

describe('transformAgain', () => {
  it('repeats a move', () => {
    const rig = setup();
    drag(rig, moveAction, { x: 5, y: 5 }, { x: 25, y: 15 });
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 20, y: 10 });
    expect(lastTransform(rig.scene)).toEqual({ kind: 'translate', dx: 20, dy: 10 });
    rig.again();
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 40, y: 20 });
  });

  it('repeats a nudge', () => {
    const rig = setup();
    rig.immediate(nudgeRightAction);
    expect(lastTransform(rig.scene)).toEqual({ kind: 'translate', dx: 1, dy: 0 });
    rig.again();
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 2, y: 0 });
  });

  it('repeats a rotation about the selection center', () => {
    const rig = setup([{ ...box(0, 0, 20, 10), rotation: 0 }]);
    const center = { x: 10, y: 5 };
    const at = (a: number) => ({ x: center.x + 50 * Math.cos(a), y: center.y + 50 * Math.sin(a) });
    drag(rig, rotateAction, at(0), at(0.3), {}, { behaviors: [] });
    expect(rig.pose(rig.ids[0]).rotation).toBeCloseTo(0.3, 9);
    const t = lastTransform(rig.scene);
    expect(t?.kind).toBe('rotate');
    rig.again();
    expect(rig.pose(rig.ids[0]).rotation).toBeCloseTo(0.6, 9);
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 0, y: 0, width: 20, height: 10 });
  });

  it('turns a multi-selection about its union center again', () => {
    const rig = setup([{ ...box(0, 0), rotation: 0 }, { ...box(30, 0), rotation: 0 }]);
    const center = { x: 20, y: 5 };
    const at = (a: number) => ({ x: center.x + 50 * Math.cos(a), y: center.y + 50 * Math.sin(a) });
    drag(rig, rotateAction, at(0), at(Math.PI / 2), {}, { behaviors: [] });
    rig.again();
    // Two quarter turns about (20, 5) swap the boxes.
    const a = rig.pose(rig.ids[0]);
    const b = rig.pose(rig.ids[1]);
    expect(a.x).toBeCloseTo(30, 6);
    expect(a.y).toBeCloseTo(0, 6);
    expect(b.x).toBeCloseTo(0, 6);
    expect(b.rotation).toBeCloseTo(Math.PI, 9);
  });

  it('repeats a resize about the corner it held', () => {
    const rig = setup([box(10, 10)]);
    const affordance = { kind: 'handle:bottom-right', targetIds: rig.ids, anchor: { x: 'min', y: 'min' } };
    drag(rig, resizeAction, { x: 20, y: 20 }, { x: 30, y: 25 }, { affordance });
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 10, y: 10, width: 20, height: 15 });
    expect(lastTransform(rig.scene)).toEqual({
      kind: 'scale', to: { x: 0, y: 0, width: 2, height: 1.5 }, anchor: { x: 'min', y: 'min' },
    });
    rig.again();
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 10, y: 10, width: 40, height: 22.5 });
  });

  it('repeats a resize held at the far corner on another selection', () => {
    const rig = setup([box(10, 10), box(100, 100, 20, 20)]);
    rig.selection.set([asNodeId(rig.ids[0])]);
    const affordance = { kind: 'handle:top-left', targetIds: [rig.ids[0]], anchor: { x: 'max', y: 'max' } };
    drag(rig, resizeAction, { x: 10, y: 10 }, { x: 0, y: 0 }, { affordance });
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 0, y: 0, width: 20, height: 20 });
    rig.selection.set([asNodeId(rig.ids[1])]);
    rig.again();
    expect(rig.pose(rig.ids[1])).toMatchObject({ x: 80, y: 80, width: 40, height: 40 });
  });

  it('duplicates when there is nothing to repeat', () => {
    const rig = setup([box(0, 0)]);
    rig.again();
    const [copy] = rig.selection.get();
    expect(copy).not.toBe(rig.ids[0]);
    expect(rig.pose(copy)).toMatchObject({ x: 12, y: 12 });
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 0, y: 0 });
  });

  it('makes a step-and-repeat from a duplicate whose copy was then moved', () => {
    const rig = setup([box(0, 0)]);
    rig.immediate(duplicateAction);
    const [first] = rig.selection.get();
    // The copy lands at (12, 12); dragging it to (30, 0) sets the step.
    drag(rig, moveAction, { x: 15, y: 15 }, { x: 33, y: 3 });
    expect(rig.pose(first)).toMatchObject({ x: 30, y: 0 });
    expect(lastTransform(rig.scene)).toEqual({ kind: 'duplicate', dx: 30, dy: 0 });

    rig.again();
    const [second] = rig.selection.get();
    rig.again();
    const [third] = rig.selection.get();
    expect(new Set([rig.ids[0], first, second, third]).size).toBe(4);
    expect(rig.pose(second)).toMatchObject({ x: 60, y: 0 });
    expect(rig.pose(third)).toMatchObject({ x: 90, y: 0 });
    expect(rig.pose(first)).toMatchObject({ x: 30, y: 0 });
  });

  it('makes a step-and-repeat from an Alt-drag clone', () => {
    const rig = setup([box(0, 0)]);
    drag(rig, cloneAction, { x: 5, y: 5 }, { x: 5, y: 45 });
    const [copy] = rig.selection.get();
    expect(rig.pose(copy)).toMatchObject({ x: 0, y: 40 });
    rig.again();
    const [next] = rig.selection.get();
    expect(next).not.toBe(copy);
    expect(rig.pose(next)).toMatchObject({ x: 0, y: 80 });
  });

  it('lands each repeat as one undo entry', () => {
    const rig = setup();
    drag(rig, moveAction, { x: 5, y: 5 }, { x: 25, y: 5 });
    rig.again();
    rig.scene.undo();
    expect(rig.pose(rig.ids[0])).toMatchObject({ x: 20, y: 0 });
  });
});

describe('recordTransform', () => {
  it('folds a move of the copies into the duplicate that made them', () => {
    const scene = {};
    recordTransform(scene, { kind: 'duplicate', dx: 12, dy: 12 }, ['c1', 'c2']);
    recordTransform(scene, { kind: 'translate', dx: 8, dy: -2 }, ['c2', 'c1']);
    expect(lastTransform(scene)).toEqual({ kind: 'duplicate', dx: 20, dy: 10 });
  });

  it('replaces a duplicate with a move of anything else', () => {
    const scene = {};
    recordTransform(scene, { kind: 'duplicate', dx: 12, dy: 12 }, ['c1']);
    recordTransform(scene, { kind: 'translate', dx: 8, dy: 0 }, ['a']);
    expect(lastTransform(scene)).toEqual({ kind: 'translate', dx: 8, dy: 0 });
  });

  it('keeps each scene its own', () => {
    const a = {};
    recordTransform(a, { kind: 'translate', dx: 1, dy: 0 }, ['x']);
    expect(lastTransform({})).toBeUndefined();
  });
});
