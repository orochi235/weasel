import { describe, expect, it } from 'vitest';
import type { GroupDrawCommand, PathDrawCommand } from '../../renderer';
import {
  composeSelectionPose,
  createSelectionOverlayLayer,
  createSelectionOutlineLayer,
  createSelectionHandlesLayer,
} from './overlay';
import type { Group, GroupAdapter } from '../groups/types';
import { asNodeId } from 'core/scene/types';
import { MULTI_RESIZE_TARGET_ID } from 'core/selection/selectionTarget';

function makeGroupAdapter(groups: Group[]): GroupAdapter {
  const byId = new Map<string, Group>(groups.map((g) => [g.id, { ...g, members: [...g.members] }]));
  return {
    getGroup: (id) => byId.get(id),
    getGroupsForMember: (id) =>
      [...byId.values()].filter((g) => g.members.includes(id)).map((g) => g.id),
    insertGroup: (g) => byId.set(g.id, { ...g, members: [...g.members] }),
    removeGroup: (id) => void byId.delete(id),
    addToGroup: (gid, ids) => {
      const g = byId.get(gid);
      if (g) g.members.push(...ids);
    },
    removeFromGroup: (gid, ids) => {
      const g = byId.get(gid);
      if (g) g.members = g.members.filter((m) => !ids.includes(m));
    },
  };
}

