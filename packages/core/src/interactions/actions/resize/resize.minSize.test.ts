/**
 * A node's `data.minSize` is a floor no resize goes under, whatever the
 * resize policy's constraints are.
 */
import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type RectPose, type Scene } from 'core/scene/types';
import { expectSamePose } from 'core/scene/frameFixture';
import type { InvocationCtx, ResizeAnchor } from '@weasel-js/routing';
import { resizeAction } from './action';
import { resizeSelectionOps } from './replay';
import { defaultCommitAdapter } from '../defaultCommitAdapter';

const A = asNodeId('a');
const B = asNodeId('b');
const MIN = { width: 48, height: 48 };
const BOTTOM_RIGHT: ResizeAnchor = { x: 'min', y: 'min' };
const TOP_LEFT: ResizeAnchor = { x: 'max', y: 'max' };

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: A, kind: 'leaf', layer: 'main', data: { minSize: MIN }, pose: { x: 0, y: 0, width: 100, height: 100 } });
  scene.add({ id: B, kind: 'leaf', layer: 'main', data: {}, pose: { x: 100, y: 0, width: 100, height: 100 } });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function drag(
  scene: Scene<unknown, string, unknown>,
  ids: NodeId[],
  anchor: ResizeAnchor,
  from: { x: number; y: number },
  to: { x: number; y: number },
  resizePolicy?: unknown,
): void {
  const ctx = (at: { x: number; y: number }) => ({
    world: at,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => ids }, scene, ...(resizePolicy ? { resizePolicy } : {}) },
    drag: {
      start: from,
      current: at,
      delta: { x: at.x - from.x, y: at.y - from.y },
      affordance: { kind: 'handle:corner', targetIds: ids, anchor },
    },
  }) as unknown as InvocationCtx;
  const invoker = resizeAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  const handle = invoker.start(ctx(from), undefined);
  handle.onMove!(ctx(to));
  handle.onEnd!(ctx(to), 'commit');
}

describe('resize — a node\'s minimum size', () => {
  it('stops the dragged corner at the minimum', () => {
    const scene = makeScene();
    drag(scene, [A], BOTTOM_RIGHT, { x: 100, y: 100 }, { x: 10, y: 10 });
    expectSamePose(scene.get(A)!.pose as RectPose, { x: 0, y: 0, width: 48, height: 48 });
  });

  it('keeps the far edges where they were when the near corner is dragged', () => {
    const scene = makeScene();
    drag(scene, [A], TOP_LEFT, { x: 0, y: 0 }, { x: 90, y: 90 });
    expectSamePose(scene.get(A)!.pose as RectPose, { x: 52, y: 52, width: 48, height: 48 });
  });

  it('will not turn the node inside out past its anchor', () => {
    const scene = makeScene();
    drag(scene, [A], BOTTOM_RIGHT, { x: 100, y: 100 }, { x: -60, y: -60 });
    expectSamePose(scene.get(A)!.pose as RectPose, { x: 0, y: 0, width: 48, height: 48 });
  });

  it('holds with a resize policy that names no constraints', () => {
    const scene = makeScene();
    const policy = { constraints: [], pointSnap: [], expandIds: (ids: string[]) => ids };
    drag(scene, [A], BOTTOM_RIGHT, { x: 100, y: 100 }, { x: 10, y: 10 }, policy);
    expectSamePose(scene.get(A)!.pose as RectPose, { x: 0, y: 0, width: 48, height: 48 });
  });

  it('stops a multi-selection where its smallest-allowed member reaches its minimum', () => {
    const scene = makeScene();
    // The union is 200 × 100; A, half its width, can go to 48 of 100.
    drag(scene, [A, B], BOTTOM_RIGHT, { x: 200, y: 100 }, { x: 20, y: 10 });
    expectSamePose(scene.get(A)!.pose as RectPose, { x: 0, y: 0, width: 48, height: 48 });
    expectSamePose(scene.get(B)!.pose as RectPose, { x: 48, y: 0, width: 48, height: 48 });
  });

  it('holds a resize replayed without a pointer', () => {
    const scene = makeScene();
    const ops = resizeSelectionOps(scene, [A], BOTTOM_RIGHT, { x: 0, y: 0, width: 0.1, height: 0.1 }, {}, 'Scale');
    scene.applyBatch(ops, 'Scale', defaultCommitAdapter(scene));
    expectSamePose(scene.get(A)!.pose as RectPose, { x: 0, y: 0, width: 48, height: 48 });
  });

  it('leaves a node with no minimum free to shrink', () => {
    const scene = makeScene();
    drag(scene, [B], BOTTOM_RIGHT, { x: 200, y: 100 }, { x: 110, y: 10 });
    expectSamePose(scene.get(B)!.pose as RectPose, { x: 100, y: 0, width: 10, height: 10 });
  });

  it('reads nothing from data whose minimum is not a size', () => {
    const scene = makeScene();
    scene.update(B, { data: { minSize: { width: 'wide' } } });
    drag(scene, [B], BOTTOM_RIGHT, { x: 200, y: 100 }, { x: 110, y: 10 });
    expect((scene.get(B)!.pose as RectPose).width).toBeCloseTo(10);
  });
});
