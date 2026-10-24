import { describe, expect, it } from 'vitest';
import {
  applyToPoint, boundsOfPath, PathBuilder, pathToAnchors, rotateAboutPoint, transformPath, type PolygonPath,
} from '@weasel-js/geom';
import type { DistortWarp } from '@weasel-js/geom/warp';
import type { InvocationCtx, OngoingInvoker, ImmediateInvoker } from '@weasel-js/routing';
import {
  asNodeId, commitOps, createScene, createTransformOp, type RectPose, resolveEditablePathOf, type Scene, selectedPathNodes,
} from '@weasel-js/core';
import { heldPathWarpOf, resolvePathWarp } from './pathWarp';
import { splitByWarp } from './warpTargets';
import { readWarpSettings, warpSettingsParams } from './warpSettingsForm';
import {
  configureWarpAction, createAddPinAction, createWarpDragAction, expandWarpAction, type WarpHandleScratch,
} from './warpActions';

type S = Scene<unknown, string, unknown>;

/** A 100×100 square stored on `data.path`, at (`x`, `y`). */
function makeScene(x = 0, y = 0): S {
  const path = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [{
      id: asNodeId('a'), kind: 'mark', layer: 'main',
      pose: { x, y, width: 100, height: 100 },
      data: { path },
    }],
  }) as unknown as S;
}

const depsOf = (scene: S) => ({
  scene,
  selection: { get: () => ['a'], set: () => {}, clear: () => {} },
}) as unknown as InvocationCtx['deps'];

const ctx = (scene: S, world: { x: number; y: number }, drag?: InvocationCtx['drag']): InvocationCtx => ({
  world,
  modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  deps: depsOf(scene),
  ...(drag ? { drag } : {}),
});

/** Drag control `index` of warp `warpId` from `from` to `to`, and commit. */
function dragControl(
  scene: S, kind: 'distort' | 'envelope' | 'puppet', scratch: WarpHandleScratch,
  from: { x: number; y: number }, to: { x: number; y: number }, params: Record<string, unknown> = {},
) {
  const action = createWarpDragAction(kind);
  const drag = (at: { x: number; y: number }) => ({
    start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y },
    affordance: { kind: `layer:warp-${kind}`, payload: scratch },
  });
  const handle = (action.invoker as OngoingInvoker).start(ctx(scene, from, drag(from)), { params });
  handle.onMove?.(ctx(scene, to, drag(to)));
  handle.onEnd?.(ctx(scene, to, drag(to)), 'commit');
}

const anchorsOf = (scene: S) =>
  pathToAnchors(resolveEditablePathOf(scene.get(asNodeId('a')) as never) as PolygonPath).anchors[0]
    .map(({ x, y }) => ({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }));

