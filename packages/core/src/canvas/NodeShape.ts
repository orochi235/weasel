/**
 * NodeShape — the **shape trait's** registry: the per-kind `paint` + `silhouette` used by
 * `defaultDrawOne`, clipping, non-rect hit-testing, and lasso/area-select. Teaching the kit
 * about a new kind of shape goes through this registry rather than by overriding `drawOne`.
 *
 * The first entry whose `matches` predicate returns true paints the node: `'high'` entries
 * first, then the built-ins, then `'normal'` ones, in registration order within a tier. Every
 * built-in but `kit:derived` additionally requires a rect-shaped pose — a scene whose poses are
 * some other shape matches none of them, and paints through a consumer painter or not at all.
 */
import { glyphGeneration } from '@weasel-js/font';
import {
  pathContainsPoint,
  strokeHitTest,
  type Path
} from '@weasel-js/geom';
import { pathThroughPoseFrame } from '@weasel-js/geom';
import { bumpNodeMemoGeneration, nodeMemo } from 'core/scene/nodeMemo';
import type { Node } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { hasSlop, slopForStrokeHit, widenSlop, type PickSlop } from 'core/viewport/screenSlop';
import type { View } from 'core/viewport/view';
import type { VertexColorChannel } from '@weasel-js/animator';
import type { DrawCommand } from '@weasel-js/renderer';
import { DERIVED_PAINTER } from './nodeShapes/derivedPainter';
import { IMAGE_PAINTER } from './nodeShapes/imagePainter';
import { MEASURE_PAINTER } from './nodeShapes/measurePainter';
import { derivesPath } from './nodeShapes/memo';
import { PATH_PAINTER } from './nodeShapes/pathPainter';
import { paintsPose } from './nodeShapes/poseBox';
import { RECT_FALLBACK_PAINTER } from './nodeShapes/rectFallbackPainter';
import { SHAPE_PAINTER } from './nodeShapes/shapePainter';
import { TEXT_PAINTER } from './nodeShapes/textPainter';

/** Optional per-call paint context, threaded through `defaultDrawOne`'s third argument. Lets
 *  a rendering entry point override ambient environment reads; custom painters may ignore it
 *  entirely. */
export interface NodePaintCtx {
  /** Override bitmap resolution for image nodes. When set it is authoritative:
   *  the global `imageCache` is not consulted, and an `undefined` result
   *  paints the deterministic grey placeholder outline (never the ambient
   *  load-status error variant). */
  resolveImage?: (node: Node<unknown, string, unknown>) => ImageBitmap | undefined;
  /** Device pixels per world unit where this paint will land — the view's
   *  scale times the device-pixel ratio. `defaultDrawOne` fills it from its
   *  view when absent. Lets a painter size resolution-dependent work, such as
   *  re-rasterizing an SVG image; one that has no such work ignores it. */
  pixelScale?: number;
  /** The node's derived path, resolved before painting by the `drawOne`
   *  wrapper of whichever scene or adapter is drawn: `paint` has no handle on
   *  either, and deriving needs the dependencies' poses. **Absent** for a node that derives from nothing —
   *  the wrapper hands such a node the caller's own ctx untouched. `null`
   *  means the node derives but has nothing to draw. */
  derivedPath?: Path | null;
  /** A node's animated per-anchor colors: given the colors a painter would paint
   *  on `channel`, the colors to paint instead. **Absent** when nothing animates
   *  the node. The kit's path painters apply it; see `withColorOverrides`. */
  vertexColors?: (
    channel: VertexColorChannel,
    base: readonly number[] | undefined,
  ) => readonly number[] | undefined;
}

/**
 * Per-node draw function — the scene-slot `drawOne` signature shared by
 * `<SceneCanvas>`, `renderSceneToCanvas` and `renderSceneToPixels`, so a
 * consumer can reuse one callback across a main canvas and a detached view.
 *
 * Called once per node in the walk. Returned commands are world-space; the
 * caller applies the view transform at the group level. `ctx` is supplied by
 * the scene-aware wrappers — see {@link NodePaintCtx}.
 */
export type SceneViewDrawOne<TData, TLayer extends string, TPose> = (
  node: Node<TData, TLayer, TPose>,
  pose: TPose,
  view: View,
  ctx?: NodePaintCtx,
) => DrawCommand[];

/** A painter for one kind of node: which nodes it claims, and the draw
 *  commands it emits for them. Registering one is how a consumer teaches the
 *  default renderer to draw its own node kinds. */
