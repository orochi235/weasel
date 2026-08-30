/**
 * Geometry contract test (Spec 1 §4 / Spec 2 — the RED gate).
 *
 * Parametrized FACTORIES × OPS. Each node carries the **geometry-in-data**
 * convention apps/draw uses: a bare-AABB pose `{x,y,width,height,rotation?}`
 * (no `kind`) plus the real geometry in `data.path`. World geometry is the
 * canonical `pathInWorld(geometryOf(node), node.pose)`.
 *
 * The contract: after any transform op, the node's WORLD geometry must be the
 * affine image of the before-geometry under the SAME map applied to the pose,
 * and `boundsOfPath(afterWorld) ≈ aabbOf(after.pose)` — the contents must keep
 * filling the pose box. The anchor bug violates this for polygon-content nodes:
 * resize (and flip) scale/mirror the pose AABB while `data.path` is untouched,
 * so the contents tear loose from the frame.
 *
 * This test is EXPECTED TO FAIL today (red) for polygon-content factories under
 * resize/flip. It turns green when Spec 2's data-aware projection fix lands.
 * Do NOT weaken the assertions to make it pass; do NOT implement the fix here.
 */

import { describe, it, expect } from 'vitest';
import { createPoseOverrides } from 'core/scene/poseOverrides';
import type { PoseOverrides } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { InvocationCtx, OngoingInvoker, ImmediateInvoker } from '../invoker';
import type { Action } from '../registry';
import type { ResizeAnchor } from '../../gestures/types';

import {
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
  transformPath,
} from 'features/paths';
import type { Path } from 'features/paths/types';
import { splitPathByLine } from 'features/paths/splitByLine';

import { resizeAction } from '../defaults/resize';
import { moveAction } from '../defaults/move';
import { rotateAction } from '../defaults/rotate';
import { nudgeRightAction } from '../defaults/nudge';
import { flipAction } from '../defaults/flip';

// ---------------------------------------------------------------------------
// Test node model — geometry-in-data (the apps/draw convention)
// ---------------------------------------------------------------------------

interface AABBPose {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}
interface DrawData {
  path: Path;
}
interface TestNode {
  id: string;
  pose: AABBPose;
  data: DrawData;
}

/** The geometry accessor — mirrors apps/draw's SceneCanvas geometry source
 *  (`App.tsx`: `data.path ? pathInWorld(data.path, node.pose) : undefined`).
 *  Returns the STORED path; `pathInWorld(geometryOf(n), n.pose)` is the world
 *  geometry the contract asserts on. */
function geometryOf(node: TestNode): Path {
  return node.data.path;
}

/** AABB of a pose, as a plain rect. */
function aabbOf(pose: AABBPose): { x: number; y: number; width: number; height: number } {
  return { x: pose.x, y: pose.y, width: pose.width, height: pose.height };
}

/** Build a geometry-in-data node from a stored path. The pose's AABB is the
 *  path's own bounds at construction (path stored in world coords initially,
 *  pose AABB coincident — exactly how apps/draw mints booleans/slice/shape
 *  nodes). */
function nodeFromPath(id: string, path: Path): TestNode {
  const b = boundsOfPath(path);
  return {
    id,
    pose: { x: b.x, y: b.y, width: b.width, height: b.height, rotation: 0 },
    data: { path },
  };
}

// ---------------------------------------------------------------------------
// Stub scene + op application (mirrors resize.test.ts / nudge.test.ts harness)
// ---------------------------------------------------------------------------

interface StubScene {
  poses: Map<string, AABBPose>;
  overrides: PoseOverrides<unknown>;
  datas: Map<string, DrawData>;
  get(id: NodeId): { pose: AABBPose; data: DrawData; kind: 'leaf'; layer: string; parent: null } | undefined;
  setPose(id: NodeId, pose: AABBPose): void;
  renderOrder(): NodeId[];
  childrenOf(): NodeId[];
  roots: NodeId[];
  applyBatch(ops: Op[], label: string, adapter: { setPose(id: string, pose: unknown): void }): void;
}

