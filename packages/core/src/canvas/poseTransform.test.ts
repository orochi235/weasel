/**
 * A pose's `transform` reaches every place the pose is read as a drawn shape:
 * the render wrap, culling, silhouettes, bounds, and both pick paths.
 */
import { describe, expect, it } from 'vitest';
import { boundsOfPath } from '@weasel-js/geom';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { RectPose } from 'core/scene/types';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { visualBoundsViaDescriptor } from 'core/geometry/poseDescriptor';
import { axisAlignedBounds } from 'core/geometry/unionBounds';
import { poseOutline } from 'core/geometry/regionHit';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { wrapWithPoseRotation } from './poseRotation';
import { paintMissesView } from './paintCull';
import { findNodeShape, findShapeSilhouette, shapeCoversPoint } from './NodeShape';
import { wrapNodeOutput } from './wrapNodeOutput';
import { poseContains, poseContainsRotated } from './SceneCanvas/poseGeometry';
import { hitTestArea } from './deps/hitTestArea';

// A 40 x 12 box centered at (20, 6), drawn four times as wide: x from -60 to 100.
const STRETCHED: RectPose = { x: 0, y: 0, width: 40, height: 12, transform: [4, 0, 0, 1] };
const PLAIN: RectPose = { x: 0, y: 0, width: 40, height: 12 };

const near = (actual: { x: number; y: number; width: number; height: number }, expected: number[]): void => {
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.width).toBeCloseTo(expected[2], 6);
  expect(actual.height).toBeCloseTo(expected[3], 6);
};

describe('the render wrap', () => {
  const cmds: DrawCommand[] = [{
    kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 40, height: 12 }, fill: { paint: { color: '#abc' } },
  }];

  it('wraps a node whose pose has a transform in that transform about the box center', () => {
    const out = wrapWithPoseRotation(cmds, STRETCHED);
    expect(out).toHaveLength(1);
    const group = out[0] as GroupDrawCommand;
    expect(group.children).toBe(cmds);
    // Column-major 3x3: x' = 4x - 60, y' = y.
    expect(Array.from(group.transform!)).toEqual([4, 0, 0, 0, 1, 0, -60, 0, 1]);
  });

  it('composes the transform inside the rotation', () => {
    const out = wrapWithPoseRotation(cmds, { ...STRETCHED, rotation: Math.PI / 2 });
    const m = Array.from((out[0] as GroupDrawCommand).transform!);
    // The box's right-middle (40, 6) is stretched to (100, 6), then turned to (20, 86).
    expect(m[0] * 40 + m[3] * 6 + m[6]).toBeCloseTo(20, 6);
    expect(m[1] * 40 + m[4] * 6 + m[7]).toBeCloseTo(86, 6);
  });

  it('leaves a node with an identity transform unwrapped', () => {
    expect(wrapWithPoseRotation(cmds, { ...PLAIN, transform: [1, 0, 0, 1] })).toBe(cmds);
  });
});

describe('the built-in text and image painters', () => {
  // The svg import of `<text transform="scale(4 1)" font-size="10">`: box and
  // font doubled, the transform carrying the rest.
  const pose: RectPose = { x: 40, y: -6, width: 80, height: 24, transform: [2, 0, 0, 0.5] };

  it.each([
    ['kit:text', { text: 'Hi', style: { fontSize: 20 } }],
    ['kit:image', { image: { src: 'a.png' } }],
  ])('%s paints in its box, and the node wrap stretches it four to one', (id, data) => {
    const node = { id: 'n', kind: 'mark', layer: 'main', pose, data };
    const painter = findNodeShape(node as never)!;
    expect(painter.id).toBe(id);
    const own = painter.paint(node as never, pose as never);
    const plain = painter.paint({ ...node, pose: { ...pose, transform: undefined } } as never, { ...pose, transform: undefined } as never);
    expect(own).toEqual(plain);
    const out = wrapNodeOutput(own, pose, 1);
    expect(own.length).toBeGreaterThan(0);
    const m = Array.from((out[0] as GroupDrawCommand).transform!);
    // Box corners (40, -6) and (120, 18) land on (0, 0) and (160, 12).
    expect([m[0] * 40 + m[3] * -6 + m[6], m[1] * 40 + m[4] * -6 + m[7]]).toEqual([0, 0]);
    expect([m[0] * 120 + m[3] * 18 + m[6], m[1] * 120 + m[4] * 18 + m[7]]).toEqual([160, 12]);
  });

  it('bounds the stretched text four to one', () => {
    const b = axisAlignedBounds(pose);
    expect(b.width / b.height).toBeCloseTo((4 * 40) / 12, 9);
  });
});

