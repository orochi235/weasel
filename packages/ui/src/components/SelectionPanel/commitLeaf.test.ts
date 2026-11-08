import { describe, expect, it } from 'vitest';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene } from '@weasel-js/core';
import type { PrefLeaf } from '@weasel-js/prefs';
import { leafWrites } from './commitLeaf';

const opacity: PrefLeaf = { kind: 'number', name: 'Opacity', description: '', default: 1 };
const leaf = { path: 'pose.opacity', leaf: opacity };

function setup() {
  const scene = createScene<{ kind: string }, 'default', Record<string, number>>({
    composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }],
  });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 0, opacity: 0.5 }, data: { kind: 'thing' } });
  const selection = { current: [asNodeId('a')] };
  return { scene, selection, pose: () => scene.get(asNodeId('a'))!.pose };
}

describe('leafWrites', () => {
  it('keeps a change made between a draft that never committed and the next edit', () => {
    const { scene, selection, pose } = setup();
    const w = leafWrites(scene);
    // A slider dragged away and back fires no change, so these drafts never reach a commit.
    w.draft(selection, leaf, () => 0.7);
    w.draft(selection, leaf, () => 0.5);
    scene.batch('Move', () => scene.setPose(asNodeId('a'), { ...pose(), x: 50 }));
    w.draft(selection, leaf, () => 0.6);
    w.commit(selection, leaf, () => 0.8);
    expect(pose()).toEqual({ x: 50, opacity: 0.8 });
  });

  it('undoes a committed edit to where it began, before its drafts', () => {
    const { scene, selection, pose } = setup();
    const w = leafWrites(scene);
    w.draft(selection, leaf, () => 0.7);
    w.commit(selection, leaf, () => 0.8);
    expect(pose()).toEqual({ x: 0, opacity: 0.8 });
    scene.undo();
    expect(pose()).toEqual({ x: 0, opacity: 0.5 });
  });
});