function makeStubScene(node: TestNode): StubScene {
  const poses = new Map<string, AABBPose>([[node.id, node.pose]]);
  const datas = new Map<string, DrawData>([[node.id, node.data]]);
  const scene: StubScene = {
    poses,
    datas,
    overrides: createPoseOverrides<unknown>((id) => (poses.has(id as string) ? { } : undefined)),
    roots: [node.id as NodeId],
    get(id: NodeId) {
      if (!poses.has(id as string)) return undefined;
      return {
        pose: poses.get(id as string)!,
        data: datas.get(id as string)!,
        kind: 'leaf' as const,
        layer: 'default',
        parent: null,
      };
    },
    setPose(id: NodeId, pose: AABBPose) {
      poses.set(id as string, pose);
    },
    renderOrder: () => [node.id as NodeId],
    childrenOf: () => [],
    applyBatch(ops, _label, adapter) {
      for (const op of ops) op.apply(adapter);
    },
  };
  return scene;
}

/** Adapter that writes each committed op's pose / data back to the stub scene.
 *  The `setData` method lets a committed `setData` op (emitted by the opt-in
 *  geometryProjection seam) update the data the test reads from. */
function applyOpsTo(scene: StubScene): (ops: Op[], label: string) => void {
  const adapter = {
    setPose(id: string, pose: unknown) {
      scene.setPose(id as NodeId, pose as AABBPose);
    },
    setData(id: string, data: unknown) {
      scene.datas.set(id as string, data as DrawData);
    },
  };
  return (ops) => {
    for (const op of ops) op.apply(adapter);
  };
}

// ---------------------------------------------------------------------------
// Op drivers — drive the REAL action descriptors over the stub scene
// ---------------------------------------------------------------------------

const baseModifiers = { alt: false, ctrl: false, meta: false, shift: false };

function ongoing(action: Action): OngoingInvoker {
  const inv = action.invoker;
  if (!inv || inv.timing !== 'ongoing') throw new Error(`expected ongoing invoker for ${action.id}`);
  return inv;
}
function immediate(action: Action): ImmediateInvoker {
  const inv = action.invoker;
  if (!inv || inv.timing !== 'immediate') throw new Error(`expected immediate invoker for ${action.id}`);
  return inv;
}

function baseDeps(scene: StubScene, id: string) {
  return {
    selection: { get: () => [id as NodeId] },
    scene,
    applyOps: applyOpsTo(scene),
    // Mirror apps/draw's real consumer: a flip / resize / move / nudge of a
    // geometry-in-data node ALSO rewrites its `data.path` via the affine the
    // pose underwent. This is the only way an asymmetric shape's contents
    // mirror under flip-x (a bare-AABB pose flip is identity).
    geometryProjection: {
      transform: (node: { data: unknown }, m: import('@weasel-js/geom').Mat3) => {
        const data = node.data as { path: Path } | undefined;
        if (!data || !data.path) return null;
        return { ...data, path: transformPath(data.path, m) };
      },
    },
  };
}

/** Drive an ongoing resize. `anchor` fixes a corner; (dx,dy) is the world
 *  drag of the dragged corner. */
function driveResize(scene: StubScene, id: string, anchor: ResizeAnchor, start: { x: number; y: number }, dx: number, dy: number): void {
  const ctx: InvocationCtx = {
    world: start,
    screen: start,
    modifiers: baseModifiers,
    deps: baseDeps(scene, id),
    drag: {
      start,
      current: start,
      delta: { x: 0, y: 0 },
      affordance: { kind: 'handle', anchor, targetIds: [id] },
    },
  } as unknown as InvocationCtx;
  const handle = ongoing(resizeAction).start(ctx, undefined);
  handle.onMove!({
    ...ctx,
    drag: { start, current: { x: start.x + dx, y: start.y + dy }, delta: { x: dx, y: dy } },
  } as unknown as InvocationCtx);
  handle.onEnd!(ctx, 'commit');
}

