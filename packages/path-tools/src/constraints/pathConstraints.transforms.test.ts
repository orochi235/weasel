/**
 * What a whole-shape transform — resize, rotate, flip — does to a node's path
 * constraints. It does not solve them: it carries the list unchanged, every
 * constraint the transform preserves keeps holding, and one it breaks is
 * reported by `constraintConflictsOf`, the same report a conflicting add gets.
 */
import { describe, expect, it } from 'vitest';
import { polygonFromPoints, type PathConstraint, type PolygonPath } from '@weasel-js/geom';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import {
  asNodeId, createScene, flipAction, type NodeId, type RectPose, resizeAction, rotateAction, type Scene,
} from '@weasel-js/core';
import { constraintConflictsOf } from './pathConstraints';

const ID = asNodeId('box');

/** Indices below name these in `CONSTRAINTS`. */
const CONSTRAINTS: PathConstraint[] = [
  { kind: 'horizontal', segment: [0, 1] },
  { kind: 'vertical', segment: [1, 2] },
  { kind: 'parallel', segments: [[0, 1], [3, 2]] },
  { kind: 'perpendicular', segments: [[0, 1], [1, 2]] },
  { kind: 'equalLength', segments: [[0, 1], [3, 2]] },
  { kind: 'length', segment: [0, 1], length: 100 },
  { kind: 'fixed', anchor: 0 },
];
const LENGTH = 5;

const RECT = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }];

function polygonScene() {
  const scene = createScene<{ constraints: PathConstraint[] }, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'mark', layer: 'main', pose: polygonFromPoints(RECT), data: { constraints: CONSTRAINTS } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function dataPathScene() {
  const scene = createScene<{ path: PolygonPath; constraints: PathConstraint[] }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: ID, kind: 'mark', layer: 'main',
    pose: { x: 0, y: 0, width: 100, height: 50 },
    data: { path: polygonFromPoints(RECT) as PolygonPath, constraints: CONSTRAINTS },
  });
  return scene as unknown as Scene<unknown, string, unknown>;
}

const conflicts = (scene: Scene<unknown, string, unknown>) => constraintConflictsOf(scene.get(ID));

function ctx(scene: Scene<unknown, string, unknown>, at: { x: number; y: number }, affordance?: object): InvocationCtx {
  return {
    world: at,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [ID] as NodeId[] }, scene },
    drag: { start: at, current: at, delta: { x: 0, y: 0 }, ...(affordance ? { affordance } : {}) },
  } as unknown as InvocationCtx;
}

function dragWith(
  action: { invoker?: unknown },
  scene: Scene<unknown, string, unknown>,
  from: { x: number; y: number },
  to: { x: number; y: number },
  affordance?: object,
) {
  const handle = (action.invoker as OngoingInvoker).start(ctx(scene, from, affordance), undefined);
  handle.onMove!(ctx(scene, to, affordance));
  handle.onEnd!(ctx(scene, to, affordance), 'commit');
}

const corner = { kind: 'handle:bottom-right', targetIds: [ID as string], anchor: { x: 'min', y: 'min' } };

describe('path constraints under whole-shape transforms', () => {
  it('start out all holding', () => {
    expect(conflicts(polygonScene())).toEqual([]);
    expect(conflicts(dataPathScene())).toEqual([]);
  });

  it('a non-uniform resize keeps every constraint but a set length, which it reports', () => {
    const scene = polygonScene();
    dragWith(resizeAction, scene, { x: 100, y: 50 }, { x: 200, y: 150 }, corner);
    expect(scene.get(ID)!.data).toEqual({ constraints: CONSTRAINTS });
    expect(conflicts(scene)).toEqual([LENGTH]);
  });

  it('a flip keeps every constraint', () => {
    const scene = polygonScene();
    (flipAction.invoker as ImmediateInvoker).run(ctx(scene, { x: 0, y: 0 }).deps, { axis: 'x' });
    expect(conflicts(scene)).toEqual([]);
  });

  it('a resize of a data.path node keeps every constraint but a set length', () => {
    const scene = dataPathScene();
    dragWith(resizeAction, scene, { x: 100, y: 50 }, { x: 200, y: 150 }, corner);
    expect(conflicts(scene)).toEqual([LENGTH]);
  });

  it('turning a data.path node turns the frame its horizontal and vertical read', () => {
    // About the center (50, 25): from due right to 30 degrees below it.
    const scene = dataPathScene();
    dragWith(rotateAction, scene, { x: 150, y: 25 }, { x: 50 + 100 * Math.cos(Math.PI / 6), y: 25 + 100 * Math.sin(Math.PI / 6) });
    expect((scene.get(ID)!.pose as RectPose).rotation).toBeCloseTo(Math.PI / 6, 3);
    expect(conflicts(scene)).toEqual([]);
  });
});