export interface NodeShapeEntry<TData = unknown, TPose = unknown> {
  /** Stable identifier — used for unregistration and debugging. Pick
   *  something descriptive: `'kit:text'`, `'app:image'`, etc. */
  id: string;
  /** Returns true when this painter renders the node. The first matching
   *  painter (`'high'` tier first, then `'normal'`) wins. The kit's own
   *  painters also require a rect-shaped pose, since their geometry reads
   *  `x`/`y`/`width`/`height` off it. */
  matches(node: Node<TData, string, TPose>): boolean;
  /** Emits the draw commands for the node's primary visual.
   *
   *  **The returned array belongs to the painter.** Callers must treat it as
   *  immutable and copy before appending — a painter is free to memoize its
   *  command list, and an in-place `push` would grow that list on every frame. */
  paint(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodePaintCtx): DrawCommand[];
  /** Optional: the node's silhouette path from its pose. Used by clipping (when the
   *  container has no explicit `clipFromPose`), by non-rect hit-testing, and by
   *  lasso/area-select. Painters whose visual has no meaningful closed silhouette
   *  leave this undefined. */
  silhouette?(
    node: Node<TData, string, TPose>,
    pose: TPose,
    ctx?: NodeSilhouetteCtx,
  ): Path | null;
  /** Optional: how the silhouette is inked — whether the interior is filled,
   *  and how wide the outline is. Read by picking, so that an unfilled shape
   *  is grabbable by its outline rather than by its empty middle.
   *
   *  Picking runs on every pointer move, so keep it to cheap field reads.
   *  Painters that leave it undefined are treated as {@link DEFAULT_INK}: the
   *  whole silhouette interior is grabbable and the outline adds nothing.
   *
   *  `ctx.scale` carries the view scale so a `{ px }` stroke width resolves to
   *  world units; without it a screen-pixel width is read as world units. */
  ink?(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodeInkCtx): NodeInk | null;
  /** Optional: a box enclosing every pixel `paint` can put down for this node,
   *  stroke, markers and miter spikes included, in the frame `paint` emits in
   *  — before the pose's rotation is applied around it.
   *
   *  Culling reads it to skip `paint` for a node outside the view, so a box
   *  that is too small makes the node vanish before it reaches the screen
   *  edge. Leave it undefined, or return `null`, when no cheap conservative
   *  answer exists (`kit:text` has none short of laying out its glyphs); such
   *  a node is always painted. Same cheap-reads rule as `ink`. */
  bounds?(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodeInkCtx): Bounds | null;
}

/** How a painter inks its silhouette. See {@link NodeShapeEntry.ink}.
 *
 *  Reach is per-side because `align` decides which side the ribbon lands on:
 *  a centered stroke straddles the outline, `'inner'` puts nothing outside it,
 *  `'outer'` nothing inside. */
export interface NodeInk {
  /** True when the silhouette's interior is painted, and so grabbable. */
  filled: boolean;
  /** How far the ink reaches outside the outline, world units. */
  outset: number;
  /** How far it reaches inside. */
  inset: number;
  /** Reach past `outset` measured on screen, in pixels — a `{ px }` stroke's,
   *  which the renderer holds exact in every direction, so no one world
   *  distance stands for it under non-uniform zoom. */
  outsetPx?: number;
  /** Reach past `inset`, likewise. */
  insetPx?: number;
}

/** Per-call context for {@link NodeShapeEntry.silhouette}. */
export interface NodeSilhouetteCtx {
  /** The node's derived path, resolved by the caller — a painter has no scene
   *  handle and deriving needs the dependencies' poses. Same convention as
   *  {@link NodePaintCtx.derivedPath}: absent for a node that derives from
   *  nothing, `null` when it derives but has nothing to draw. */
  derivedPath?: Path | null;
}

/** Per-call context for {@link NodeShapeEntry.ink}. */
export interface NodeInkCtx {
  /** View scale, for resolving `{ px }` lengths to world units — the mean of
   *  the two axes' under non-uniform zoom. */
  scale?: number;
  /** The smaller axis's scale, where it differs from `scale`. A box bounding
   *  a `{ px }` stroke reads its reach here, where a pixel is the most world. */
  leastScale?: number;
}

/** What a painter that declares no `ink` is assumed to do. */
export const DEFAULT_INK: Readonly<NodeInk> = Object.freeze({ filled: true, outset: 0, inset: 0 });

/** Options for `registerNodeShape`. */
export interface RegisterNodeShapeOptions {
  /** `'high'` puts the painter ahead of all normally-registered ones (so
   *  it can win over a kit built-in). `'normal'` appends at the end. */
  priority?: 'high' | 'normal';
}

const PAINTERS: { high: NodeShapeEntry[]; normal: NodeShapeEntry[] } = {
  high: [],
  normal: [],
};