/** Drive an ongoing move by (dx, dy). */
function driveMove(scene: StubScene, id: string, dx: number, dy: number): void {
  const ctx: InvocationCtx = {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: baseModifiers,
    deps: baseDeps(scene, id),
    drag: { start: { x: 0, y: 0 }, current: { x: dx, y: dy }, delta: { x: dx, y: dy } },
  } as unknown as InvocationCtx;
  const handle = ongoing(moveAction).start(ctx, undefined);
  handle.onMove!({
    ...ctx,
    drag: { start: { x: 0, y: 0 }, current: { x: dx, y: dy }, delta: { x: dx, y: dy } },
  } as unknown as InvocationCtx);
  handle.onEnd!(ctx, 'commit');
}

/** Drive an immediate nudge-right by one small step (dx=+1). */
function driveNudge(scene: StubScene, id: string): void {
  immediate(nudgeRightAction).run(baseDeps(scene, id), { magnitude: 'small' });
}

/** Drive an ongoing rotate by `radians` about the node's AABB center. */
function driveRotate(scene: StubScene, id: string, radians: number): void {
  const node = scene.get(id as NodeId)!;
  const cx = node.pose.x + node.pose.width / 2;
  const cy = node.pose.y + node.pose.height / 2;
  // Pointer starts on +x of center; ends at `radians`, radius arbitrary.
  const r = Math.max(node.pose.width, node.pose.height, 1);
  const start = { x: cx + r, y: cy };
  const end = { x: cx + r * Math.cos(radians), y: cy + r * Math.sin(radians) };
  const ctx: InvocationCtx = {
    world: start,
    screen: start,
    modifiers: baseModifiers,
    deps: baseDeps(scene, id),
    drag: { start, current: start, delta: { x: 0, y: 0 } },
  } as unknown as InvocationCtx;
  const handle = ongoing(rotateAction).start(ctx, undefined);
  handle.onMove!({ ...ctx, world: end } as unknown as InvocationCtx);
  handle.onEnd!(ctx, 'commit');
}

/** Drive an immediate flip-x. */
function driveFlipX(scene: StubScene, id: string): void {
  immediate(flipAction).run(baseDeps(scene, id), { axis: 'x' });
}

// ---------------------------------------------------------------------------
// World-geometry assertions
// ---------------------------------------------------------------------------

/** Flat [x,y,...] of a path's coords in world space. Rect promoted to corners. */
function worldCoords(path: Path): number[] {
  if (path.kind === 'rect') {
    return [path.x, path.y, path.x + path.width, path.y, path.x + path.width, path.y + path.height, path.x, path.y + path.height];
  }
  return Array.from(path.coords);
}

/** Apply an affine map to a flat coord stream. */
function mapCoords(coords: number[], m: (x: number, y: number) => [number, number]): number[] {
  const out: number[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    const [x, y] = m(coords[i], coords[i + 1]);
    out.push(x, y);
  }
  return out;
}

/** Sort a flat coord stream into a canonical point order so two descriptions
 *  of the SAME point set compare equal regardless of vertex/winding order
 *  (a mirror or rotation re-labels vertices but preserves the set). */
function sortedPoints(coords: number[]): number[] {
  const pts: [number, number][] = [];
  for (let i = 0; i < coords.length; i += 2) pts.push([coords[i], coords[i + 1]]);
  pts.sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  return pts.flat();
}

/** Compare two coord streams as point SETS (order-independent). Catches
 *  "contents are the unchanged/un-mapped shape" — the anchor bug — without
 *  false reds from vertex re-labeling under mirror/rotation. */
function expectSamePointSet(actual: number[], expected: number[]): void {
  const a = sortedPoints(actual);
  const e = sortedPoints(expected);
  expect(a.length).toBe(e.length);
  for (let i = 0; i < a.length; i++) {
    expect(a[i]).toBeCloseTo(e[i], 1); // ~0.05 abs
  }
}

function expectRectClose(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): void {
  expect(a.x).toBeCloseTo(b.x, 1);
  expect(a.y).toBeCloseTo(b.y, 1);
  expect(a.width).toBeCloseTo(b.width, 1);
  expect(a.height).toBeCloseTo(b.height, 1);
}