describe('distort', () => {
  it('keeps its preview objects through a move that goes nowhere', () => {
    const scene = makeScene();
    const from = { x: 100, y: 100 };
    const to = { x: 120, y: 110 };
    const drag = (at: { x: number; y: number }) => ({
      start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y },
      affordance: { kind: 'layer:warp-distort', payload: { warpId: null, index: 2 } },
    });
    const handle = (createWarpDragAction('distort').invoker as OngoingInvoker).start(ctx(scene, from, drag(from)), { params: {} });
    handle.onMove?.(ctx(scene, to, drag(to)));
    const data = handle.previewData!('a');
    handle.onMove?.(ctx(scene, to, drag(to)));
    expect(handle.previewData!('a')).toBe(data);
  });

  it('makes a distort on the first corner drag and moves that corner of the shape', () => {
    const scene = makeScene(50, 50);
    dragControl(scene, 'distort', { warpId: null, index: 2 }, { x: 150, y: 150 }, { x: 180, y: 170 });
    const held = heldPathWarpOf(scene.get(asNodeId('a'))!.data);
    expect(held?.warp.kind).toBe('distort');
    expect(anchorsOf(scene)).toEqual([{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 180, y: 170 }, { x: 50, y: 150 }]);
    expect(scene.canUndo()).toBe(true);
  });

  it('keeps the warp through a move, and the next drag starts from where the corner is', () => {
    const scene = makeScene();
    dragControl(scene, 'distort', { warpId: null, index: 2 }, { x: 100, y: 100 }, { x: 120, y: 110 });
    const node = scene.get(asNodeId('a'))!;
    const moved = { ...(node.pose as RectPose), x: (node.pose as RectPose).x + 200 };
    commitOps(depsOf(scene), [createTransformOp({ id: node.id, from: node.pose, to: moved, label: 'Move' })], 'Move');
    const resolved = resolvePathWarp(scene.get(asNodeId('a')));
    expect(resolved).not.toBeNull();
    const id = resolved!.held.id;
    dragControl(scene, 'distort', { warpId: id, index: 0 }, { x: 200, y: 0 }, { x: 190, y: -10 });
    expect(anchorsOf(scene)).toEqual([{ x: 190, y: -10 }, { x: 300, y: 0 }, { x: 320, y: 110 }, { x: 200, y: 100 }]);
  });

  it('turns its corners with a node rotated after the warp', () => {
    const scene = makeScene();
    dragControl(scene, 'distort', { warpId: null, index: 2 }, { x: 100, y: 100 }, { x: 125, y: 110 });
    const node = scene.get(asNodeId('a'))!;
    const turned = { ...(node.pose as RectPose), rotation: 1.2 };
    commitOps(depsOf(scene), [createTransformOp({ id: node.id, from: node.pose, to: turned, label: 'Rotate' })], 'Rotate');
    const resolved = resolvePathWarp(scene.get(asNodeId('a')))!;
    expect(resolved).not.toBeNull();
    const { corners } = resolved.held.warp as DistortWarp;
    const handles = corners.map((c) => {
      const [x, y] = applyToPoint(resolved.toWorld, c.x, c.y);
      return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    });
    // The square's corners are the distort's, wherever the rotation took them.
    const anchors = anchorsOf(scene);
    handles.forEach((h, i) => {
      expect(h.x).toBeCloseTo(anchors[i].x, 2);
      expect(h.y).toBeCloseTo(anchors[i].y, 2);
    });
  });

  it('keeps the warp on a polygon pose rotated after it', () => {
    const square = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
    const scene = createScene<unknown, 'main', unknown>({
      systemLayers: [{ id: 'main' }],
      initial: [{ id: asNodeId('a'), kind: 'mark', layer: 'main', pose: square, data: {} }],
    }) as unknown as S;
    dragControl(scene, 'distort', { warpId: null, index: 2 }, { x: 100, y: 100 }, { x: 125, y: 110 });
    const node = scene.get(asNodeId('a'))!;
    const turned = transformPath(node.pose as PolygonPath, rotateAboutPoint(50, 50, 0.7));
    commitOps(depsOf(scene), [createTransformOp({ id: node.id, from: node.pose, to: turned, label: 'Rotate' })], 'Rotate');
    const resolved = resolvePathWarp(scene.get(asNodeId('a')))!;
    expect(resolved).not.toBeNull();
    const { corners } = resolved.held.warp as DistortWarp;
    const anchors = anchorsOf(scene);
    corners.forEach((c, i) => {
      const [x, y] = applyToPoint(resolved.toWorld, c.x, c.y);
      expect(x).toBeCloseTo(anchors[i].x, 2);
      expect(y).toBeCloseTo(anchors[i].y, 2);
    });
  });

  it('is dropped by Expand Warp, which keeps the geometry', () => {
    const scene = makeScene();
    dragControl(scene, 'distort', { warpId: null, index: 1 }, { x: 100, y: 0 }, { x: 130, y: 0 });
    const before = anchorsOf(scene);
    (expandWarpAction.invoker as ImmediateInvoker).run(depsOf(scene));
    expect(heldPathWarpOf(scene.get(asNodeId('a'))!.data)).toBeNull();
    expect(anchorsOf(scene)).toEqual(before);
  });

  it('keeps straight edges straight in perspective and bends them free', () => {
    // A diagonal inside the box: the edges of the box itself stay straight either way.
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: [{
        id: asNodeId('a'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 },
        data: { path: new PathBuilder().moveTo(0, 0).lineTo(100, 100).build() },
      }],
    }) as unknown as S;
    dragControl(scene, 'distort', { warpId: null, index: 1 }, { x: 100, y: 0 }, { x: 160, y: -20 }, { mode: 'free' });
    const curved = (resolveEditablePathOf(scene.get(asNodeId('a')) as never) as PolygonPath).commands.length;
    expect(curved).toBeGreaterThan(0);
    (configureWarpAction.invoker as ImmediateInvoker).run(depsOf(scene), { mode: 'perspective' });
    const straight = resolveEditablePathOf(scene.get(asNodeId('a')) as never) as PolygonPath;
    expect(Array.from(straight.commands)).toHaveLength(2);
  });
});

