import { describe, expect, it, vi } from 'vitest';
import {
  composeSelectionPose,
  createSelectionOverlayLayer,
  createSelectionOutlineLayer,
  createSelectionHandlesLayer,
} from './selectionOverlay';
import type { Group, GroupAdapter } from '../groups/types';
import { boundsOfPath, polygonFromPoints } from '../paths';

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

interface RecordedCall {
  fn: string;
  args: number[];
}

interface StubCtx {
  ctx: CanvasRenderingContext2D;
  calls: RecordedCall[];
}

function makeStubCtx(): StubCtx {
  const calls: RecordedCall[] = [];
  const state = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
  };
  const record = (fn: string) =>
    vi.fn((...args: number[]) => {
      calls.push({ fn, args });
    });
  const ctx = {
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(v: string) { state.strokeStyle = v; },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v: string) { state.fillStyle = v; },
    get lineWidth() { return state.lineWidth; },
    set lineWidth(v: number) { state.lineWidth = v; },
    get lineCap() { return state.lineCap; },
    set lineCap(v: string) { state.lineCap = v; },
    get lineJoin() { return state.lineJoin; },
    set lineJoin(v: string) { state.lineJoin = v; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v: number) { state.globalAlpha = v; },
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    strokeRect: record('strokeRect'),
    fillRect: record('fillRect'),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

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
    // Without adapter, even 'g1' goes through getStoredPose.
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

  it('nested group: union expands across all transitive leaves', () => {
    const adapter = makeGroupAdapter([
      { id: 'inner', members: ['a', 'b'] },
      { id: 'outer', members: ['inner', 'c'] },
    ]);
    const resolve = composeSelectionPose<Pose>({ getStoredPose, groupAdapter: adapter });
    // a (0,0,10,10), b (50,50,20,20), c (100,0,5,5)
    // minX=0, minY=0, maxRight=105, maxBottom=70
    expect(resolve('outer')).toEqual({ x: 0, y: 0, width: 105, height: 70 });
  });

  it('move overlay precedence: union uses overlay pose for dragged leaves', () => {
    const adapter = makeGroupAdapter([{ id: 'g1', members: ['a', 'b'] }]);
    // 'a' is being dragged; overlay places it far away.
    const movedA: Pose = { x: 200, y: 200, width: 10, height: 10 };
    const resolve = composeSelectionPose<Pose>({
      moveOverlay: { poses: new Map([['a', movedA]]) },
      getStoredPose,
      groupAdapter: adapter,
    });
    // Union of moved 'a' (200,200,10,10) and stored 'b' (50,50,20,20).
    // minX=50, minY=50, maxRight=210, maxBottom=210
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
    // Falls back to stored union: union(a,b).
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
    // expandToLeaves yields a + b; union bounds are (0,0)-(70,70).
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

  it('renders nothing when selection is empty', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => [],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    });
    layer.draw(ctx, undefined);
    expect(calls).toEqual([]);
  });

  it('skips ids whose getPose returns null', () => {
    const { ctx, calls } = makeStubCtx();
    const poses: Record<string, Pose | null> = {
      a: { x: 10, y: 20, width: 30, height: 40 },
      b: null,
    };
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['a', 'b'],
      getPose: (id) => poses[id],
    });
    layer.draw(ctx, undefined);
    // 1 outline strokeRect for "a" + 4 handle strokeRects for "a" = 5 strokeRects.
    const strokeRects = calls.filter((c) => c.fn === 'strokeRect');
    const fillRects = calls.filter((c) => c.fn === 'fillRect');
    expect(strokeRects).toHaveLength(5);
    expect(fillRects).toHaveLength(4);
  });

  it('draws outline rect with default 1-px pad', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 10, y: 20, width: 30, height: 40 }),
      handles: false,
    });
    layer.draw(ctx, undefined);
    const strokeRects = calls.filter((c) => c.fn === 'strokeRect');
    expect(strokeRects).toHaveLength(1);
    expect(strokeRects[0].args).toEqual([9, 19, 32, 42]);
  });

  it('renders outline-only when handles: false', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      handles: false,
    });
    layer.draw(ctx, undefined);
    expect(calls.filter((c) => c.fn === 'fillRect')).toHaveLength(0);
    expect(calls.filter((c) => c.fn === 'strokeRect')).toHaveLength(1);
  });

  it('uses handlesOf override when provided', () => {
    const { ctx, calls } = makeStubCtx();
    const customHandles = [
      { x: 5, y: 5 },
      { x: 15, y: 15 },
    ];
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      handlesOf: () => customHandles,
    });
    layer.draw(ctx, undefined);
    const fillRects = calls.filter((c) => c.fn === 'fillRect');
    // 2 custom handles instead of default 4.
    expect(fillRects).toHaveLength(2);
    // Default size is 8 -> half=4 -> top-left at (1,1) and (11,11).
    expect(fillRects[0].args).toEqual([1, 1, 8, 8]);
    expect(fillRects[1].args).toEqual([11, 11, 8, 8]);
  });

  it('renders union-bounds rect for a group id when groupAdapter is supplied', () => {
    const { ctx, calls } = makeStubCtx();
    const stored: Record<string, Pose> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 50, y: 50, width: 20, height: 20 },
    };
    const adapter = makeGroupAdapter([{ id: 'g1', members: ['a', 'b'] }]);
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['g1'],
      getPose: (id) => stored[id] ?? null,
      groupAdapter: adapter,
      handles: false,
    });
    layer.draw(ctx, undefined);
    const strokeRects = calls.filter((c) => c.fn === 'strokeRect');
    expect(strokeRects).toHaveLength(1);
    // Union 0,0,70,70 with default pad 1 -> -1,-1,72,72.
    expect(strokeRects[0].args).toEqual([-1, -1, 72, 72]);
  });

  it('honors custom handle size and outline pad', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      outline: { paint: { fill: 'solid', color: '#fff' }, width: 3, pad: 2 },
      handles: {
        size: 4,
        fill: { fill: 'solid', color: '#000' },
        outline: { paint: { fill: 'solid', color: '#fff' }, width: 1 },
      },
    });
    layer.draw(ctx, undefined);
    const outlineCall = calls.filter((c) => c.fn === 'strokeRect')[0];
    expect(outlineCall.args).toEqual([-2, -2, 14, 14]);
    const fillRects = calls.filter((c) => c.fn === 'fillRect');
    // Default 4 corners, size 4 -> half=2 -> first at (-2,-2,4,4).
    expect(fillRects[0].args).toEqual([-2, -2, 4, 4]);
  });

  it('outline align: inner shifts the rect inward by width/2', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      outline: { paint: { fill: 'solid', color: '#fff' }, width: 4, pad: 0, align: 'inner' },
      handles: false,
    });
    layer.draw(ctx, undefined);
    // pose (0,0,10,10) with align=inner, width=4 -> shift inward by 2 on each side.
    const stroke = calls.filter((c) => c.fn === 'strokeRect')[0];
    expect(stroke.args).toEqual([2, 2, 6, 6]);
  });

  it('outline align: outer shifts the rect outward by width/2', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      outline: { paint: { fill: 'solid', color: '#fff' }, width: 4, pad: 0, align: 'outer' },
      handles: false,
    });
    layer.draw(ctx, undefined);
    const stroke = calls.filter((c) => c.fn === 'strokeRect')[0];
    expect(stroke.args).toEqual([-2, -2, 14, 14]);
  });

  it('outline align: center matches default canvas behavior', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionOverlayLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      outline: { paint: { fill: 'solid', color: '#fff' }, width: 4, pad: 0, align: 'center' },
      handles: false,
    });
    layer.draw(ctx, undefined);
    const stroke = calls.filter((c) => c.fn === 'strokeRect')[0];
    expect(stroke.args).toEqual([0, 0, 10, 10]);
  });
});