// ---------------------------------------------------------------------------
// Factories — every node is geometry-in-data (bare AABB pose + data.path)
// ---------------------------------------------------------------------------

function penPath(): Path {
  return new PathBuilder()
    .moveTo(0, 0)
    .curveTo(10, 40, 60, 40, 80, 0)
    .lineTo(80, 60)
    .curveTo(60, 90, 20, 90, 0, 60)
    .close()
    .build();
}

const FACTORIES: { name: string; polygonContent: boolean; make: () => TestNode }[] = [
  { name: 'rect', polygonContent: false, make: () => nodeFromPath('rect', rectPath(20, 30, 80, 60)) },
  { name: 'ellipse', polygonContent: true, make: () => nodeFromPath('ellipse', ellipsePath({ x: 20, y: 30, width: 80, height: 60 })) },
  { name: 'star', polygonContent: true, make: () => nodeFromPath('star', starPath({ x: 60, y: 60 }, 40, 5)) },
  { name: 'polygon', polygonContent: true, make: () => nodeFromPath('polygon', regularPolygonPath({ x: 60, y: 60 }, 40, 6)) },
  { name: 'pen', polygonContent: true, make: () => nodeFromPath('pen', penPath()) },
  {
    name: 'boolean-union',
    polygonContent: true,
    make: () => nodeFromPath('union', pathUnion(rectPath(0, 0, 60, 60), rectPath(40, 40, 60, 60))),
  },
  {
    name: 'boolean-intersect',
    polygonContent: true,
    make: () => nodeFromPath('intersect', pathIntersect(rectPath(0, 0, 60, 60), rectPath(30, 30, 60, 60))),
  },
  {
    name: 'boolean-subtract',
    polygonContent: true,
    make: () => nodeFromPath('subtract', pathSubtract(rectPath(0, 0, 80, 80), rectPath(40, 40, 80, 80))),
  },
  {
    name: 'slice-piece',
    polygonContent: true,
    make: () => {
      const pieces = splitPathByLine(regularPolygonPath({ x: 60, y: 60 }, 40, 6), { x: 60, y: 0 }, { x: 60, y: 120 });
      if (!pieces || pieces.length === 0) throw new Error('slice produced no pieces');
      return nodeFromPath('slice', pieces[0]);
    },
  },
];

// ---------------------------------------------------------------------------
// Ops — each describes the affine map applied to the pose, and drives the
// real action. `expectedMap(before, after)` returns the world-space affine the
// CONTENTS must follow (same map as the pose's frame change).
// ---------------------------------------------------------------------------

interface OpCase {
  name: string;
  drive: (scene: StubScene, id: string, before: TestNode) => void;
  /** The affine map the contents must follow, derived from before/after pose. */
  expectedMap: (before: TestNode, after: TestNode) => (x: number, y: number) => [number, number];
  /** Whether the contents' world AABB must equal the pose AABB after the op.
   *  True for resize/move/nudge/flip; FALSE for rotate (a rotated shape's
   *  axis-aligned world bounds legitimately exceed the unrotated pose AABB —
   *  the rotation is stored on the pose, not baked into the AABB). */
  fillsPoseBox: boolean;
}

/** box→box affine from src AABB to dst AABB. */
function boxToBoxMap(
  src: { x: number; y: number; width: number; height: number },
  dst: { x: number; y: number; width: number; height: number },
): (x: number, y: number) => [number, number] {
  const sx = src.width === 0 ? 1 : dst.width / src.width;
  const sy = src.height === 0 ? 1 : dst.height / src.height;
  return (x, y) => [dst.x + (x - src.x) * sx, dst.y + (y - src.y) * sy];
}

