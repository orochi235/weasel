/**
 * Counterexamples the pick walk's property tests found, kept as plain examples.
 */
import { describe, expect, it } from 'vitest';
import { translate } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { rectRegion } from 'core/geometry/regionHit';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { pickWalk, scenePickSource } from './pickWalk';
import { regionPick } from './pickIndex/pickIndexFixture';

type Box = { x: number; y: number; width: number; height: number };
const clipToPose = (p: Box) => ({ kind: 'rect' as const, ...p });

/** A leaf under two nested clipping groups whose clips do not overlap, so none of it is drawn; the outer
 *  one draws a copy 100 to the right when `copies` says so. */
function nestedDisjointClips(innerClips: boolean, copies: boolean) {
  const scene = createScene<null, 'a', Box>({ systemLayers: [{ id: 'a' }], composition: IDENTITY_POSE_COMPOSITION as never });
  const add = (spec: Record<string, unknown>) => scene.add({ kind: 'mark', layer: 'a', data: null, ...spec } as never);
  add({
    id: asNodeId('outer'), kind: 'group', pose: { x: 0, y: 0, width: 10, height: 10 }, clipFromPose: clipToPose,
    ...(copies ? { copiesFromPose: () => [translate(100, 0)] } : {}),
  });
  add({
    id: asNodeId('inner'), kind: 'group', parent: asNodeId('outer'), pose: { x: 20, y: 0, width: 10, height: 10 },
    ...(innerClips ? { clipFromPose: clipToPose } : {}),
  });
  add({ id: asNodeId('leaf'), parent: asNodeId('inner'), pose: { x: 0, y: 0, width: 30, height: 10 } });
  return scene;
}

const marquee = (b: Box) => regionPick(rectRegion(b), 'intersect', AUTO_POSE_DESCRIPTOR);

describe('a marquee over a node its clips leave nothing of', () => {
  it('takes nothing, though each clip alone meets the node and the marquee', () => {
    const q = marquee({ x: 0.5, y: 0.5, width: 29, height: 5 });
    expect(pickWalk(scenePickSource(nestedDisjointClips(true, false) as never), q)).toEqual([]);
    expect(pickWalk(scenePickSource(nestedDisjointClips(false, false) as never), q)).toEqual(['leaf']);
  });

  it('takes nothing in a copy an ancestor draws either', () => {
    const q = marquee({ x: 100.5, y: 0.5, width: 29, height: 5 });
    expect(pickWalk(scenePickSource(nestedDisjointClips(true, true) as never), q)).toEqual([]);
    expect(pickWalk(scenePickSource(nestedDisjointClips(false, true) as never), q)).toEqual(['leaf']);
  });
});