interface Pose {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DIMS = { width: 200, height: 200 };

describe('composeSelectionPose', () => {
  const stored: Record<string, Pose> = {
    a: { x: 0, y: 0, width: 10, height: 10 },
    b: { x: 50, y: 50, width: 20, height: 20 },
  };
  const getStoredPose = (id: string) => stored[id];

  it('prefers move overlay over resize overlay and stored', () => {
    const movedA: Pose = { x: 100, y: 100, width: 10, height: 10 };
    const resize = { id: 'a', currentPose: { x: 200, y: 200, width: 30, height: 30 } };
    const resolve = composeSelectionPose<Pose>({
      moveOverlay: { poses: new Map([['a', movedA]]) },
      resizeOverlay: resize,
      getStoredPose,
    });
    expect(resolve('a')).toBe(movedA);
  });

  it('uses resize overlay when move overlay does not cover the id', () => {
    const resizePose: Pose = { x: 200, y: 200, width: 30, height: 30 };
    const resolve = composeSelectionPose<Pose>({
      moveOverlay: { poses: new Map() },
      resizeOverlay: { id: 'a', currentPose: resizePose },
      getStoredPose,
    });
    expect(resolve('a')).toBe(resizePose);
    // Different id falls through to stored.
    expect(resolve('b')).toBe(stored.b);
  });

  it('falls through to stored pose when both overlays absent', () => {
    const resolve = composeSelectionPose<Pose>({
      moveOverlay: null,
      resizeOverlay: null,
      getStoredPose,
    });
    expect(resolve('a')).toBe(stored.a);
    expect(resolve('b')).toBe(stored.b);
  });

  it('handles undefined overlay opts as falsy', () => {
    const resolve = composeSelectionPose<Pose>({ getStoredPose });
    expect(resolve('a')).toBe(stored.a);
  });
});

describe('composeSelectionPose with groups', () => {
  const stored: Record<string, Pose> = {
    a: { x: 0, y: 0, width: 10, height: 10 },
    b: { x: 50, y: 50, width: 20, height: 20 },
    c: { x: 100, y: 0, width: 5, height: 5 },
  };
  const getStoredPose = (id: string): Pose => stored[id];

  it('non-group id with adapter resolves identical to no-adapter behavior', () => {
    const adapter = makeGroupAdapter([{ id: 'g1', members: ['a', 'b'] }]);
    const resolve = composeSelectionPose<Pose>({ getStoredPose, groupAdapter: adapter });
    expect(resolve('a')).toBe(stored.a);
    expect(resolve('b')).toBe(stored.b);
  });

  it('groupAdapter not provided: id treated as a leaf even if it would be a group', () => {
    const stub: Pose = { x: -1, y: -1, width: 1, height: 1 };
    const resolve = composeSelectionPose<Pose>({
      getStoredPose: (id) => (id === 'g1' ? stub : stored[id]),
    });
    expect(resolve('g1')).toBe(stub);
  });

  it('group of 2 rects: union bounds is the envelope', () => {
    const adapter = makeGroupAdapter([{ id: 'g1', members: ['a', 'b'] }]);
    const resolve = composeSelectionPose<Pose>({ getStoredPose, groupAdapter: adapter });
    expect(resolve('g1')).toEqual({ x: 0, y: 0, width: 70, height: 70 });
  });

  it('composed group: union expands across all transitive leaves', () => {
    const adapter = makeGroupAdapter([
      { id: 'inner', members: ['a', 'b'] },
      { id: 'outer', members: ['inner', 'c'] },
    ]);
    const resolve = composeSelectionPose<Pose>({ getStoredPose, groupAdapter: adapter });
    expect(resolve('outer')).toEqual({ x: 0, y: 0, width: 105, height: 70 });
  });

  it('move overlay precedence: union uses overlay pose for dragged leaves', () => {
    const adapter = makeGroupAdapter([{ id: 'g1', members: ['a', 'b'] }]);
    const movedA: Pose = { x: 200, y: 200, width: 10, height: 10 };
    const resolve = composeSelectionPose<Pose>({
      moveOverlay: { poses: new Map([['a', movedA]]) },
      getStoredPose,
      groupAdapter: adapter,
    });
    expect(resolve('g1')).toEqual({ x: 50, y: 50, width: 160, height: 160 });
  });

  it('resize overlay on a group: uses per-leaf overlay map when available', () => {
    const adapter = makeGroupAdapter([{ id: 'g1', members: ['a', 'b'] }]);
    const overlayA: Pose = { x: 0, y: 0, width: 30, height: 30 };
    const overlayB: Pose = { x: 30, y: 30, width: 30, height: 30 };
    const resolve = composeSelectionPose<Pose>({
      resizeOverlay: {
        id: 'g1',
        currentPose: { x: 0, y: 0, width: 0, height: 0 },
        leafPoses: new Map([
          ['a', overlayA],
          ['b', overlayB],
        ]),
      },
      getStoredPose,
      groupAdapter: adapter,
    });
    expect(resolve('g1')).toEqual({ x: 0, y: 0, width: 60, height: 60 });
  });

  it('resize overlay on a group without leafPoses falls back to stored', () => {
    const adapter = makeGroupAdapter([{ id: 'g1', members: ['a', 'b'] }]);
    const resolve = composeSelectionPose<Pose>({
      resizeOverlay: {
        id: 'g1',
        currentPose: { x: 0, y: 0, width: 0, height: 0 },
      },
      getStoredPose,
      groupAdapter: adapter,
    });
    expect(resolve('g1')).toEqual({ x: 0, y: 0, width: 70, height: 70 });
  });

  it('empty group: returns null', () => {
    const adapter = makeGroupAdapter([{ id: 'g1', members: [] }]);
    const resolve = composeSelectionPose<Pose>({ getStoredPose, groupAdapter: adapter });
    expect(resolve('g1')).toBeNull();
  });

  it('cycle-safe: groups containing each other terminate', () => {
    const adapter = makeGroupAdapter([
      { id: 'g1', members: ['a', 'g2'] },
      { id: 'g2', members: ['b', 'g1'] },
    ]);
    const resolve = composeSelectionPose<Pose>({ getStoredPose, groupAdapter: adapter });
    expect(resolve('g1')).toEqual({ x: 0, y: 0, width: 70, height: 70 });
  });
});

describe('createSelectionOverlayLayer', () => {
  it('exposes the expected RenderLayer id/label', () => {
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => [],
      getPose: () => null,
    });
    expect(layer.id).toBe('selection-overlay');
    expect(typeof layer.label).toBe('string');
  });

