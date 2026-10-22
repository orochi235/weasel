/**
 * Alone in its file so nothing has looked up a painter yet: the first lookup
 * registers the built-ins, which moves the memo generation the index keys on.
 */
import { expect, it } from 'vitest';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import { pickWalk, scenePickSource } from 'canvas/pickWalk';
import { pointPick } from './pickIndexFixture';
import { pickIndexBuildCount } from './scenePickIndex';

it('the second pick in a still scene builds, even when the first registered the painters', () => {
  const scene = createScene<unknown, string, unknown>({ systemLayers: [{ id: 'main' }] }) as Scene<unknown, string, unknown>;
  scene.add({ id: asNodeId('a'), kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 20, height: 20 }, data: null } as never);
  const src = scenePickSource(scene, { index: { descriptor: AUTO_POSE_DESCRIPTOR } });
  const q = pointPick(AUTO_POSE_DESCRIPTOR, 10, 10, { x: 1, y: 1 });
  expect(pickWalk(src, q)).toEqual(['a']);
  expect(pickIndexBuildCount()).toBe(0);
  expect(pickWalk(src, q)).toEqual(['a']);
  expect(pickIndexBuildCount()).toBe(1);
});