describe('createSelectionOutlineLayer', () => {
  it('exposes id/label and draws an outline only (no fill)', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionOutlineLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 10, y: 20, width: 30, height: 40 }),
    });
    expect(layer.id).toBe('selection-outline');
    layer.draw(ctx, undefined);
    expect(calls.filter((c) => c.fn === 'strokeRect')).toHaveLength(1);
    expect(calls.filter((c) => c.fn === 'fillRect')).toHaveLength(0);
  });

  it('resolves a group id to its union AABB', () => {
    const { ctx, calls } = makeStubCtx();
    const stored: Record<string, Pose> = {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 50, y: 50, width: 20, height: 20 },
    };
    const adapter = makeGroupAdapter([{ id: 'g1', members: ['a', 'b'] }]);
    const layer = createSelectionOutlineLayer<Pose>({
      getSelection: () => ['g1'],
      getPose: (id: string) => stored[id] ?? null,
      groupAdapter: adapter,
    });
    layer.draw(ctx, undefined);
    const stroke = calls.filter((c) => c.fn === 'strokeRect')[0];
    expect(stroke.args).toEqual([-1, -1, 72, 72]);
  });
});

describe('createSelectionHandlesLayer', () => {
  it('exposes id/label and draws fill + stroke per handle (4 by default)', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionHandlesLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
    });
    expect(layer.id).toBe('selection-handles');
    layer.draw(ctx, undefined);
    expect(calls.filter((c) => c.fn === 'fillRect')).toHaveLength(4);
    expect(calls.filter((c) => c.fn === 'strokeRect')).toHaveLength(4);
  });

  it('honors handlesOf override', () => {
    const { ctx, calls } = makeStubCtx();
    const layer = createSelectionHandlesLayer<Pose>({
      getSelection: () => ['a'],
      getPose: () => ({ x: 0, y: 0, width: 10, height: 10 }),
      handlesOf: () => [{ x: 5, y: 5 }],
    });
    layer.draw(ctx, undefined);
    expect(calls.filter((c) => c.fn === 'fillRect')).toHaveLength(1);
  });
});

