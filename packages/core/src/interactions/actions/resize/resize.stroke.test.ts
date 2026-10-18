/**
 * Resizing a stroked shape: the handles sit on the box with the stroke, the
 * drag maps that box, and the stroke keeps its width, so its outer edge lands
 * under the pointer.
 */
import { describe, it, expect } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { BoundsConstraint } from '../../gestures/types';
import { resizeAction } from './action';

const ID = asNodeId('r');
const STROKE = { paint: { kind: 'solid', color: '#000' }, width: 10 } as const;

function makeScene(stroke: unknown = STROKE): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'leaf', layer: 'main', data: { shape: 'rect', stroke }, pose: { x: 0, y: 0, width: 100, height: 100 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function ctx(
  scene: Scene<unknown, string, unknown>,
  start: { x: number; y: number },
  at: { x: number; y: number },
  extra: Record<string, unknown> = {},
): InvocationCtx {
  return {
    world: at,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => [ID] as NodeId[] }, scene, ...extra },
    drag: {
      start, current: at, delta: { x: at.x - start.x, y: at.y - start.y },
      affordance: { kind: 'handle:bottom-right', targetIds: [ID as string], anchor: { x: 'min', y: 'min' } },
    },
  } as unknown as InvocationCtx;
}

function drag(scene: Scene<unknown, string, unknown>, from: { x: number; y: number }, to: { x: number; y: number }, extra: Record<string, unknown> = {}) {
  const invoker = resizeAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(ctx(scene, from, from, extra), undefined);
  handle.onMove!(ctx(scene, from, to, extra));
  handle.onEnd!(ctx(scene, from, to, extra), 'commit');
  return scene.get(ID)!.pose as RectPose;
}

function policy(constraint: BoundsConstraint<Bounds>) {
  return { resizePolicy: { constraints: [constraint], expandIds: (ids: string[]) => ids } };
}

describe('resizing a stroked rect', () => {
  it('moves the stroke edge with the pointer and keeps the stroke width', () => {
    // The handle sits on the drawn box, at (105, 105).
    const pose = drag(makeScene(), { x: 105, y: 105 }, { x: 205, y: 105 });
    expect(pose).toMatchObject({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('hands the constraints the box with the stroke', () => {
    const seen: Bounds[] = [];
    const origins: Bounds[] = [];
    drag(makeScene(), { x: 105, y: 105 }, { x: 205, y: 105 }, policy({
      onMove(c, { pose }) {
        seen.push(pose);
        origins.push(c.origin.get(ID as string)!);
      },
    }));
    expect(seen.at(-1)).toMatchObject({ x: -5, y: -5, width: 210, height: 110 });
    expect(origins.at(-1)).toMatchObject({ x: -5, y: -5, width: 110, height: 110 });
  });

  it('lands the stroke edge where a constraint snaps the box', () => {
    const pose = drag(makeScene(), { x: 105, y: 105 }, { x: 203, y: 105 }, policy({
      onMove(_c, { pose: p }) {
        return { pose: { ...p, width: 300 - p.x } };
      },
    }));
    expect(pose.x + pose.width).toBe(295);
  });

  it('works on the pose box when the canvas opts out', () => {
    const seen: Bounds[] = [];
    drag(makeScene(), { x: 100, y: 100 }, { x: 200, y: 100 }, {
      boundsIncludeStroke: false,
      ...policy({ onMove(_c, { pose }) { seen.push(pose); } }),
    });
    expect(seen.at(-1)).toMatchObject({ x: 0, y: 0, width: 200, height: 100 });
  });
});
