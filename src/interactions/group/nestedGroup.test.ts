import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useNestedGroupAction,
  useNestedUngroupAction,
  type NestedGroupActionAdapter,
} from './nestedGroup';
import { composeRectPose, decomposeRectPose } from '../../transforms/composePose';
import type { Op } from '../../ops/types';

interface Rect { x: number; y: number; width: number; height: number }
interface Obj { id: string; pose: Rect; parent: string | null }

interface Harness {
  adapter: NestedGroupActionAdapter<Obj, Rect>;
  selection: string[];
  scene: Map<string, Obj>;
  batches: { ops: Op[]; label: string }[];
}

function makeHarness(initial: Obj[], selection: string[] = []): Harness {
  const scene = new Map<string, Obj>();
  for (const o of initial) scene.set(o.id, { ...o, pose: { ...o.pose } });
  const h: Harness = {
    selection: [...selection],
    scene,
    batches: [],
    adapter: {} as NestedGroupActionAdapter<Obj, Rect>,
  };
  h.adapter = ({
    getSelection: () => h.selection,
    setSelection: (ids: string[]) => { h.selection = [...ids]; },
    getObject: (id: string) => h.scene.get(id),
    getPose: (id: string) => h.scene.get(id)!.pose,
    setPose: (id: string, pose: Rect) => { h.scene.get(id)!.pose = { ...pose }; },
    getParent: (id: string) => h.scene.get(id)!.parent,
    setParent: (id: string, parent: string | null) => { h.scene.get(id)!.parent = parent; },
    insertObject: (obj: Obj) => { h.scene.set(obj.id, { ...obj, pose: { ...obj.pose } }); },
    removeObject: (id: string) => { h.scene.delete(id); },
    getChildren: (id: string | null) =>
      [...h.scene.values()].filter((o) => o.parent === id).map((o) => o.id),
    applyBatch: (ops: Op[], label: string) => {
      h.batches.push({ ops, label });
      for (const op of ops) op.apply(h.adapter);
    },
  } as unknown) as NestedGroupActionAdapter<Obj, Rect>;
  return h;
}

const composeOpts = { composePose: composeRectPose<Rect>, decomposePose: decomposeRectPose<Rect> };

function worldOf(h: Harness, id: string): Rect {
  let pose = { ...h.scene.get(id)!.pose };
  let p = h.scene.get(id)!.parent;
  while (p !== null) {
    const pp = h.scene.get(p)!.pose;
    pose = { ...pose, x: pose.x + pp.x, y: pose.y + pp.y };
    p = h.scene.get(p)!.parent;
  }
  return pose;
}

