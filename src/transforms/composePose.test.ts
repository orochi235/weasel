import { describe, expect, it } from 'vitest';
import {
  composeWorldPose,
  composeRectPose,
  decomposeRectPose,
  rebaseLocalPose,
  worldPoseLookup,
  type PoseAdapter,
} from './composePose';

interface Rect { x: number; y: number; width: number; height: number }

function makeAdapter(scene: Record<string, { pose: Rect; parent: string | null }>): PoseAdapter<Rect> {
  return {
    getPose: (id) => scene[id].pose,
    getParent: (id) => scene[id].parent,
  };
}

describe('composeWorldPose', () => {
  it('returns the local pose unchanged when there is no parent', () => {
    const a = makeAdapter({ root: { pose: { x: 5, y: 7, width: 10, height: 10 }, parent: null } });
    expect(composeWorldPose(a, 'root', composeRectPose)).toEqual({ x: 5, y: 7, width: 10, height: 10 });
  });

  it('adds a single parent translation', () => {
    const a = makeAdapter({
      g:    { pose: { x: 100, y: 200, width: 0, height: 0 }, parent: null },
      leaf: { pose: { x: 5,   y: 7,   width: 10, height: 10 }, parent: 'g' },
    });
    expect(composeWorldPose(a, 'leaf', composeRectPose)).toEqual({ x: 105, y: 207, width: 10, height: 10 });
  });

  it('folds a multi-level chain (root → group → subgroup → leaf)', () => {
    const a = makeAdapter({
      root:     { pose: { x: 1,   y: 2,   width: 0,  height: 0 }, parent: null },
      group:    { pose: { x: 10,  y: 20,  width: 0,  height: 0 }, parent: 'root' },
      subgroup: { pose: { x: 100, y: 200, width: 0,  height: 0 }, parent: 'group' },
      leaf:     { pose: { x: 3,   y: 4,   width: 50, height: 60 }, parent: 'subgroup' },
    });
    expect(composeWorldPose(a, 'leaf', composeRectPose)).toEqual({
      x: 1 + 10 + 100 + 3, y: 2 + 20 + 200 + 4, width: 50, height: 60,
    });
  });

  it('preserves extra fields on the child by carrying them through compose', () => {
    type Tagged = Rect & { label: string };
    const a: PoseAdapter<Tagged> = {
      getPose: (id) => (id === 'p'
        ? { x: 1, y: 2, width: 0, height: 0, label: 'p' }
        : { x: 10, y: 20, width: 5, height: 5, label: 'c' }),
      getParent: (id) => (id === 'c' ? 'p' : null),
    };
    expect(composeWorldPose(a, 'c', composeRectPose)).toEqual({
      x: 11, y: 22, width: 5, height: 5, label: 'c',
    });
  });

  it('terminates safely on a parent cycle without infinite-looping', () => {
    // Synthesize an a→b→a cycle. Result should not blow up; the fold ends
    // when the cursor revisits a chain node.
    const a = makeAdapter({
      a: { pose: { x: 1, y: 0, width: 0, height: 0 }, parent: 'b' },
      b: { pose: { x: 2, y: 0, width: 0, height: 0 }, parent: 'a' },
    });
    const out = composeWorldPose(a, 'a', composeRectPose);
    // Only one full traversal: chain = [a, b], so world = b + a (folded once).
    expect(out).toEqual({ x: 3, y: 0, width: 0, height: 0 });
  });
});

describe('composeRectPose / decomposeRectPose', () => {
  it('round-trips: decompose(parent, compose(parent, child)) === child', () => {
    const parent: Rect = { x: 50, y: 60, width: 0, height: 0 };
    const child: Rect = { x: 7, y: 8, width: 10, height: 12 };
    const world = composeRectPose(parent, child);
    expect(decomposeRectPose(parent, world)).toEqual(child);
  });
});

describe('rebaseLocalPose', () => {
  it('returns world unchanged when reparenting to root', () => {
    const a = makeAdapter({});
    const world: Rect = { x: 100, y: 200, width: 5, height: 5 };
    expect(rebaseLocalPose(a, world, null, composeRectPose, decomposeRectPose)).toEqual(world);
  });

  it('subtracts the new parent world position so visual location is preserved', () => {
    const a = makeAdapter({
      newParent: { pose: { x: 30, y: 40, width: 0, height: 0 }, parent: null },
    });
    const world: Rect = { x: 100, y: 200, width: 5, height: 5 };
    expect(rebaseLocalPose(a, world, 'newParent', composeRectPose, decomposeRectPose)).toEqual({
      x: 70, y: 160, width: 5, height: 5,
    });
  });

  it('round-trips through a nested new parent', () => {
    const a = makeAdapter({
      root:    { pose: { x: 10, y: 10, width: 0, height: 0 }, parent: null },
      mid:     { pose: { x: 5,  y: 5,  width: 0, height: 0 }, parent: 'root' },
    });
    const world: Rect = { x: 100, y: 100, width: 8, height: 8 };
    const local = rebaseLocalPose(a, world, 'mid', composeRectPose, decomposeRectPose);
    // mid in world = (15, 15); child local = (85, 85)
    expect(local).toEqual({ x: 85, y: 85, width: 8, height: 8 });
    // Re-compose with mid → original world
    const back = composeRectPose(composeWorldPose(a, 'mid', composeRectPose), local);
    expect(back).toEqual(world);
  });
});

describe('worldPoseLookup', () => {
  it('returns a callback that composes world poses by id', () => {
    const a = makeAdapter({
      g:    { pose: { x: 100, y: 200, width: 0, height: 0 }, parent: null },
      leaf: { pose: { x: 5,   y: 7,   width: 10, height: 10 }, parent: 'g' },
    });
    const lookup = worldPoseLookup(a, composeRectPose);
    expect(lookup('leaf')).toEqual({ x: 105, y: 207, width: 10, height: 10 });
    expect(lookup('g')).toEqual({ x: 100, y: 200, width: 0, height: 0 });
  });

  it('returns null for ids the adapter does not know about', () => {
    const a = makeAdapter({ root: { pose: { x: 0, y: 0, width: 1, height: 1 }, parent: null } });
    const lookup = worldPoseLookup(a, composeRectPose);
    expect(lookup('missing')).toBeNull();
  });
});
