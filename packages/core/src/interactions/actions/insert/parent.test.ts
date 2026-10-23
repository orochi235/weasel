import { describe, it, expect } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { insertParent } from './parent';

const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
const MARK = scene.add({ id: asNodeId('m'), kind: 'mark', layer: 'main', data: {}, pose: POSE });
const GROUP = scene.add({ id: asNodeId('g'), kind: 'group', layer: 'main', data: {}, pose: POSE });

describe('insertParent', () => {
  it('puts an insert into a mark at the top level when nothing admits it', () => {
    expect(insertParent(scene, MARK)).toBeNull();
  });

  it('puts an insert into a mark under it when canDropInto admits it', () => {
    expect(insertParent(scene, MARK, (p) => p === MARK)).toBe(MARK);
  });

  it('puts an insert into a group under it', () => {
    expect(insertParent(scene, GROUP)).toBe(GROUP);
  });

  it('honors a canDropInto that refuses a group', () => {
    expect(insertParent(scene, GROUP, () => false)).toBeNull();
  });
});