  it('returns [] when selection is empty', () => {
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => [],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    expect(tree).toEqual([]);
  });

  it('getOutlineIds drives per-item outline pass independently of getSelection', () => {
    // Multi-mode setup: getSelection returns the synthetic union id (pose
    // looked up below); getOutlineIds returns the real members so the
    // outline pass strokes each one.
    const SYNTHETIC = '__multi__';
    const poses: Record<string, Pose> = {
      [SYNTHETIC]: { x: 0, y: 0, width: 100, height: 100 },
      a: { x: 10, y: 10, width: 20, height: 20 },
      b: { x: 60, y: 60, width: 20, height: 20 },
    };
    // Vary getOutlineIds across two layer configs and verify the count
    // delta — anything else (handles, etc.) is invariant since getSelection
    // is identical in both.
    const oneOutline = createSelectionOverlayLayer<Pose>({
      getSelection: () => [asNodeId(SYNTHETIC)],
      getOutlineIds: () => [asNodeId('a')],
      getPose: (id) => poses[id] ?? null,
      handles: { size: 8 },
    });
    const twoOutlines = createSelectionOverlayLayer<Pose>({
      getSelection: () => [asNodeId(SYNTHETIC)],
      getOutlineIds: () => [asNodeId('a'), asNodeId('b')],
      getPose: (id) => poses[id] ?? null,
      handles: { size: 8 },
    });
    const oneTree = oneOutline.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    const twoTree = twoOutlines.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    // Adding one more outline id should add exactly one more drawcommand.
    expect(twoTree.length - oneTree.length).toBe(1);
  });

  it('getOutlineIds defaults to getSelection when omitted', () => {
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      handles: false,
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    // Outline pass only (handles disabled). One stroke for the selected id.
    expect(tree.filter((c) => c.kind === 'path').length).toBe(1);
  });

  describe('multi-union resolves from chromeState', () => {
    // Phase 5 cleanup: the synthetic multi-resize id resolves to
    // `ChromeState.unionBounds` (the single owner of the union AABB) when the
    // draw envelope carries a `getChromeState` thunk. `getPose` deliberately
    // returns a faraway rect for the synthetic id so we can prove chromeState
    // wins over the construction-time resolver.
    const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => [asNodeId(MULTI_RESIZE_TARGET_ID)],
      getPose: (id) =>
        id === MULTI_RESIZE_TARGET_ID ? { x: 999, y: 999, width: 1, height: 1 } : null,
      handles: false, // outline pass only → one stroke whose rect we can read
    });

    it('resolves the synthetic id to chromeState.unionBounds when the envelope carries it', () => {
      const data = { getChromeState: () => ({ unionBounds: { x: 0, y: 0, width: 100, height: 100 } }) };
      const tree = layer.draw(data, VIEW, DIMS);
      const stroke = tree.find((c) => c.kind === 'path') as PathDrawCommand;
      expect(stroke).toBeDefined();
      const rect = stroke.path as { x: number; y: number; width: number };
      // The union (0,0,100×100), not getPose's faraway {999,999,1,1}.
      expect(rect.x).toBeLessThan(10);
      expect(rect.width).toBeGreaterThan(90);
    });