// The built-ins go in on first use, not at module load: a bundler may drop an
// import kept only for its side effect, and the registry would come up empty.
let builtInsRegistered = false;
function ensureBuiltIns(): void {
  if (builtInsRegistered) return;
  builtInsRegistered = true;
  registerBuiltInShapePainters();
}

/** Register a shape painter. Returns a disposer that removes it. */
export function registerNodeShape<TData, TPose>(
  painter: NodeShapeEntry<TData, TPose>,
  opts: RegisterNodeShapeOptions = {},
): () => void {
  ensureBuiltIns();
  const list = opts.priority === 'high' ? PAINTERS.high : PAINTERS.normal;
  list.push(painter as NodeShapeEntry);
  // The painter set is exactly the ambient state `findNodeShape` reads, and a
  // memo keyed on the node alone cannot see it change. See `nodeMemo`.
  bumpNodeMemoGeneration();
  return () => {
    const i = list.indexOf(painter as NodeShapeEntry);
    if (i >= 0) list.splice(i, 1);
    bumpNodeMemoGeneration();
  };
}

/**
 * Slot names for what picking asks per node per pointer move: which painter matches, and that
 * painter's silhouette path. Both go through {@link nodeMemo}, so they invalidate on `data`
 * (and, for the silhouette, `pose`) reference changes and on a painter registration.
 *
 * Separate slots rather than one entry: they mostly invalidate together, but not always, and a
 * shared entry would force the stricter key on both.
 */
const PAINTER_SLOT = 'shape:painter';
const PAINTER_SLOT_NONRECT = 'shape:painter:nonrect';
const PAINTER_SLOT_DERIVED = 'shape:painter:derived';
const PAINTER_SLOT_DERIVED_NONRECT = 'shape:painter:derived:nonrect';
const SILHOUETTE_SLOT = 'shape:silhouette';
const TEXT_SILHOUETTE_SLOT = 'shape:silhouette:text';

/** The painter that will render `node` — first match in priority order — or undefined if
 *  none accepts it. */
export function findNodeShape<TData, TPose>(
  node: Node<TData, string, TPose>,
): NodeShapeEntry<TData, TPose> | undefined {
  // Built-in painters also gate on pose shape and on whether the node derives
  // its path, neither of which shows in `data`, so the key carries both.
  const rect = paintsPose(node.pose);
  const slot = derivesPath(node)
    ? (rect ? PAINTER_SLOT_DERIVED : PAINTER_SLOT_DERIVED_NONRECT)
    : (rect ? PAINTER_SLOT : PAINTER_SLOT_NONRECT);
  return nodeMemo(node as { data?: unknown }, slot, undefined, () =>
    matchNodeShape(node),
  );
}

function matchNodeShape<TData, TPose>(
  node: Node<TData, string, TPose>,
): NodeShapeEntry<TData, TPose> | undefined {
  ensureBuiltIns();
  for (const p of PAINTERS.high) {
    if (p.matches(node as Node<unknown, string, unknown>)) {
      return p as NodeShapeEntry<TData, TPose>;
    }
  }
  for (const p of PAINTERS.normal) {
    if (p.matches(node as Node<unknown, string, unknown>)) {
      return p as NodeShapeEntry<TData, TPose>;
    }
  }
  return undefined;
}

/** The silhouette path of `node`, in **world** coords, or null if no painter matches or the
 *  matching painter has none.
 *
 *  Painters return their silhouette in the pose's local (unrotated) frame;
 *  this bakes the pose's frame (`poseFrameOf`: its rotation and `transform`)
 *  on top, so clips/area-select of a turned or skewed node use the boundary
 *  the renderer draws. */
export function findShapeSilhouette<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
  ctx?: NodeSilhouetteCtx,
): Path | null {
  const build = (): Path | null => {
    const sil = findNodeShape(node)?.silhouette?.(node, pose, ctx) ?? null;
    return sil && pathThroughPoseFrame(sil, pose);
  };
  // `SILHOUETTE_SLOT`'s key is (node, pose, data) and cannot see
  // `ctx.derivedPath` — the same reason `kit:derived` skips `PAINT_SLOT`.
  // Memoizing here would serve one caller's silhouette to a caller that
  // passed a different path. Only an actual path skips it: a scene-backed
  // source answers `null` for every ordinary node, and treating that as a
  // reason to bypass would retire the memo for the whole scene.
  if (ctx?.derivedPath != null) return build();
  // Line boxes follow font metrics, and a face landing changes those with no
  // change to the node, so the text entry is checked against the glyph epoch.
  if (findNodeShape(node) === (TEXT_PAINTER as NodeShapeEntry<unknown, unknown>)) {
    const epoch = glyphGeneration();
    const held = nodeMemo(node as { data?: unknown }, TEXT_SILHOUETTE_SLOT, pose,
      (): { epoch: number; path: Path | null } => ({ epoch, path: build() }));
    if (held.epoch !== epoch) {
      held.epoch = epoch;
      held.path = build();
    }
    return held.path;
  }
  return nodeMemo(node as { data?: unknown }, SILHOUETTE_SLOT, pose, build);
}