describe('useNestedGroupAction', () => {
  it('inserts a new group object, reparents children, and rebases their locals so visual world position is preserved', () => {
    const h = makeHarness(
      [
        { id: 'a', pose: { x: 10, y: 10, width: 5, height: 5 }, parent: null },
        { id: 'b', pose: { x: 30, y: 50, width: 5, height: 5 }, parent: null },
      ],
      ['a', 'b'],
    );
    const aBefore = worldOf(h, 'a');
    const bBefore = worldOf(h, 'b');
    const { result } = renderHook(() =>
      useNestedGroupAction(h.adapter, {
        ...composeOpts,
        newGroupId: () => 'g1',
        groupFactory: ({ id, localPose, childIds }) => ({
          id, parent: null, pose: localPose, // children stored separately by harness
          // childIds present for assertion convenience but unused in scene
          ...({ childIds } as object),
        } as Obj),
      }),
    );
    let groupId: string | null = null;
    act(() => { groupId = result.current.group(); });
    expect(groupId).toBe('g1');

    // Group inserted with bounds = AABB of children: x[10..35], y[10..55]
    expect(h.scene.get('g1')!.pose).toEqual({ x: 10, y: 10, width: 25, height: 45 });

    // Children reparented under g1.
    expect(h.scene.get('a')!.parent).toBe('g1');
    expect(h.scene.get('b')!.parent).toBe('g1');

    // Children's local poses are now relative to the group origin.
    expect(h.scene.get('a')!.pose).toEqual({ x: 0, y: 0, width: 5, height: 5 });
    expect(h.scene.get('b')!.pose).toEqual({ x: 20, y: 40, width: 5, height: 5 });

    // World positions are preserved.
    expect(worldOf(h, 'a')).toEqual(aBefore);
    expect(worldOf(h, 'b')).toEqual(bBefore);

    // Selection is now the new group.
    expect(h.selection).toEqual(['g1']);
  });

  it('preserves visual position when grouping objects that already have a parent', () => {
    const h = makeHarness(
      [
        { id: 'P', pose: { x: 100, y: 200, width: 0, height: 0 }, parent: null },
        { id: 'a', pose: { x: 5,   y: 5,   width: 5, height: 5 }, parent: 'P' },
        { id: 'b', pose: { x: 15,  y: 25,  width: 5, height: 5 }, parent: 'P' },
      ],
      ['a', 'b'],
    );
    const aBefore = worldOf(h, 'a');
    const bBefore = worldOf(h, 'b');
    const { result } = renderHook(() =>
      useNestedGroupAction(h.adapter, {
        ...composeOpts,
        newGroupId: () => 'g1',
        groupFactory: ({ id, localPose }) => ({ id, pose: localPose, parent: null } as Obj),
      }),
    );
    act(() => { result.current.group(); });

    // Group lands under P with local pose = AABB origin in world (105, 205)
    // minus P's world (100, 200) = local (5, 5).
    expect(h.scene.get('g1')!.parent).toBe('P');
    expect(h.scene.get('g1')!.pose).toEqual({ x: 5, y: 5, width: 15, height: 25 });

    // Children locals now relative to g1's world (105, 205).
    // a: world (105, 205) → local (0, 0). b: world (115, 225) → local (10, 20).
    expect(h.scene.get('a')!.pose).toEqual({ x: 0, y: 0, width: 5, height: 5 });
    expect(h.scene.get('b')!.pose).toEqual({ x: 10, y: 20, width: 5, height: 5 });

    expect(worldOf(h, 'a')).toEqual(aBefore);
    expect(worldOf(h, 'b')).toEqual(bBefore);
  });

  it('is a no-op when selection is below minMembers (default 2)', () => {
    const h = makeHarness(
      [{ id: 'a', pose: { x: 0, y: 0, width: 1, height: 1 }, parent: null }],
      ['a'],
    );
    const { result } = renderHook(() =>
      useNestedGroupAction(h.adapter, {
        ...composeOpts,
        groupFactory: ({ id, localPose }) => ({ id, pose: localPose, parent: null } as Obj),
      }),
    );
    let id: string | null = 'sentinel';
    act(() => { id = result.current.group(); });
    expect(id).toBeNull();
    expect(h.batches).toHaveLength(0);
  });
});