    it('falls back to getPose for the synthetic id when no chromeState rides the envelope', () => {
      const tree = layer.draw(undefined, VIEW, DIMS);
      const stroke = tree.find((c) => c.kind === 'path') as PathDrawCommand;
      expect(stroke).toBeDefined();
      const rect = stroke.path as { x: number };
      // getPose's faraway rect (x≈999) drives the outline — preserves the
      // pre-chromeState behavior for bare/test callers.
      expect(rect.x).toBeGreaterThan(900);
    });
  });

  describe('chrome-caps visibility gate', () => {
    // The data envelope SceneCanvas passes carries a `getIsVisible` thunk
    // alongside `getChromeState` / `getDebug`. Each of the three passes
    // gates on its canonical chrome id.
    const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      handles: { size: 8 },
      rotationHandle: true,
    });
    const data = (allow: Set<string>) => ({
      getIsVisible: () => (id: string) => allow.has(id),
    });

    it('hides selection.outline when its rule reports false', () => {
      const withOutline = layer.draw(data(new Set([
        'selection.outline', 'selection.resize-handles', 'selection.rotation-handle',
      ])), VIEW, DIMS);
      const withoutOutline = layer.draw(data(new Set([
        'selection.resize-handles', 'selection.rotation-handle',
      ])), VIEW, DIMS);
      expect(withoutOutline.length).toBeLessThan(withOutline.length);
    });

    it('hides selection.resize-handles when its rule reports false', () => {
      const withHandles = layer.draw(data(new Set([
        'selection.outline', 'selection.resize-handles', 'selection.rotation-handle',
      ])), VIEW, DIMS);
      const withoutHandles = layer.draw(data(new Set([
        'selection.outline', 'selection.rotation-handle',
      ])), VIEW, DIMS);
      expect(withoutHandles.length).toBeLessThan(withHandles.length);
    });

    it('hides selection.rotation-handle when its rule reports false', () => {
      const withRot = layer.draw(data(new Set([
        'selection.outline', 'selection.resize-handles', 'selection.rotation-handle',
      ])), VIEW, DIMS);
      const withoutRot = layer.draw(data(new Set([
        'selection.outline', 'selection.resize-handles',
      ])), VIEW, DIMS);
      expect(withoutRot.length).toBeLessThan(withRot.length);
    });

    it('renders everything when no getIsVisible is wired (legacy callers)', () => {
      const legacy = layer.draw(undefined, VIEW, DIMS);
      const allOn = layer.draw(data(new Set([
        'selection.outline', 'selection.resize-handles', 'selection.rotation-handle',
      ])), VIEW, DIMS);
      expect(legacy.length).toBe(allOn.length);
    });
  });
});

describe('createSelectionOutlineLayer', () => {
  it('emits one stroke path per selected id (screen-space, no group wrapper)', () => {
    const layer = createSelectionOutlineLayer<Pose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => ({ x: 10, y: 20, width: 30, height: 40 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('path');
    expect((tree[0] as PathDrawCommand).stroke).toBeDefined();
  });

  it('returns [] when nothing is selected', () => {
    const layer = createSelectionOutlineLayer<Pose>({
      getSelection: () => [],
      getPose: () => ({ x: 0, y: 0, width: 1, height: 1 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    expect(tree).toEqual([]);
  });
});

describe('createSelectionHandlesLayer', () => {
  it('emits 4 corner handles (fill + outline path each = 8 commands)', () => {
    const layer = createSelectionHandlesLayer<Pose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    expect(tree).toHaveLength(8);
    expect(tree.every((c) => c.kind === 'path')).toBe(true);
  });
});

describe('createSelectionOverlayLayer.draw', () => {
  it('emits outline + handles commands in a single flat list', () => {
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => ({ x: 0, y: 0, width: 100, height: 100 }),
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    // 1 outline + 4×2 handles = 9
    expect(tree).toHaveLength(9);
  });

  it('emits outline only when handles: false', () => {
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => ({ x: 0, y: 0, width: 100, height: 100 }),
      handles: false,
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    expect(tree).toHaveLength(1);
  });

  it('wraps rotated outlines in a kind:group with a transform', () => {
    interface RotPose extends Pose {
      rotation: number;
    }
    const layer = createSelectionOverlayLayer<RotPose>({
      getSelection: () => [asNodeId('a')],
      getPose: () => ({ x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 4 }),
      handles: false,
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, DIMS);
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('group');
    const group = tree[0] as GroupDrawCommand;
    expect(group.transform).toBeDefined();
    expect(group.children[0].kind).toBe('path');
  });
});
