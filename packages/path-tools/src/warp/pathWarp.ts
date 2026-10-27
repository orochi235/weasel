/**
 * A warp a node is holding: the path it warped, the warp, and the tolerance
 * the result was refitted to, kept on the node as `data.warp` beside the
 * `data.path` (or polygon pose) they produced. The geometry stays what every
 * reader uses; the warp only says how to make it again, so it can be edited
 * until it is expanded away.
 *
 * The warp lives in its own frame, fixed when it was made. `frame` carries
 * that frame onto the stored path, so moving, resizing or rotating the node
 * keeps the warp without touching it. A writer that changes the geometry some
 * other way leaves a warp that no longer reproduces it, and such a warp is
 * ignored, the way a stale shape generator is.
 */
import {
  boundsOfPath,
  boxToBox,
  fitAffine,
  identity,
  invert,
  multiply,
  originOf,
  poseFrameOf,
  worldCoords,
  type Affine,
  type PolygonPath,
} from '@weasel-js/geom';
import { applyPathWarp, type PathWarp } from '@weasel-js/geom/warp';
import { classifyPathStorage, type EditableShape } from '@weasel-js/core';

/** What `data.warp` holds. */
export interface HeldPathWarp {
  /** Shared by every node warped together, so one handle drives them all. */
  id: string;
  /** The path before warping, in the warp's frame. */
  source: PolygonPath;
  warp: PathWarp;
  /** How far the refitted result may stray from the exact warp. */
  tolerance: number;
  /** From the warp's frame to the frame the node stores its path in. */
  frame: Affine;
}

/** A held warp that still reproduces its node, and where its frame lands in
 *  world space now. */
export interface ResolvedPathWarp {
  held: HeldPathWarp;
  /** From the warp's frame to world space. */
  toWorld: Affine;
}

const results = new WeakMap<HeldPathWarp, PolygonPath>();

/** The warped path `held` makes, in its own frame. Cached per held warp. */
export function heldWarpResult(held: HeldPathWarp): PolygonPath {
  let out = results.get(held);
  if (!out) {
    out = applyPathWarp(held.source, held.warp, held.tolerance);
    results.set(held, out);
  }
  return out;
}

/** Record that `held` makes `result`, so resolving it later skips the warp. */
export function rememberWarpResult(held: HeldPathWarp, result: PolygonPath): void {
  results.set(held, result);
}

function isHeldWarp(v: unknown): v is HeldPathWarp {
  if (v === null || typeof v !== 'object') return false;
  const h = v as Partial<HeldPathWarp>;
  return typeof h.id === 'string' && typeof h.tolerance === 'number'
    && (h.source as { kind?: string } | undefined)?.kind === 'polygon'
    && typeof (h.warp as { kind?: unknown } | undefined)?.kind === 'string'
    && Array.isArray(h.frame) && h.frame.length === 6;
}

/** The warp a node's `data` holds, whether or not it still matches. */
export function heldPathWarpOf(data: unknown): HeldPathWarp | null {
  const w = (data as { warp?: unknown } | null | undefined)?.warp;
  return isHeldWarp(w) ? w : null;
}

/** `data` without its warp: the shape as plain geometry. */
export function withoutPathWarp<T>(data: T): T {
  if (data === null || typeof data !== 'object' || !('warp' in data)) return data;
  const { warp: _dropped, ...rest } = data as Record<string, unknown>;
  void _dropped;
  return rest as T;
}

/** The path a node stores and the map from that storage to world space. */
export function storedPathOf(node: EditableShape): { path: PolygonPath; toWorld: Affine } | null {
  const storage = classifyPathStorage(node);
  if (!storage) return null;
  if (storage.kind === 'pose') return { path: node.pose as PolygonPath, toWorld: identity() };
  const { pose, data } = storage;
  const b = boundsOfPath(data.path);
  const box = boxToBox(b.x, b.y, b.width, b.height, pose.x, pose.y, pose.width, pose.height);
  return { path: data.path, toWorld: multiply(poseFrameOf(pose) ?? identity(), box) };
}

/** Whether every coordinate of `a`, carried by `m`, lands on `b`'s. */
function sameUnder(a: PolygonPath, m: Affine, b: PolygonPath): boolean {
  if (a.coords.length !== b.coords.length || a.commands.length !== b.commands.length) return false;
  const bb = boundsOfPath(b);
  // Stored paths are float32, so the slack scales with their distance from the point they are measured from.
  const o = originOf(b);
  const tol = 1e-3 * Math.max(1, Math.abs(bb.x - o.x) + bb.width, Math.abs(bb.y - o.y) + bb.height);
  const ac = worldCoords(a), bc = worldCoords(b);
  for (let i = 0; i + 1 < ac.length; i += 2) {
    const x = m[0] * ac[i] + m[2] * ac[i + 1] + m[4];
    const y = m[1] * ac[i] + m[3] * ac[i + 1] + m[5];
    if (Math.abs(x - bc[i]) > tol || Math.abs(y - bc[i + 1]) > tol) return false;
  }
  return true;
}

/**
 * The warp `node` holds and its frame in world space, or null when it holds
 * none or the one it holds no longer reproduces its geometry. A node whose
 * stored path was rewritten by an affine map since — a polygon pose moved,
 * resized or rotated, which rewrites its coordinates — still resolves: the
 * map is recovered from the two sets of points and replaces `frame`.
 */
export function resolvePathWarp(node: EditableShape | null | undefined): ResolvedPathWarp | null {
  if (!node) return null;
  const held = heldPathWarpOf(node.data);
  if (!held) return null;
  const stored = storedPathOf(node);
  if (!stored) return null;
  const made = heldWarpResult(held);
  let toStorage: Affine | null = held.frame;
  if (!sameUnder(made, toStorage, stored.path)) {
    toStorage = made.coords.length === stored.path.coords.length ? fitAffine(worldCoords(made), worldCoords(stored.path)) : null;
    if (!toStorage || !sameUnder(made, toStorage, stored.path)) return null;
  }
  return { held, toWorld: multiply(stored.toWorld, toStorage) };
}

/**
 * The frame to store with a warp whose world map is `toWorld`, once `node`
 * holds its result. Null when the node's storage cannot be inverted.
 */
export function warpFrameFor(node: EditableShape, toWorld: Affine): Affine | null {
  const stored = storedPathOf(node);
  const back = stored && invert(stored.toWorld);
  return back ? multiply(back, toWorld) : null;
}
