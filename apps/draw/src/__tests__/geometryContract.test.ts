/**
 * Geometry contract test — apps/draw mirror (Spec 1 §4 / Spec 2 — RED gate).
 *
 * Where the kit-level mirror (`src/interactions/actions/__tests__/
 * geometryContract.test.ts`) drives the action descriptors directly, this
 * mirror exercises them THROUGH the public `@weasel-js/core` surface using the
 * EXACT apps/draw conventions:
 *
 *   - `WeaselDrawPose` = a bare AABB `{x,y,width,height,rotation?}` with NO
 *     `kind` field (`App.tsx:110`).
 *   - geometry lives in `WeaselDrawData.path` (`App.tsx:118`).
 *   - the SceneCanvas geometry source is `pathInWorld(data.path, node.pose)`
 *     (`App.tsx:939-940`).
 *   - apps/draw wires NO `resizePolicy`/`projection` on `<SceneCanvas>`
 *     (`App.tsx:1401`), so resize falls back to the kit's `AUTO_POSE_DESCRIPTOR`
 *     — which, because the pose has no `kind`, takes the RECT branch and scales
 *     the pose AABB without touching `data.path`. That is the anchor bug.
 *
 * EXPECTED RED for polygon-content nodes under resize (and flip-x for
 * asymmetric shapes). Turns green when Spec 2's data-aware projection lands.
 * Do NOT weaken assertions; do NOT implement the fix.
 */

import { describe, it, expect } from 'vitest';
import {
  // public action descriptors apps/draw gets via `toolBundle="exhaustive"`
  resizeAction,
  moveAction,
  rotateAction,
  // public geometry surface apps/draw uses
  rectPath,
  ellipsePath,
  starPath,
  regularPolygonPath,
  PathBuilder,
  boundsOfPath,
  pathInWorld,
  pathUnion,
  pathIntersect,
  pathSubtract,
  splitPathByLine,
} from '@weasel-js/core';
import type {
  Path, ResizeAnchor, InvocationCtx, OngoingInvoker, Action, Op, PoseOverrides,
} from '@weasel-js/core';

// ---------------------------------------------------------------------------
// apps/draw node model (verbatim from App.tsx)
// ---------------------------------------------------------------------------

interface WeaselDrawPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}
interface WeaselDrawData {
  path: Path;
}
interface DrawNode {
  id: string;
  pose: WeaselDrawPose;
  data: WeaselDrawData;
}

/** apps/draw's geometry source (App.tsx:939-940). */
function geometryOf(node: DrawNode): Path {
  return node.data.path;
}
function aabbOf(pose: WeaselDrawPose) {
  return { x: pose.x, y: pose.y, width: pose.width, height: pose.height };
}
function nodeFromPath(id: string, path: Path): DrawNode {
  const b = boundsOfPath(path);
  return { id, pose: { x: b.x, y: b.y, width: b.width, height: b.height, rotation: 0 }, data: { path } };
}

// ---------------------------------------------------------------------------
// Stub scene + op commit (apps/draw routes commits through its own history,
// i.e. the `applyOps` consumer hook — mirror that).
// ---------------------------------------------------------------------------

interface StubScene {
  poses: Map<string, WeaselDrawPose>;
  overrides: PoseOverrides<unknown>;
  datas: Map<string, WeaselDrawData>;
  get(id: string): { pose: WeaselDrawPose; data: WeaselDrawData; kind: 'leaf'; layer: string; parent: null } | undefined;
  setPose(id: string, pose: WeaselDrawPose): void;
  renderOrder(): string[];
  childrenOf(): string[];
  roots: string[];
}

/** The ephemeral override table the `Scene` contract requires. The ongoing
 *  actions publish each gesture frame here, so a scene stand-in that omits it
 *  throws mid-drag. Nothing in this file reads it back — it exists so the
 *  stub honors the contract. */
function stubOverrides(): PoseOverrides<unknown> {
  const entries = new Map<string, { pose?: unknown; alpha?: number }>();
  let generation = 0;
  return {
    set: (id, entry) => { entries.set(id as string, entry); generation++; },
    get: (id) => entries.get(id as string),
    has: (id) => entries.has(id as string),
    ids: () => [...entries.keys()] as never,
    clear: (id) => { entries.delete(id as string); generation++; },
    clearAll: () => { entries.clear(); generation++; },
    commit: () => { generation++; },
    subscribe: () => () => {},
    getGeneration: () => generation,
  } as PoseOverrides<unknown>;
}

function makeStubScene(node: DrawNode): StubScene {
  const poses = new Map([[node.id, node.pose]]);
  const datas = new Map([[node.id, node.data]]);
  return {
    poses,
    datas,
    overrides: stubOverrides(),
    roots: [node.id],
    get(id) {
      if (!poses.has(id)) return undefined;
      return { pose: poses.get(id)!, data: datas.get(id)!, kind: 'leaf', layer: 'default', parent: null };
    },
    setPose(id, pose) { poses.set(id, pose); },
    renderOrder: () => [node.id],
    childrenOf: () => [],
  };
}

