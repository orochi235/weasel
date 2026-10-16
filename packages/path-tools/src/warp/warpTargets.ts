/**
 * What every warp action shares: finding the selected paths' warps of one
 * kind, making fresh ones where a path holds none, and writing a changed warp
 * back as the geometry it makes plus the warp itself.
 */
import type { ActionDeps } from '@weasel-js/routing';
import {
  boundsOfPath,
  distortOver,
  envelopeOver,
  identity,
  resizeEnvelope,
  transformPath,
  type Affine,
  type DistortMode,
  type EnvelopeMapping,
  type PathWarp,
  type PolygonPath,
  type WarpBox,
} from '@weasel-js/geom';
import {
  heldWarpResult, rememberWarpResult, resolvePathWarp, warpFrameFor, type HeldPathWarp,
} from './pathWarp';
import { type PathNode, resolveEditablePathOf, type SceneNode, selectedPathNodes, withPath } from '@weasel-js/core';

type AnyNode = SceneNode<unknown, string, unknown>;

/** Which warp a tool or action works with. */
export type WarpKind = PathWarp['kind'];

/** Each kind's name, as its tool and its actions are labeled. */
export const WARP_LABELS: Record<WarpKind, string> = { distort: 'Distort', envelope: 'Envelope', puppet: 'Puppet Warp' };

/** The settings a warp is made or remade with. Each applies only to the kinds
 *  it names; absent ones leave a held warp as it is. */
export interface WarpSettings {
  /** A distort's map. Default `'free'`. */
  mode?: DistortMode;
  /** An envelope's interpolation. Default `'bicubic'`. */
  mapping?: EnvelopeMapping;
  /** An envelope's patch rows and columns. Default 3 each. */
  rows?: number;
  cols?: number;
  /** How far, in world units, the refitted result may stray from the exact
   *  warp. Default {@link DEFAULT_WARP_TOLERANCE}. */
  tolerance?: number;
}

/** The refit tolerance of a warp made without one. */
export const DEFAULT_WARP_TOLERANCE = 0.5;
/** The patch rows and columns of an envelope made without them. */
export const DEFAULT_ENVELOPE_SIZE = 3;

const count = (v: number | undefined, fallback: number) =>
  Math.min(16, Math.max(1, Math.round(v ?? fallback)));

/** A selected path, the warp it is being warped by, and that warp's frame in
 *  world space. `fresh` when the warp was made just now rather than held. */
export interface WarpTarget {
  node: PathNode;
  held: HeldPathWarp;
  toWorld: Affine;
  fresh: boolean;
}

/** A fresh warp of `kind` over `box` that leaves it where it is. */
export function freshWarp(kind: WarpKind, box: WarpBox, settings: WarpSettings): PathWarp {
  switch (kind) {
    case 'distort': return distortOver(box, settings.mode ?? 'free');
    case 'envelope':
      return envelopeOver(
        box,
        count(settings.rows, DEFAULT_ENVELOPE_SIZE),
        count(settings.cols, DEFAULT_ENVELOPE_SIZE),
        settings.mapping ?? 'bicubic',
      );
    case 'puppet': return { kind: 'puppet', pins: [] };
  }
}

/** `held` remade under `settings`: a new mode, mapping or tolerance, and an
 *  envelope resampled to a new grid. */
export function withWarpSettings(held: HeldPathWarp, settings: WarpSettings): HeldPathWarp {
  const { warp } = held;
  let next: PathWarp = warp;
  if (warp.kind === 'distort' && settings.mode && settings.mode !== warp.mode) next = { ...warp, mode: settings.mode };
  if (warp.kind === 'envelope') {
    const sized = resizeEnvelope(
      warp,
      count(settings.rows, warp.mesh.rows),
      count(settings.cols, warp.mesh.cols),
    );
    next = settings.mapping && settings.mapping !== sized.mapping ? { ...sized, mapping: settings.mapping } : sized;
  }
  const tolerance = settings.tolerance !== undefined && settings.tolerance > 0 ? settings.tolerance : held.tolerance;
  if (next === warp && tolerance === held.tolerance) return held;
  return { ...held, warp: next, tolerance };
}

/** The box, in world space, around every path in `nodes`. */
export function worldBoxOf(nodes: readonly PathNode[]): WarpBox | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { path } of nodes) {
    const b = boundsOfPath(path);
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  }
  return x0 <= x1 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

let freshIds = 0;
/** An id no other warp made in this session holds. */
function freshWarpId(): string {
  return `warp-${Date.now().toString(36)}-${(++freshIds).toString(36)}`;
}

/**
 * `nodes` split into those holding a warp of `kind` that still matches their
 * geometry, and the rest, with the box around the rest — where a fresh warp
 * for them goes.
 */
export function splitByWarp(
  nodes: readonly PathNode[],
  kind: WarpKind,
): { held: WarpTarget[]; bare: PathNode[]; box: WarpBox | null } {
  const held: WarpTarget[] = [];
  const bare: PathNode[] = [];
  for (const node of nodes) {
    const resolved = resolvePathWarp(node.node);
    if (resolved && resolved.held.warp.kind === kind) held.push({ node, ...resolved, fresh: false });
    else bare.push(node);
  }
  return { held, bare, box: worldBoxOf(bare) };
}

/**
 * The selected paths' warps of `kind`. A path holding one that still matches
 * its geometry keeps it; the rest get one fresh warp shared between them,
 * laid over the box around them all, so dragging one of its controls warps
 * them together.
 */
export function warpTargets(deps: ActionDeps | undefined, kind: WarpKind, settings: WarpSettings): WarpTarget[] {
  const { held: out, bare, box } = splitByWarp(selectedPathNodes(deps), kind);
  if (!box) return out;
  const id = freshWarpId();
  const warp = freshWarp(kind, box, settings);
  const tolerance = settings.tolerance !== undefined && settings.tolerance > 0 ? settings.tolerance : DEFAULT_WARP_TOLERANCE;
  for (const node of bare) {
    const frame = warpFrameFor(node.node, identity());
    if (!frame) continue;
    // A fresh warp's frame is world space, so its source is the path as drawn.
    out.push({ node, held: { id, source: node.path, warp, tolerance, frame }, toWorld: identity(), fresh: true });
  }
  return out;
}

/**
 * `shape` (a node's pose and data) warped by `warp`, whose controls are in
 * world space, and holding it — for a scene that opens on a warp already
 * made. Null when `shape` holds no editable polygon.
 */
export function withPathWarp<S extends { pose: unknown; data: unknown }>(
  shape: S,
  warp: PathWarp,
  opts: { id?: string; tolerance?: number } = {},
): { pose: unknown; data: unknown } | null {
  const source = resolveEditablePathOf(shape);
  if (!source) return null;
  const held: HeldPathWarp = {
    id: opts.id ?? freshWarpId(),
    source,
    warp,
    tolerance: opts.tolerance ?? DEFAULT_WARP_TOLERANCE,
    frame: identity(),
  };
  return storeWarp(shape as unknown as AnyNode, held, identity());
}

/** `node` holding `held`, its geometry what `held` makes under `toWorld`. */
export function storeWarp(node: AnyNode, held: HeldPathWarp, toWorld: Affine): { pose: unknown; data: unknown } | null {
  const made = heldWarpResult(held);
  const next = withPath(node, transformPath(made, toWorld) as PolygonPath);
  if (!next) return null;
  const frame = warpFrameFor(next, toWorld);
  if (!frame) return null;
  const kept: HeldPathWarp = { ...held, frame };
  rememberWarpResult(kept, made);
  return { pose: next.pose, data: { ...(next.data as object), warp: kept } };
}