const OPS: OpCase[] = [
  {
    name: 'resize-2x',
    drive: (scene, id, before) => {
      // Fix top-left (min/min), drag bottom-right corner by (+w, +h) → 2×.
      const p = before.pose;
      driveResize(scene, id, { x: 'min', y: 'min' }, { x: p.x + p.width, y: p.y + p.height }, p.width, p.height);
    },
    expectedMap: (before, after) => boxToBoxMap(aabbOf(before.pose), aabbOf(after.pose)),
    fillsPoseBox: true,
  },
  {
    name: 'resize-nonuniform',
    drive: (scene, id, before) => {
      // Fix top-left, drag bottom-right by (+2w, +0) → width ×3, height ×1.
      const p = before.pose;
      driveResize(scene, id, { x: 'min', y: 'min' }, { x: p.x + p.width, y: p.y + p.height }, p.width * 2, 0);
    },
    expectedMap: (before, after) => boxToBoxMap(aabbOf(before.pose), aabbOf(after.pose)),
    fillsPoseBox: true,
  },
  {
    name: 'resize-flip-y',
    drive: (scene, id, before) => {
      // Fix top-left, drag the bottom-right corner UP past the top edge:
      // the box flips vertically with a signed height of -40 (the WeaselDraw
      // flip-corruption repro: an unselectable negative-extent node).
      const p = before.pose;
      driveResize(scene, id, { x: 'min', y: 'min' }, { x: p.x + p.width, y: p.y + p.height }, 0, -(p.height + 40));
    },
    // The contents follow the SIGNED box→box map (mirror). The committed pose
    // must come out normalized — asserted via fillsPoseBox against the world
    // bounds, plus the explicit non-negative-extent check in the test body.
    expectedMap: (before) => boxToBoxMap(aabbOf(before.pose), { x: before.pose.x, y: before.pose.y, width: before.pose.width, height: -40 }),
    fillsPoseBox: true,
  },
  {
    name: 'move',
    drive: (scene, id) => driveMove(scene, id, 37, -19),
    expectedMap: () => (x, y) => [x + 37, y - 19],
    fillsPoseBox: true,
  },
  {
    name: 'nudge',
    drive: (scene, id) => driveNudge(scene, id),
    expectedMap: () => (x, y) => [x + 1, y],
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
      return (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
      };
    },
    fillsPoseBox: false,
  },
  {
    name: 'flip-x',
    drive: (scene, id) => driveFlipX(scene, id),
    expectedMap: (before) => {
      const b = boundsOfPath(geometryOf(before));
      const cx = b.x + b.width / 2;
      return (x, y) => [2 * cx - x, y];
    },
    fillsPoseBox: true,
  },
];

// ---------------------------------------------------------------------------
// The parametrized contract
// ---------------------------------------------------------------------------

describe('geometry contract (kit-level) — transforms move contents, not just the frame', () => {
  for (const f of FACTORIES) {
    for (const op of OPS) {
      it(`${f.name} :: ${op.name}`, () => {
        const before = f.make();
        const scene = makeStubScene(before);
        const beforeWorld = pathInWorld(geometryOf(before), before.pose);

        op.drive(scene, before.id, before);

        const afterNode: TestNode = {
          id: before.id,
          pose: scene.poses.get(before.id)!,
          // data.path is never mutated by pose-only actions — this is the
          // crux: contents stay put while the pose box changes.
          data: scene.datas.get(before.id)!,
        };
        const afterWorld = pathInWorld(geometryOf(afterNode), afterNode.pose);

        // (1) afterWorld must be the affine image of beforeWorld under the
        //     same map the pose underwent (compared as a point set, so a
        //     mirror/rotation re-labeling vertices doesn't cause a false red).
        const map = op.expectedMap(before, afterNode);
        const expected = mapCoords(worldCoords(beforeWorld), map);
        expectSamePointSet(worldCoords(afterWorld), expected);

        // (2) contents must keep filling the pose box (no tear-loose).
        //     Skipped for rotate: a rotated shape's axis-aligned world bounds
        //     legitimately exceed the unrotated pose AABB.
        if (op.fillsPoseBox) {
          expectRectClose(boundsOfPath(afterWorld), aabbOf(afterNode.pose));
          // (3) with a geometryProjection wired, the data absorbs any mirror,
          //     so the committed pose must be a normalized AABB — negative
          //     extents break hit-testing (unselectable nodes).
          expect(afterNode.pose.width).toBeGreaterThanOrEqual(0);
          expect(afterNode.pose.height).toBeGreaterThanOrEqual(0);
        }
      });
    }
  }
});
