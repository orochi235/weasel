import { describe, expect, it } from 'vitest';
import { multiply, scale, translate, type Affine } from '@weasel-js/geom';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { RectPose } from 'core/scene/composePose';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import { adapterPointQuery } from 'tools/builtin/select/adapterPointQuery';
import { hitTestArea } from './deps/hitTestArea';
import { pickWalk, scenePickSource } from './pickWalk';

const pointQuery = adapterPointQuery<RectPose>(AUTO_POSE_DESCRIPTOR as never, false);

/** A 10×10 square at (10, 10) inside a container copying it under `copies`. */
function copiedSquare(copies: readonly Affine[], clip?: RectPose) {
  const scene = createScene<{ kind: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({
    kind: 'group', layer: 'main', id: asNodeId('g'),
    pose: { x: 0, y: 0, width: 0, height: 0 }, data: { kind: 'group' },
    copiesFromPose: () => copies,
    // Without one, a container clips to its own pose rect, which is empty here.
    clipFromPose: () => (clip ? { kind: 'rect' as const, ...clip } : null),
  });
  scene.add({
    kind: 'mark', layer: 'main', id: asNodeId('sq'), parent: group,
    pose: { x: 10, y: 10, width: 10, height: 10 }, data: { kind: 'rect' },
  });
  return scene;
}

const pickAt = (scene: ReturnType<typeof copiedSquare>, x: number, y: number) =>
  pickWalk<RectPose>(scenePickSource(scene), { ...pointQuery(x, y, 0), includeGroups: false });

describe('pickWalk: a container drawing copies', () => {
  it('answers a pick on a copy with the child it copies', () => {
    const scene = copiedSquare([translate(100, 0)]);
    expect(pickAt(scene, 115, 15)).toEqual(['sq']);
    expect(pickAt(scene, 15, 15)).toEqual(['sq']);
    expect(pickAt(scene, 60, 15)).toEqual([]);
  });

  it('follows a copy that mirrors', () => {
    // Mirror across x = 50: the square lands on [80, 90].
    const mirror = multiply(translate(100, 0), scale(-1, 1));
    const scene = copiedSquare([mirror]);
    expect(pickAt(scene, 85, 15)).toEqual(['sq']);
    expect(pickAt(scene, 95, 15)).toEqual([]);
  });

  it('reaches through nested copies', () => {
    const scene = copiedSquare([translate(100, 0)]);
    const inner = scene.add({
      kind: 'group', layer: 'main', id: asNodeId('inner'), parent: asNodeId('g'),
      pose: { x: 0, y: 0, width: 0, height: 0 }, data: { kind: 'group' },
      clipFromPose: () => null,
      copiesFromPose: () => [translate(0, 100)],
    });
    scene.add({
      kind: 'mark', layer: 'main', id: asNodeId('dot'), parent: inner,
      pose: { x: 40, y: 40, width: 4, height: 4 }, data: { kind: 'rect' },
    });
    expect(pickAt(scene, 142, 142)).toEqual(['dot']);
    expect(pickAt(scene, 42, 142)).toEqual(['dot']);
    expect(pickAt(scene, 142, 42)).toEqual(['dot']);
  });

  it('clips a copy by the container\'s clip carried with it', () => {
    // The clip covers only the original's left half, so the copy keeps only its left half too.
    const scene = copiedSquare([translate(100, 0)], { x: 0, y: 0, width: 15, height: 100 });
    expect(pickAt(scene, 112, 15)).toEqual(['sq']);
    expect(pickAt(scene, 118, 15)).toEqual([]);
  });

  it('lets a marquee over a copy take the child it copies', () => {
    const scene = copiedSquare([translate(100, 0)]);
    expect(hitTestArea(scene as never, { x: 105, y: 5, width: 20, height: 20 })).toEqual(['sq']);
    expect(hitTestArea(scene as never, { x: 40, y: 5, width: 20, height: 20 })).toEqual([]);
  });

  it('carries a marquee through a rotating copy', () => {
    // A quarter turn about the origin takes the square to x ∈ [-20, -10], y ∈ [10, 20].
    const scene = copiedSquare([[0, 1, -1, 0, 0, 0]]);
    expect(hitTestArea(scene as never, { x: -18, y: 12, width: 4, height: 4 })).toEqual(['sq']);
  });
});
