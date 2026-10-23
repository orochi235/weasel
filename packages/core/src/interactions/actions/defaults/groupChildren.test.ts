/**
 * A group on a scene with absolute poses derives its pose from its children,
 * so a pose written to the group changes nothing. An action that reshapes a
 * selected group has to write the children.
 */
import { describe, expect, it } from 'vitest';
import type { Action, InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import type { NodeId, RectPose } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { unionOfChildren } from 'core/scene/kitRegistry';
import { moveSources, shapeSources } from '../selectionSubtree';
import { resizeAction } from '../resize/action';
import { rotateAction } from '../rotate/action';
import { flipAction } from '../flip/action';
import { alignRightAction } from '../align/action';
import { distributeHorizontalAction } from '../distribute/action';

type Pose = RectPose & { rotation?: number };

function setup() {
  const scene = createScene<object, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({
    kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 },
    dependsOn: 'children', derivePose: unionOfChildren,
  });
  const a = scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: { x: 0, y: 0, width: 20, height: 20 } });
  const b = scene.add({ kind: 'mark', layer: 'main', parent: group, data: {}, pose: { x: 60, y: 40, width: 20, height: 20 } });
  const lone = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 200, y: 0, width: 20, height: 20 } });
  let selected: NodeId[] = [group];
  const selection = {
    get: () => selected,
    set: (ids: NodeId[]) => { selected = ids; },
    adapterMethods: { getSelection: () => selected, setSelection: (ids: NodeId[]) => { selected = ids; } },
  } as unknown as SelectionApi;
  const deps = { scene, selection };
  const ctx = (world: { x: number; y: number }, drag: object): InvocationCtx => ({
    world, screen: world, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps, drag,
  } as unknown as InvocationCtx);
  const drag = (action: Action, from: { x: number; y: number }, to: { x: number; y: number }, extra: object = {}): void => {
    if (action.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing action');
    const d = { start: from, current: to, delta: { x: to.x - from.x, y: to.y - from.y }, ...extra };
    const handle = action.invoker.start(ctx(from, { ...d, current: from, delta: { x: 0, y: 0 } }), undefined);
    handle.onMove!(ctx(to, d));
    handle.onEnd!(ctx(to, d), 'commit');
  };
  const poseOf = (id: NodeId): Pose => scene.get(id)!.pose;
  const run = (action: Action, params?: Record<string, unknown>): void => {
    if (action.invoker?.timing !== 'immediate') throw new Error('expected an immediate action');
    action.invoker.run(deps as never, params);
  };
  return { scene, group, a, b, lone, drag, run, poseOf, select: (ids: NodeId[]) => { selected = ids; } };
}

describe('shapeSources', () => {
  it('stands a derived group\'s children in for it, and leaves other nodes as they are', () => {
    const { scene, group, a, b, lone } = setup();
    expect(shapeSources(scene as never, [lone, group])).toEqual([lone, a, b]);
    expect(shapeSources(scene as never, [a, group])).toEqual([a, b]);
  });

  // A box drawn around two nodes and the label on the wire between them: the
  // wire's pose is a placeholder, and turning it would turn the path it draws.
  it('reaches past a dependency that derives its path, rather than writing it', () => {
    const { scene, a, b } = setup();
    const wire = scene.add({
      kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 0, height: 0 },
      dependsOn: [a, b], derivePath: () => null,
    });
    const label = scene.add({
      kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 },
      dependsOn: [wire], derivePose: () => null,
    });
    const box = scene.add({
      kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 },
      dependsOn: [a, b, label], derivePose: () => null,
    });
    expect(shapeSources(scene as never, [box])).toEqual([a, b]);
    expect(moveSources(scene as never, [box])).toEqual([a, b]);
    expect(moveSources(scene as never, [wire])).toEqual([wire]);
  });
});

describe('reshaping a selected group writes its children', () => {
  it('resize scales each child inside the group\'s box, as one undo step', () => {
    const { scene, group, a, b, drag, poseOf } = setup();
    const before = scene.historyEntries().length;
    drag(resizeAction, { x: 80, y: 60 }, { x: 160, y: 120 }, {
      affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: [group], anchor: { x: 'min', y: 'min' } },
    });
    expect(poseOf(a)).toMatchObject({ x: 0, y: 0, width: 40, height: 40 });
    expect(poseOf(b)).toMatchObject({ x: 120, y: 80, width: 40, height: 40 });
    expect(scene.historyEntries().length).toBe(before + 1);
  });

  it('rotate orbits each child about the group\'s center', () => {
    const { a, b, drag, poseOf } = setup();
    // The group spans (0,0)-(80,60): center (40,30). A quarter turn.
    drag(rotateAction, { x: 90, y: 30 }, { x: 40, y: 80 });
    expect(poseOf(a).rotation).toBeCloseTo(Math.PI / 2);
    expect(poseOf(a).x).toBeCloseTo(50);
    expect(poseOf(a).y).toBeCloseTo(-10);
    expect(poseOf(b).x).toBeCloseTo(10);
    expect(poseOf(b).y).toBeCloseTo(50);
  });

  it('resize of a group selected beside a loose node scales the group\'s children too', () => {
    const { group, a, lone, drag, poseOf, select } = setup();
    select([group, lone]);
    // The shared box spans (0,0)-(220,60); double it from its top-left corner.
    drag(resizeAction, { x: 220, y: 60 }, { x: 440, y: 120 }, {
      affordance: { kind: 'handle:bottom-right', fixedPoint: { x: 0, y: 0 }, targetIds: [group, lone], anchor: { x: 'min', y: 'min' } },
    });
    expect(poseOf(a)).toMatchObject({ width: 40, height: 40 });
    expect(poseOf(lone)).toMatchObject({ x: 400, width: 40 });
  });
});

describe('a selected group moves and mirrors as one thing', () => {
  it('flip mirrors the children about the group\'s own box', () => {
    const { a, b, run, poseOf } = setup();
    run(flipAction, { axis: 'x' });
    expect(poseOf(a)).toMatchObject({ x: 60, y: 0 });
    expect(poseOf(b)).toMatchObject({ x: 0, y: 40 });
  });

  it('align carries the children by the group\'s own shift', () => {
    const { group, a, b, lone, run, poseOf, select } = setup();
    select([group, lone]);
    // The selection spans x 0..220; the group, 80 wide, moves right by 140.
    run(alignRightAction);
    expect(poseOf(a)).toMatchObject({ x: 140, y: 0 });
    expect(poseOf(b)).toMatchObject({ x: 200, y: 40 });
    expect(poseOf(lone).x).toBe(200);
  });

  it('distribute carries the children by the group\'s own shift', () => {
    const { scene, group, a, b, lone, run, poseOf, select } = setup();
    const left = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: -100, y: 0, width: 20, height: 20 } });
    select([left, group, lone]);
    // Centers sit at -90, 40, and 210; the middle one belongs at 60.
    run(distributeHorizontalAction);
    expect(poseOf(a)).toMatchObject({ x: 20, y: 0 });
    expect(poseOf(b)).toMatchObject({ x: 80, y: 40 });
  });
});