function applyOpsTo(scene: StubScene): (ops: Op[], label: string) => void {
  const adapter = { setPose(id: string, pose: unknown) { scene.setPose(id, pose as WeaselDrawPose); } };
  return (ops) => { for (const op of ops) op.apply(adapter); };
}

const baseModifiers = { alt: false, ctrl: false, meta: false, shift: false };

function ongoing(action: Action): OngoingInvoker {
  const inv = action.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error(`expected ongoing invoker for ${action.id}`);
  return inv;
}

function baseDeps(scene: StubScene, id: string) {
  // NOTE: no `resizePolicy` dep — matches apps/draw's <SceneCanvas> wiring
  // (App.tsx:1401 supplies no projection). The action falls back to
  // AUTO_POSE_DESCRIPTOR → RECT branch for the kind-less WeaselDrawPose.
  return {
    selection: { get: () => [id] },
    scene,
    applyOps: applyOpsTo(scene),
  };
}

// ---------------------------------------------------------------------------
// Op drivers (resize / move / rotate — all public descriptors)
// ---------------------------------------------------------------------------

function driveResize(scene: StubScene, id: string, anchor: ResizeAnchor, start: { x: number; y: number }, dx: number, dy: number): void {
  const ctx = {
    world: start, screen: start, modifiers: baseModifiers, deps: baseDeps(scene, id),
    drag: { start, current: start, delta: { x: 0, y: 0 }, affordance: { kind: 'handle', anchor, targetIds: [id] } },
  } as unknown as InvocationCtx;
  const handle = ongoing(resizeAction).start(ctx, undefined);
  handle.onMove!({ ...ctx, drag: { start, current: { x: start.x + dx, y: start.y + dy }, delta: { x: dx, y: dy } } } as unknown as InvocationCtx);
  handle.onEnd!(ctx, 'commit');
}

function driveMove(scene: StubScene, id: string, dx: number, dy: number): void {
  const ctx = {
    world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, modifiers: baseModifiers, deps: baseDeps(scene, id),
    drag: { start: { x: 0, y: 0 }, current: { x: dx, y: dy }, delta: { x: dx, y: dy } },
  } as unknown as InvocationCtx;
  const handle = ongoing(moveAction).start(ctx, undefined);
  handle.onMove!({ ...ctx, drag: { start: { x: 0, y: 0 }, current: { x: dx, y: dy }, delta: { x: dx, y: dy } } } as unknown as InvocationCtx);
  handle.onEnd!(ctx, 'commit');
}

function driveRotate(scene: StubScene, id: string, radians: number): void {
  const node = scene.get(id)!;
  const cx = node.pose.x + node.pose.width / 2;
  const cy = node.pose.y + node.pose.height / 2;
  const r = Math.max(node.pose.width, node.pose.height, 1);
  const start = { x: cx + r, y: cy };
  const end = { x: cx + r * Math.cos(radians), y: cy + r * Math.sin(radians) };
  const ctx = {
    world: start, screen: start, modifiers: baseModifiers, deps: baseDeps(scene, id),
    drag: { start, current: start, delta: { x: 0, y: 0 } },
  } as unknown as InvocationCtx;
  const handle = ongoing(rotateAction).start(ctx, undefined);
  handle.onMove!({ ...ctx, world: end } as unknown as InvocationCtx);
  handle.onEnd!(ctx, 'commit');
}

// ---------------------------------------------------------------------------
// World-geometry assertions (same as kit mirror)
// ---------------------------------------------------------------------------

function worldCoords(path: Path): number[] {
  if (path.kind === 'rect') {
    return [path.x, path.y, path.x + path.width, path.y, path.x + path.width, path.y + path.height, path.x, path.y + path.height];
  }
  return Array.from(path.coords);
}
function mapCoords(coords: number[], m: (x: number, y: number) => [number, number]): number[] {
  const out: number[] = [];
  for (let i = 0; i < coords.length; i += 2) { const [x, y] = m(coords[i], coords[i + 1]); out.push(x, y); }
  return out;
}
function sortedPoints(coords: number[]): number[] {
  const pts: [number, number][] = [];
  for (let i = 0; i < coords.length; i += 2) pts.push([coords[i], coords[i + 1]]);
  pts.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  return pts.flat();
}
function expectSamePointSet(actual: number[], expected: number[]): void {
  const a = sortedPoints(actual);
  const e = sortedPoints(expected);
  expect(a.length).toBe(e.length);
  for (let i = 0; i < a.length; i++) expect(a[i]).toBeCloseTo(e[i], 1);
}
function expectRectClose(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): void {
  expect(a.x).toBeCloseTo(b.x, 1);
  expect(a.y).toBeCloseTo(b.y, 1);
  expect(a.width).toBeCloseTo(b.width, 1);
  expect(a.height).toBeCloseTo(b.height, 1);
}
function boxToBoxMap(src: { x: number; y: number; width: number; height: number }, dst: { x: number; y: number; width: number; height: number }) {
  const sx = src.width === 0 ? 1 : dst.width / src.width;
  const sy = src.height === 0 ? 1 : dst.height / src.height;
  return (x: number, y: number): [number, number] => [dst.x + (x - src.x) * sx, dst.y + (y - src.y) * sy];
}