describe('Path TPose via boundsOfPath', () => {
  it('renders outline + 4 corner handles around a Path AABB', () => {
    const { ctx, calls } = makeStubCtx();
    const tri = polygonFromPoints([
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 30, y: 80 },
    ]);
    const layer = createSelectionOverlayLayer({
      getSelection: () => ['a'],
      getPose: () => tri,
      getBounds: boundsOfPath,
    });
    layer.draw(ctx, undefined);
    const stroke = calls.find((c) => c.fn === 'strokeRect');
    // AABB is (10,20)..(50,80) → padded by 1 → (9,19,42,62)
    expect(stroke?.args).toEqual([9, 19, 42, 62]);
    // Default 4 corner handles at AABB corners.
    const handleFills = calls.filter((c) => c.fn === 'fillRect');
    expect(handleFills).toHaveLength(4);
  });
});

describe('non-rect TPose via getBounds', () => {
  it('renders an outline for a polygon-shaped pose', () => {
    const { ctx, calls } = makeStubCtx();
    type PolyPose = { kind: 'poly'; points: { x: number; y: number }[] };
    const tri: PolyPose = {
      kind: 'poly',
      points: [{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 30, y: 80 }],
    };
    const layer = createSelectionOverlayLayer<PolyPose>({
      getSelection: () => ['a'],
      getPose: () => tri,
      getBounds: (p) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const pt of p.points) {
          if (pt.x < minX) minX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y > maxY) maxY = pt.y;
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      },
      handles: false,
    });
    layer.draw(ctx, undefined);
    const stroke = calls.find((c) => c.fn === 'strokeRect');
    // AABB is (10,20)..(50,80) → padded by 1 → (9,19,42,62)
    expect(stroke?.args).toEqual([9, 19, 42, 62]);
  });
});