/** Find the painter for `node` and ask how it inks its silhouette. Returns
 *  the painter's declared {@link NodeInk}, or `null` when no painter matches
 *  or it declares none — callers substitute {@link DEFAULT_INK}. */
export function findShapeInk<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
  ctx?: NodeInkCtx,
): NodeInk | null {
  return findNodeShape(node)?.ink?.(node, pose, ctx) ?? null;
}

/** Find the painter for `node` and ask for the box its paint fits in. `null`
 *  when no painter matches, or the one that does cannot say — see
 *  {@link NodeShapeEntry.bounds}. */
export function findShapeBounds<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
  ctx?: NodeInkCtx,
): Bounds | null {
  return findNodeShape(node)?.bounds?.(node, pose, ctx) ?? null;
}

/** Options for {@link shapeCoversPoint}. */
export interface ShapeCoversPointOptions {
  /** Extra grab distance around the outline: **world** units as a number,
   *  or screen pixels under a view scale (`{ px, scale }`), which is measured
   *  on screen and so stays exact under non-uniform zoom. Defaults to `0`,
   *  where a hairline is too thin a target to hit. */
  tolerance?: PickSlop;
  /** View scale, passed to the painter's `ink`, and what a screen reach is
   *  read at under a world `tolerance`. Defaults to 1. */
  scale?: number;
  /** The node's derived path — see {@link NodeSilhouetteCtx.derivedPath}.
   *  Without it a derived node reports no silhouette and this answers `true`
   *  everywhere, which degrades picking to the caller's AABB: for an edge,
   *  a zero-sized pose. */
  derivedPath?: Path | null;
}

/**
 * Does the shape `node` actually paints cover the world point? Asks the painter's silhouette,
 * the same boundary used for clipping and area-select, rather than the pose rect.
 *
 * The ink counts too: a shape whose interior isn't filled is grabbable along its outline and
 * not through its empty middle. The outline's grab width is the stroke's half-width plus
 * `tolerance`.
 *
 * A painter with no `silhouette`, or one that returns `null` for this node, reports `true` —
 * "no opinion" — so callers should keep their own AABB test as a pre-filter.
 */
export function shapeCoversPoint<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
  x: number,
  y: number,
  opts: ShapeCoversPointOptions = {},
): boolean {
  const sil = findShapeSilhouette(node, pose, { derivedPath: opts.derivedPath });
  if (sil === null) return true;
  const ink = findShapeInk(node, pose, { scale: opts.scale }) ?? DEFAULT_INK;
  const inside = pathContainsPoint(sil, x, y);
  if (ink.filled && inside) return true;
  // The stroke reaches a different distance on each side, so which side the point is on
  // picks the reach. `tolerance` also makes a filled shape grabbable a few pixels outside
  // its edge.
  const slop = widenSlop(opts.tolerance, (inside ? ink.insetPx : ink.outsetPx) ?? 0, opts.scale);
  const { extra, opts: hit } = slopForStrokeHit(slop);
  const reach = (inside ? ink.inset : ink.outset) + extra;
  return (reach > 0 || hasSlop(slop)) && strokeHitTest(sil, x, y, reach, hit);
}

/** The current painters in evaluation order — `'high'` tier first, then `'normal'`. */
export function getNodeShapes(): readonly NodeShapeEntry[] {
  ensureBuiltIns();
  return [...PAINTERS.high, ...PAINTERS.normal];
}

/** Test-only: clear the registry and re-register the built-ins. */
export function _resetShapePaintersForTests(): void {
  PAINTERS.high.length = 0;
  PAINTERS.normal.length = 0;
  builtInsRegistered = false;
  ensureBuiltIns();
  // `registerNodeShape` already bumps, but the clearing above happens without one.
  bumpNodeMemoGeneration();
}

function registerBuiltInShapePainters(): void {
  registerNodeShape(TEXT_PAINTER);
  registerNodeShape(MEASURE_PAINTER);
  // Ahead of path/shape/image: a derived node whose `data` also carries a
  // `path`, `shape` or `image` means the derived path, and those three match
  // on the presence of the field alone.
  registerNodeShape(DERIVED_PAINTER);
  registerNodeShape(PATH_PAINTER);
  registerNodeShape(SHAPE_PAINTER);
  registerNodeShape(IMAGE_PAINTER);
  registerNodeShape(RECT_FALLBACK_PAINTER);
}
