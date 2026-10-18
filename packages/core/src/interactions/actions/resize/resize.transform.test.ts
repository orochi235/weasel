/**
 * Resizing a node whose pose carries a `transform`. The drag is taken in the
 * frame the node is drawn in: the dragged corner follows the pointer, the
 * opposite corner stays where it is drawn, and the resize writes the box and
 * leaves the `transform` alone.
 */
import { describe, it, expect } from 'vitest';
import { applyToPoint, poseFrameOf } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import type { SnapDep } from '../snapDep';
import { resizeAction } from './action';

const ID = asNodeId('n');
const SKEW = [1, 0, 0.8, 1] as const;

function makeScene(pose: RectPose) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: ID, kind: 'leaf', layer: 'main', data: {}, pose });
  return scene as unknown as Scene<unknown, string, unknown>;
}

/** A point of `pose`'s own box, where the node draws it. */
function drawn(pose: RectPose, lx: number, ly: number): { x: number; y: number } {
  const frame = poseFrameOf(pose);
  if (!frame) return { x: lx, y: ly };
  const [x, y] = applyToPoint(frame, lx, ly);
  return { x, y };
}
const corners = (p: RectPose) => ({
  tl: drawn(p, p.x, p.y),
  br: drawn(p, p.x + p.width, p.y + p.height),
});

/** Drag the bottom-right handle from where it is drawn by `d`. */
function dragBottomRight(
  scene: Scene<unknown, string, unknown>,
  d: { x: number; y: number },
  snap?: SnapDep,
): RectPose {
  const start = corners(scene.get(ID)!.pose as RectPose).br;
  const ctxAt = (at: { x: number; y: number }) => ({
    world: at,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => [ID] as NodeId[] },
      scene,
      resizePolicy: { constraints: [], expandIds: (ids: string[]) => ids },
      ...(snap ? { snap } : {}),
    },
    drag: {
      start,
      current: at,
      delta: { x: at.x - start.x, y: at.y - start.y },
      affordance: { kind: 'handle:bottom-right', targetIds: [ID as string], anchor: { x: 'min', y: 'min' } },
    },
  }) as unknown as InvocationCtx;
  const invoker = resizeAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(ctxAt(start), undefined);
  const to = { x: start.x + d.x, y: start.y + d.y };
  handle.onMove!(ctxAt(to));
  handle.onEnd!(ctxAt(to), 'commit');
  return scene.get(ID)!.pose as RectPose;
}

describe.each([
  ['skewed', { x: 0, y: 0, width: 100, height: 60, transform: SKEW }],
  ['skewed and turned', { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 6, transform: SKEW }],
  ['stretched and turned', { x: 10, y: 5, width: 100, height: 60, rotation: -0.4, transform: [2, 0, 0, 0.5] as const }],
] as [string, RectPose][])('resizing a %s node by its bottom-right handle', (_, pose) => {
  const D = { x: 30, y: 12 };

  it('moves the drawn corner with the pointer', () => {
    const before = corners(pose);
    const after = corners(dragBottomRight(makeScene(pose), D));
    expect(after.br.x).toBeCloseTo(before.br.x + D.x, 6);
    expect(after.br.y).toBeCloseTo(before.br.y + D.y, 6);
  });

  it('keeps the opposite corner where it is drawn', () => {
    const before = corners(pose);
    const after = corners(dragBottomRight(makeScene(pose), D));
    expect(after.tl.x).toBeCloseTo(before.tl.x, 6);
    expect(after.tl.y).toBeCloseTo(before.tl.y, 6);
  });

  it('writes the box and leaves the transform and rotation alone', () => {
    const next = dragBottomRight(makeScene(pose), D);
    expect(next.transform).toEqual(pose.transform);
    expect(next.rotation ?? 0).toBeCloseTo(pose.rotation ?? 0, 12);
    expect(next.width).not.toBeCloseTo(pose.width, 3);
  });
});

describe('snapping on a skewed, turned node', () => {
  const pose: RectPose = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 6, transform: SKEW };

  it('lands the drawn dragged corner on the point the snap session puts it', () => {
    const before = corners(pose);
    const target = { x: before.br.x + 40, y: before.br.y + 25 };
    const snap: SnapDep = {
      begin: () => ({ at: () => ({ point: target, held: true, marks: [] }), angle: (theta) => ({ theta, marks: [] }), end: () => {} }),
    };
    const next = dragBottomRight(makeScene(pose), { x: 30, y: 12 }, snap);
    const after = corners(next);
    expect(after.br.x).toBeCloseTo(target.x, 6);
    expect(after.br.y).toBeCloseTo(target.y, 6);
    expect(after.tl.x).toBeCloseTo(before.tl.x, 6);
    expect(after.tl.y).toBeCloseTo(before.tl.y, 6);
    expect(next.transform).toEqual(pose.transform);
  });
});
