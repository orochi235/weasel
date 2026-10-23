import { describe, it, expect } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';

const POSE = { x: 0, y: 0, width: 10, height: 10 };
const X = asNodeId('x');
const clipA = () => ({ kind: 'rect' as const, x: 0, y: 0, width: 1, height: 1 });
const clipB = () => ({ kind: 'rect' as const, x: 0, y: 0, width: 2, height: 2 });

function makeScene() {
  const scene = createScene<{ label: string }, 'default'>({
    systemLayers: [{ id: 'default' }],
    registry: { clipFromPose: { a: clipA } },
  });
  const add = (clipFromPose?: typeof clipA) => scene.add({
    id: X, kind: 'group', layer: 'default', pose: { ...POSE }, data: { label: 'x' },
    ...(clipFromPose ? { clipFromPose } : {}),
  });
  const clip = () => (scene.get(X) as { clipFromPose?: unknown } | undefined)?.clipFromPose;
  return { scene, add, clip };
}

describe('Scene — function fields across re-added ids', () => {
  it('a node re-added under a removed id does not inherit the old clip', () => {
    const { scene, add, clip } = makeScene();
    add(clipA);
    scene.remove(X);
    add();

    expect(clip()).toBeUndefined();
    expect(scene.toJSON().nodes[0]).not.toHaveProperty('clipFromPoseKey');
  });

  it('an untracked add does not hand its clip to a later node of the same id', () => {
    const { scene, add, clip } = makeScene();
    scene.untracked(() => { add(clipA); });
    scene.untracked(() => { scene.remove(X); });
    add();

    expect(clip()).toBeUndefined();
  });

  it('an add inside a batch that throws does not hand its clip to a later node of the same id', () => {
    const { scene, add, clip } = makeScene();
    expect(() => scene.batch('fails', () => {
      add(clipB);
      throw new Error('refused');
    })).toThrow('refused');
    add();

    expect(clip()).toBeUndefined();
  });

  it('undo and redo give each incarnation of an id its own clip', () => {
    const { scene, add, clip } = makeScene();
    // clipB is not in the registry, so only the live reference can restore it.
    add(clipB);
    scene.remove(X);
    add();
    scene.remove(X);
    add(clipA);
    const seen = [clipB, undefined, undefined, undefined, clipA];

    for (let depth = 4; depth >= 0; depth--) {
      scene.undo();
      expect(clip()).toBe(depth === 0 ? undefined : seen[depth - 1]);
    }
    expect(scene.get(X)).toBeUndefined();
    for (let depth = 1; depth <= 5; depth++) {
      scene.redo();
      expect(clip()).toBe(seen[depth - 1]);
      expect(scene.get(X) !== undefined).toBe(depth % 2 === 1);
    }
  });
});