// ---------------------------------------------------------------------------
// Factories (apps/draw mint sites: shapes, booleans, slice — all into data.path)
// ---------------------------------------------------------------------------

function penPath(): Path {
  return new PathBuilder().moveTo(0, 0).curveTo(10, 40, 60, 40, 80, 0).lineTo(80, 60).curveTo(60, 90, 20, 90, 0, 60).close().build();
}

const FACTORIES: { name: string; make: () => DrawNode }[] = [
  { name: 'rect', make: () => nodeFromPath('rect', rectPath(20, 30, 80, 60)) },
  { name: 'ellipse', make: () => nodeFromPath('ellipse', ellipsePath({ x: 20, y: 30, width: 80, height: 60 })) },
  { name: 'star', make: () => nodeFromPath('star', starPath({ x: 60, y: 60 }, 40, 5)) },
  { name: 'polygon', make: () => nodeFromPath('polygon', regularPolygonPath({ x: 60, y: 60 }, 40, 6)) },
  { name: 'pen', make: () => nodeFromPath('pen', penPath()) },
  { name: 'boolean-union', make: () => nodeFromPath('union', pathUnion(rectPath(0, 0, 60, 60), rectPath(40, 40, 60, 60))) },
  { name: 'boolean-intersect', make: () => nodeFromPath('intersect', pathIntersect(rectPath(0, 0, 60, 60), rectPath(30, 30, 60, 60))) },
  { name: 'boolean-subtract', make: () => nodeFromPath('subtract', pathSubtract(rectPath(0, 0, 80, 80), rectPath(40, 40, 80, 80))) },
  {
    name: 'slice-piece',
    make: () => {
      const pieces = splitPathByLine(regularPolygonPath({ x: 60, y: 60 }, 40, 6), { x: 60, y: 0 }, { x: 60, y: 120 });
      if (!pieces || pieces.length === 0) throw new Error('slice produced no pieces');
      return nodeFromPath('slice', pieces[0]);
    },
  },
];

interface OpCase {
  name: string;
  drive: (scene: StubScene, id: string, before: DrawNode) => void;
  expectedMap: (before: DrawNode, after: DrawNode) => (x: number, y: number) => [number, number];
  fillsPoseBox: boolean;
}

const OPS: OpCase[] = [
  {
    name: 'resize-2x',
    drive: (scene, id, before) => {
      const p = before.pose;
      driveResize(scene, id, { x: 'min', y: 'min' }, { x: p.x + p.width, y: p.y + p.height }, p.width, p.height);
    },
    expectedMap: (before, after) => boxToBoxMap(aabbOf(before.pose), aabbOf(after.pose)),
    fillsPoseBox: true,
  },
  {
    name: 'resize-nonuniform',
    drive: (scene, id, before) => {
      const p = before.pose;
      driveResize(scene, id, { x: 'min', y: 'min' }, { x: p.x + p.width, y: p.y + p.height }, p.width * 2, 0);
    },
    expectedMap: (before, after) => boxToBoxMap(aabbOf(before.pose), aabbOf(after.pose)),
    fillsPoseBox: true,
  },
  {
    name: 'move',
    drive: (scene, id) => driveMove(scene, id, 37, -19),
    expectedMap: () => (x, y) => [x + 37, y - 19],
    fillsPoseBox: true,
  },
  {
    name: 'rotate-30',
    drive: (scene, id) => driveRotate(scene, id, Math.PI / 6),
    expectedMap: (before) => {
      const c = boundsOfPath(geometryOf(before));
      const cx = c.x + c.width / 2;
      const cy = c.y + c.height / 2;
      const cos = Math.cos(Math.PI / 6);
      const sin = Math.sin(Math.PI / 6);
      return (x, y) => { const dx = x - cx, dy = y - cy; return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]; };
    },
    fillsPoseBox: false,
  },
];

describe('geometry contract (apps/draw wiring) — resize/move/rotate move contents, not just the frame', () => {
  for (const f of FACTORIES) {
    for (const op of OPS) {
      it(`${f.name} :: ${op.name}`, () => {
        const before = f.make();
        const scene = makeStubScene(before);
        const beforeWorld = pathInWorld(geometryOf(before), before.pose);

        op.drive(scene, before.id, before);

        const afterNode: DrawNode = { id: before.id, pose: scene.poses.get(before.id)!, data: scene.datas.get(before.id)! };
        const afterWorld = pathInWorld(geometryOf(afterNode), afterNode.pose);

        const map = op.expectedMap(before, afterNode);
        expectSamePointSet(worldCoords(afterWorld), mapCoords(worldCoords(beforeWorld), map));

        if (op.fillsPoseBox) {
          expectRectClose(boundsOfPath(afterWorld), aabbOf(afterNode.pose));
        }
      });
    }
  }
});