describe('envelope', () => {
  it('bends the shape through a dragged mesh point, and regrids on configureWarp', () => {
    const scene = makeScene();
    // A 2×2 mesh: point 4 is the middle one.
    dragControl(scene, 'envelope', { warpId: null, index: 1 }, { x: 50, y: 0 }, { x: 50, y: -30 }, { rows: 2, cols: 2 });
    const top = anchorsOf(scene);
    expect(top[0]).toEqual({ x: 0, y: 0 });
    const path = resolveEditablePathOf(scene.get(asNodeId('a')) as never) as PolygonPath;
    expect(Array.from(path.coords).some((v, i) => i % 2 === 1 && v < -20)).toBe(true);
    (configureWarpAction.invoker as ImmediateInvoker).run(depsOf(scene), { rows: 4, cols: 4 });
    const held = heldPathWarpOf(scene.get(asNodeId('a'))!.data);
    expect(held?.warp.kind === 'envelope' && held.warp.mesh.points.length).toBe(25);
  });
});

describe('puppet', () => {
  it('pins the shape, and a dragged pin leaves the other pin where it was', () => {
    const scene = makeScene();
    const addPin = createAddPinAction().invoker as ImmediateInvoker;
    addPin.run(depsOf(scene), { pressX: 0, pressY: 0 });
    addPin.run(depsOf(scene), { pressX: 100, pressY: 100 });
    const held = heldPathWarpOf(scene.get(asNodeId('a'))!.data)!;
    expect(held.warp.kind === 'puppet' && held.warp.pins).toHaveLength(2);
    dragControl(scene, 'puppet', { warpId: held.id, index: 1 }, { x: 100, y: 100 }, { x: 140, y: 60 });
    const anchors = anchorsOf(scene);
    // The bent edges may gain anchors; the pinned corners stay anchors, where their pins are.
    // `toEqual` tells -0 from 0, and the barycentric sum can land on either.
    expect(anchors[0].x === 0 && anchors[0].y === 0).toBe(true);
    expect(anchors).toContainEqual({ x: 140, y: 60 });
  });
});