describe('culling', () => {
  const view = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const rightOfBox = { x: 80, y: 0, width: 15, height: 12 };
  const boxOf = (_n: unknown, pose: RectPose): RectPose => pose;

  it('keeps a node whose stretched paint reaches a view its box does not', () => {
    const misses = paintMissesView(boxOf, view as never, rightOfBox);
    expect(misses({}, PLAIN)).toBe(true);
    expect(misses({}, STRETCHED)).toBe(false);
  });
});

describe('bounds and outlines', () => {
  it('reports the visual bounds of the stretched box', () => {
    near(visualBoundsViaDescriptor(STRETCHED, AUTO_POSE_DESCRIPTOR as never), [-60, 0, 160, 12]);
    near(axisAlignedBounds(STRETCHED), [-60, 0, 160, 12]);
  });

  it('reports the visual bounds of a skewed box', () => {
    // x' = x + (y - 6): the top edge shifts 6 left, the bottom 6 right.
    near(axisAlignedBounds({ ...PLAIN, transform: [1, 0, 1, 1] }), [-6, 0, 52, 12]);
  });

  it('outlines a node nothing paints as its stretched box', () => {
    near(boundsOfPath(poseOutline(STRETCHED, PLAIN)), [-60, 0, 160, 12]);
  });

  it('bakes the transform into a painter\'s silhouette', () => {
    const node = { id: 'a', kind: 'mark', layer: 'main', pose: STRETCHED, data: { kind: 'rect' } };
    const sil = findShapeSilhouette(node as never, STRETCHED);
    expect(sil).not.toBeNull();
    near(boundsOfPath(sil!), [-60, 0, 160, 12]);
  });
});

describe('picking', () => {
  it('hits a point inside the stretched shape and outside its box', () => {
    expect(poseContains(STRETCHED, 90, 6)).toBe(false);
    expect(poseContainsRotated(STRETCHED, 90, 6)).toBe(true);
    expect(poseContainsRotated(STRETCHED, -50, 6)).toBe(true);
    expect(poseContainsRotated(STRETCHED, 110, 6)).toBe(false);
  });

  it('misses a point inside the box that a skew moves the shape off', () => {
    // x' = x + 4(y - 6): the top edge runs from -24 to 16, so (30, 0.5) is bare.
    const skewed: RectPose = { ...PLAIN, transform: [1, 0, 4, 1] };
    expect(poseContains(skewed, 30, 0.5)).toBe(true);
    expect(poseContainsRotated(skewed, 30, 0.5)).toBe(false);
    expect(poseContainsRotated(skewed, -20, 0.5)).toBe(true);
  });

  it('narrows to the painted shape through the same transform', () => {
    const node = { id: 'a', kind: 'mark', layer: 'main', pose: STRETCHED, data: { shape: 'ellipse', fill: { paint: { color: '#888' } } } };
    expect(shapeCoversPoint(node as never, STRETCHED, 90, 6)).toBe(true);
    // The stretched ellipse's corner region is bare.
    expect(shapeCoversPoint(node as never, STRETCHED, 98, 0.5)).toBe(false);
  });

  it('takes a stretched node in a region that only its stretch reaches', () => {
    const scene = createScene<{ kind: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'mark', layer: 'main', id: asNodeId('plain'), pose: PLAIN, data: { kind: 'rect' } });
    scene.add({ kind: 'mark', layer: 'main', id: asNodeId('wide'), pose: STRETCHED, data: { kind: 'rect' } });
    expect(hitTestArea(scene as never, { x: 80, y: 2, width: 10, height: 4 })).toEqual(['wide']);
  });
});
