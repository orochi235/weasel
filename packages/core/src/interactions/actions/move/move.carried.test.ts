/**
 * The ids a move leaves to a moving frame are the ones nudge and clone leave
 * to it: everything the drag reaches, less `translateTargets`. Checked under a
 * composing strategy, since under the identity one nothing is carried and the
 * two agree whatever either does.
 */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { unionOfChildren } from 'core/scene/kitRegistry';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { IDENTITY_POSE_COMPOSITION, RIGID_POSE_COMPOSITION, type PoseComposition } from 'core/scene/composePose';
import type { NodeId, RectPose, Scene } from 'core/scene/types';
import { scenePoseFrame } from '../poseFrame';
import { translateTargets } from '../selectionSubtree';
import { captureFrames, captureStartPoses } from './capture';

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

/** A frame holding a leaf and an envelope; the envelope holds a leaf and a
 *  second frame with a leaf of its own. `free` sits outside all of it. */
function fixture(composition: PoseComposition<RectPose> = RIGID_POSE_COMPOSITION) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }], composition });
  const add = (kind: 'mark' | 'group', pose: RectPose, parent?: NodeId, more: object = {}): NodeId =>
    scene.add({ kind, layer: 'main', data: {}, pose, ...(parent ? { parent } : {}), ...more });
  const frame = add('group', box(0, 0, 400, 400));
  const leaf = add('mark', box(10, 10), frame);
  const envelope = add('group', box(0, 0, 1, 1), frame, { dependsOn: 'children', derivePose: unionOfChildren });
  const inEnvelope = add('mark', box(50, 50), envelope);
  const inner = add('group', box(100, 100, 100, 100), envelope);
  const inInner = add('mark', box(5, 5), inner);
  const free = add('mark', box(900, 900));
  return {
    scene: scene as unknown as Scene<unknown, string, unknown>,
    ids: { frame, leaf, envelope, inEnvelope, inner, inInner, free },
  };
}

function carriedBy(scene: Scene<unknown, string, unknown>, ids: NodeId[]) {
  const { startPoses } = captureStartPoses(scene, ids, null, AUTO_POSE_DESCRIPTOR);
  const { carried, frames } = captureFrames(scene, ids, startPoses);
  const written = [...startPoses.keys()].filter((id) => !carried.has(id));
  return { carried, frames, written };
}

const sorted = (ids: Iterable<NodeId>): string[] => [...ids].map(String).sort();

describe('move — which ids a moving frame carries', () => {
  const selections: [string, (i: ReturnType<typeof fixture>['ids']) => NodeId[]][] = [
    ['a frame', (i) => [i.frame]],
    ['an envelope inside a frame', (i) => [i.envelope]],
    ['a leaf', (i) => [i.inEnvelope]],
    ['a frame and a leaf it holds', (i) => [i.frame, i.leaf]],
    ['a frame and a leaf beside it', (i) => [i.inner, i.inEnvelope]],
    ['an envelope and a leaf two frames down', (i) => [i.envelope, i.inInner]],
    ['a frame and a leaf outside it', (i) => [i.inner, i.free]],
  ];

  it.each(selections)('writes what translateTargets names: %s', (_name, pick) => {
    const { scene, ids } = fixture();
    const selected = pick(ids);
    const { written } = carriedBy(scene, selected);
    expect(sorted(written)).toEqual(sorted(translateTargets(scene, scenePoseFrame(scene), selected)));
  });

  it('carries the contents of a dragged frame, through an envelope', () => {
    const { scene, ids } = fixture();
    const { carried, frames } = carriedBy(scene, [ids.frame]);
    expect(sorted(carried)).toEqual(sorted([ids.leaf, ids.envelope, ids.inEnvelope, ids.inner, ids.inInner]));
    expect(frames.size).toBe(0);
  });

  it('records a frame for each written id stored under one that is not moving', () => {
    const { scene, ids } = fixture();
    const { carried, frames } = carriedBy(scene, [ids.envelope]);
    expect(sorted(carried)).toEqual(sorted([ids.inInner]));
    expect(sorted(frames.keys())).toEqual(sorted([ids.envelope, ids.inEnvelope, ids.inner]));
  });

  it('carries nothing under the identity strategy', () => {
    const { scene, ids } = fixture(IDENTITY_POSE_COMPOSITION as PoseComposition<RectPose>);
    const { carried, frames } = carriedBy(scene, [ids.frame]);
    expect(carried.size).toBe(0);
    expect(frames.size).toBe(0);
  });
});
