/**
 * Rotating a node whose pose carries a `transform`. The pose's frame is its
 * rotation applied outside its `transform`, about the box center, so a turn
 * writes `rotation` alone and the drawn shape orbits the center rigidly.
 */
import { describe, it, expect } from 'vitest';
import { applyToPoint, poseFrameOf } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { rotateAction } from './action';

const ID = asNodeId('n');
const POSE: RectPose = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 6, transform: [1, 0, 0.8, 1] };
const CENTER = { x: 50, y: 30 };

function drawnCorners(p: RectPose): [number, number][] {
  const frame = poseFrameOf(p)!;
  return [[p.x, p.y], [p.x + p.width, p.y], [p.x + p.width, p.y + p.height], [p.x, p.y + p.height]]
    .map(([x, y]) => applyToPoint(frame, x, y));
}

function turn(delta: number): RectPose {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'mark', layer: 'main', data: {}, pose: POSE });
  const ctxAt = (angle: number) => ({
    world: { x: CENTER.x + 100 * Math.cos(angle), y: CENTER.y + 100 * Math.sin(angle) },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [ID] as NodeId[] }, scene: scene as unknown as Scene<unknown, string, unknown> },
  }) as unknown as InvocationCtx;
  const invoker = rotateAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(ctxAt(0), { behaviors: [] });
  handle.onMove!(ctxAt(delta));
  handle.onEnd!(ctxAt(delta), 'commit');
  return scene.get(ID)!.pose;
}

describe('rotating a skewed node', () => {
  const DELTA = 0.5;

  it('writes the rotation and leaves the box and the transform alone', () => {
    const next = turn(DELTA);
    expect(next.rotation).toBeCloseTo(POSE.rotation! + DELTA, 9);
    expect(next.transform).toEqual(POSE.transform);
    expect(next).toMatchObject({ x: 0, y: 0, width: 100, height: 60 });
  });

  it('orbits every drawn corner about the center by the turn', () => {
    const before = drawnCorners(POSE);
    const after = drawnCorners(turn(DELTA));
    const cos = Math.cos(DELTA), sin = Math.sin(DELTA);
    before.forEach(([x, y], i) => {
      const dx = x - CENTER.x, dy = y - CENTER.y;
      expect(after[i][0]).toBeCloseTo(CENTER.x + dx * cos - dy * sin, 6);
      expect(after[i][1]).toBeCloseTo(CENTER.y + dx * sin + dy * cos, 6);
    });
  });
});