describe('paths warped together', () => {
  /** Two 100×100 squares on `data.path`, `a` at the origin and `b` at (150, 0), both selected. */
  function pairScene(): S {
    const path = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
    const leaf = (id: string, x: number) => ({
      id: asNodeId(id), kind: 'mark' as const, layer: 'main' as const, pose: { x, y: 0, width: 100, height: 100 }, data: { path },
    });
    return createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }], initial: [leaf('a', 0), leaf('b', 150)],
    }) as unknown as S;
  }
  const pairDeps = (scene: S) => ({
    scene, selection: { get: () => ['a', 'b'], set: () => {}, clear: () => {} },
  }) as unknown as InvocationCtx['deps'];
  const pathOf = (scene: S, id: string) =>
    Array.from((resolveEditablePathOf(scene.get(asNodeId(id)) as never) as PolygonPath).coords);
  function drag(scene: S, scratch: WarpHandleScratch, from: { x: number; y: number }, to: { x: number; y: number }) {
    const d = (at: { x: number; y: number }) => ({
      start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y },
      affordance: { kind: 'layer:warp-distort', payload: scratch },
    });
    const c = (at: { x: number; y: number }): InvocationCtx => ({
      world: at, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: pairDeps(scene), drag: d(at),
    });
    const handle = (createWarpDragAction('distort').invoker as OngoingInvoker).start(c(from), { params: {} });
    handle.onMove?.(c(to));
    handle.onEnd?.(c(to), 'commit');
  }

  it('part once one is moved alone: its controls stay on it, and the other warp leaves it be', () => {
    const scene = pairScene();
    drag(scene, { warpId: null, index: 2 }, { x: 250, y: 100 }, { x: 270, y: 120 });
    const shared = heldPathWarpOf(scene.get(asNodeId('a'))!.data)!.id;
    expect(heldPathWarpOf(scene.get(asNodeId('b'))!.data)!.id).toBe(shared);

    const a = scene.get(asNodeId('a'))!;
    const moved = { ...(a.pose as RectPose), y: (a.pose as RectPose).y + 300 };
    commitOps(pairDeps(scene), [createTransformOp({ id: a.id, from: a.pose, to: moved, label: 'Move' })], 'Move');

    const { held } = splitByWarp(selectedPathNodes(pairDeps(scene)), 'distort');
    const ids = new Map(held.map((t) => [String(t.node.id), t.held.id]));
    expect(ids.get('a')).not.toBe(ids.get('b'));
    // Each path's controls sit on the corners of the box the pair was warped in, carried with it.
    const corner = (t: (typeof held)[number]) => {
      const c = (t.held.warp as DistortWarp).corners[0];
      const [x, y] = applyToPoint(t.toWorld, c.x, c.y);
      return { x, y };
    };
    const byId = new Map(held.map((t) => [String(t.node.id), t]));
    expect(corner(byId.get('a')!).y).toBeCloseTo(300, 3);
    expect(corner(byId.get('b')!).y).toBeCloseTo(0, 3);

    const aBefore = pathOf(scene, 'a');
    drag(scene, { warpId: ids.get('b')!, index: 0 }, { x: 0, y: 0 }, { x: -10, y: -10 });
    expect(pathOf(scene, 'a')).toEqual(aBefore);
    expect(boundsOfPath(resolveEditablePathOf(scene.get(asNodeId('b')) as never) as PolygonPath).y).toBeLessThan(0);
    // The parting is written down once a parted warp is edited.
    expect(heldPathWarpOf(scene.get(asNodeId('b'))!.data)!.id).toBe(ids.get('b'));
  });
});

describe('Warp Settings form', () => {
  it('is disabled until a selected path holds a warp', () => {
    const scene = makeScene();
    expect(configureWarpAction.enabled?.(depsOf(scene))).not.toBe(true);
    dragControl(scene, 'distort', { warpId: null, index: 2 }, { x: 100, y: 100 }, { x: 120, y: 110 });
    expect(configureWarpAction.enabled?.(depsOf(scene))).toBe(true);
  });

  it('reads the held distort, and a Mode change reaches it as one undo step', () => {
    const scene = makeScene();
    dragControl(scene, 'distort', { warpId: null, index: 2 }, { x: 100, y: 100 }, { x: 120, y: 110 });
    expect(readWarpSettings(depsOf(scene))).toEqual({
      values: { distorts: 1, envelopes: 0, distort: { mode: 'free' }, tolerance: 0.5 },
      mixed: [],
    });
    const params = warpSettingsParams('distort.mode', 'perspective')!;
    expect(params).toEqual({ kind: 'distort', mode: 'perspective' });
    (configureWarpAction.invoker as ImmediateInvoker).run(depsOf(scene), params);
    const held = heldPathWarpOf(scene.get(asNodeId('a'))!.data);
    expect(held?.warp.kind === 'distort' && held.warp.mode).toBe('perspective');
    scene.undo();
    const back = heldPathWarpOf(scene.get(asNodeId('a'))!.data);
    expect(back?.warp.kind === 'distort' && back.warp.mode).toBe('free');
  });

  it('reads an envelope\'s grid and mapping', () => {
    const scene = makeScene();
    dragControl(scene, 'envelope', { warpId: null, index: 1 }, { x: 50, y: 0 }, { x: 50, y: -30 }, { rows: 2, cols: 2 });
    expect(readWarpSettings(depsOf(scene)).values).toMatchObject({
      distorts: 0, envelopes: 1, envelope: { rows: 2, cols: 2, mapping: 'bicubic' },
    });
  });

  it('turns a field nobody owns into no params', () => {
    expect(warpSettingsParams('distorts', 3)).toBeNull();
    expect(warpSettingsParams('tolerance', 1)).toEqual({ tolerance: 1 });
  });
});
