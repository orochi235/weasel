/** A `Pose3` container scaled to nothing along an axis: valid to store, flat to compose through, and no frame a
 *  world pose can be rebased into. The edits that refuse on that are core's, tested in `singularFrames.test.ts`. */
import { describe, expect, it } from 'vitest';
import { createScene, frameInverts, rebaseLocalPose, scenePoseAdapter } from '@weasel-js/core';
import { POSE3_COMPOSITION } from './composePose3';
import { pose3, type Pose3 } from './pose3';

const { compose, decompose } = POSE3_COMPOSITION;
const WORLD = pose3({ x: 4, y: 5, z: 6 });

describe('POSE3_COMPOSITION under a singular frame', () => {
  it.each<[string, Pose3['scale']]>([
    ['a zero axis', { x: 0, y: 1, z: 1 }],
    ['every axis zero', { x: 0, y: 0, z: 0 }],
    ['an axis past geom\'s conditioning bound beside the others', { x: 1, y: 1, z: 1e-13 }],
  ])('answers null for %s', (_name, scale) => {
    expect(decompose(pose3({ x: 1, y: 2, z: 3 }, scale), WORLD)).toBeNull();
  });

  it('still composes a child under one, flat', () => {
    const flat = compose(pose3({ x: 1, y: 2, z: 3 }, { x: 0, y: 1, z: 1 }), WORLD);
    expect(flat.position.x).toBe(1);
    expect(flat.scale.x).toBe(0);
  });

  it('round-trips under a uniformly tiny frame, which is well conditioned', () => {
    const tiny = pose3({ x: 1, y: 2, z: 3 }, { x: 1e-6, y: 1e-6, z: 1e-6 });
    const back = compose(tiny, decompose(tiny, WORLD)!);
    expect(back.position.x).toBeCloseTo(4, 9);
    expect(back.position.z).toBeCloseTo(6, 9);
  });
});

describe('a Pose3 scene with a collapsed container', () => {
  function setup() {
    const scene = createScene<Record<string, never>, 'solids', Pose3>({ composition: POSE3_COMPOSITION, systemLayers: [{ id: 'solids' }] });
    const flat = scene.add({ kind: 'group', layer: 'solids', data: {}, pose: pose3({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }) });
    const a = scene.add({ kind: 'mark', layer: 'solids', data: {}, parent: flat, pose: pose3({ x: 1, y: 1, z: 1 }) });
    return { scene, flat, a };
  }

  it('reads the container as a frame that does not invert', () => {
    const { scene, flat } = setup();
    expect(frameInverts(scenePoseAdapter(scene as never) as never, flat, POSE3_COMPOSITION)).toBe(false);
  });

  it('rebases no world pose into it, nor into a frame nested in it', () => {
    const { scene, flat, a } = setup();
    const inner = scene.add({ kind: 'group', layer: 'solids', data: {}, parent: flat, pose: pose3({ x: 1, y: 0, z: 0 }) });
    const poses = scenePoseAdapter(scene as never) as never;
    for (const into of [flat, inner]) expect(rebaseLocalPose(poses, WORLD, into, compose, decompose)).toBeNull();
    expect(rebaseLocalPose(poses, WORLD, a, compose, decompose)).toBeNull();
  });
});