describe('useNestedUngroupAction', () => {
  it('reparents children to grandparent and rebases their locals; deletes the group object', () => {
    // Build a state equivalent to what group() above produces.
    const h = makeHarness(
      [
        { id: 'g1', pose: { x: 10, y: 10, width: 25, height: 45 }, parent: null },
        { id: 'a',  pose: { x: 0,  y: 0,  width: 5,  height: 5  }, parent: 'g1' },
        { id: 'b',  pose: { x: 20, y: 40, width: 5,  height: 5  }, parent: 'g1' },
      ],
      ['g1'],
    );
    const aBefore = worldOf(h, 'a');
    const bBefore = worldOf(h, 'b');
    const { result } = renderHook(() =>
      useNestedUngroupAction(h.adapter, composeOpts),
    );
    let dissolved: string[] = [];
    act(() => { dissolved = result.current.ungroup(); });
    expect(dissolved).toEqual(['g1']);

    // Group object is gone.
    expect(h.scene.has('g1')).toBe(false);

    // Children re-parented to root with locals matching their old world poses.
    expect(h.scene.get('a')!.parent).toBeNull();
    expect(h.scene.get('b')!.parent).toBeNull();
    expect(h.scene.get('a')!.pose).toEqual({ x: 10, y: 10, width: 5, height: 5 });
    expect(h.scene.get('b')!.pose).toEqual({ x: 30, y: 50, width: 5, height: 5 });

    // World positions preserved.
    expect(worldOf(h, 'a')).toEqual(aBefore);
    expect(worldOf(h, 'b')).toEqual(bBefore);

    // Selection becomes the surfaced children.
    expect(h.selection).toEqual(['a', 'b']);
  });

  it('rebases children to a non-null grandparent', () => {
    const h = makeHarness(
      [
        { id: 'P',  pose: { x: 100, y: 200, width: 0,  height: 0  }, parent: null },
        { id: 'g1', pose: { x: 5,   y: 5,   width: 15, height: 25 }, parent: 'P'  },
        { id: 'a',  pose: { x: 0,   y: 0,   width: 5,  height: 5  }, parent: 'g1' },
        { id: 'b',  pose: { x: 10,  y: 20,  width: 5,  height: 5  }, parent: 'g1' },
      ],
      ['g1'],
    );
    const aBefore = worldOf(h, 'a');
    const bBefore = worldOf(h, 'b');
    const { result } = renderHook(() =>
      useNestedUngroupAction(h.adapter, composeOpts),
    );
    act(() => { result.current.ungroup(); });

    // Children now under P. Locals expressed in P's frame.
    expect(h.scene.get('a')!.parent).toBe('P');
    expect(h.scene.get('b')!.parent).toBe('P');
    expect(h.scene.get('a')!.pose).toEqual({ x: 5,  y: 5,  width: 5, height: 5 });
    expect(h.scene.get('b')!.pose).toEqual({ x: 15, y: 25, width: 5, height: 5 });
    expect(worldOf(h, 'a')).toEqual(aBefore);
    expect(worldOf(h, 'b')).toEqual(bBefore);
  });

  it('skips selected ids that are not groups (childless leaves stay put)', () => {
    const h = makeHarness(
      [
        { id: 'leaf', pose: { x: 1, y: 1, width: 1, height: 1 }, parent: null },
      ],
      ['leaf'],
    );
    const { result } = renderHook(() =>
      useNestedUngroupAction(h.adapter, composeOpts),
    );
    let dissolved: string[] = [];
    act(() => { dissolved = result.current.ungroup(); });
    expect(dissolved).toEqual([]);
    expect(h.batches).toHaveLength(0);
  });
});

describe('round-trip: group then ungroup restores world positions', () => {
  it('after group + ungroup, every former child sits at its original world pose', () => {
    const h = makeHarness(
      [
        { id: 'a', pose: { x: 13, y: 17, width: 5, height: 5 }, parent: null },
        { id: 'b', pose: { x: 41, y: 23, width: 5, height: 5 }, parent: null },
        { id: 'c', pose: { x: 9,  y: 60, width: 5, height: 5 }, parent: null },
      ],
      ['a', 'b', 'c'],
    );
    const before = ['a', 'b', 'c'].map((id) => worldOf(h, id));

    const { result: gRes } = renderHook(() =>
      useNestedGroupAction(h.adapter, {
        ...composeOpts,
        newGroupId: () => 'g1',
        groupFactory: ({ id, localPose }) => ({ id, pose: localPose, parent: null } as Obj),
      }),
    );
    act(() => { gRes.current.group(); });

    const { result: uRes } = renderHook(() =>
      useNestedUngroupAction(h.adapter, composeOpts),
    );
    act(() => { uRes.current.ungroup(); });

    const after = ['a', 'b', 'c'].map((id) => worldOf(h, id));
    expect(after).toEqual(before);
    // And the group object is gone.
    expect(h.scene.has('g1')).toBe(false);
  });
});
