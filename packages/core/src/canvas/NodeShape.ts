/**
 * NodeShape — the **shape trait's** registry. Each trait of a node
 * (shape, routing, label, icon, affordances, …) is its own registry;
 * this one holds the per-kind `paint` + `silhouette` (and future
 * fields) used by `defaultDrawOne`, clipping, non-rect hit-testing,
 * and lasso/area-select.
 *
 * Teaching the kit about a new kind of shape goes through this registry
 * rather than by overriding `drawOne`. Overrides are still possible but
 * shouldn't be the default seam: most consumers want the same dispatch
 * logic, just extended with their own shape kinds (images, custom paths,
 * SVG fragments, etc.).
 *
 * Built-in entries (`kit:text`, `kit:path`, `kit:rect-fallback`) are
 * registered at module load. Consumer entries added via
 * `registerNodeShape` join the chain; the first entry whose
 * `matches` predicate returns true paints the node. Every built-in but
 * `kit:derived` additionally requires a rect-shaped pose — a scene whose
 * poses are some other shape matches none of them, and paints through a
 * consumer painter or not at all.
 *
 * Two priority tiers:
 *   - `'high'` — checked before all `'normal'` entries. Use this to
 *     override a kit built-in for a specific data shape (e.g. a custom
 *     text renderer that wins over `kit:text`).
 *   - `'normal'` (default) — appended after the built-ins.
 *
 * Within a tier, entries run in registration order. Each
 * `registerNodeShape` call returns a disposer that removes the
 * entry — useful for tests, for plugin lifecycles, and for swapping
 * implementations at runtime.
 *
 * See `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md`
 * for the trait taxonomy.
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
import type { VertexColorChannel } from '../animation/colorRegistry';
import type { DrawCommand } from '@weasel-js/renderer';
import { DERIVED_PAINTER } from './nodeShapes/derivedPainter';
import { IMAGE_PAINTER } from './nodeShapes/imagePainter';
import { derivesPath } from './nodeShapes/memo';
import { PATH_PAINTER } from './nodeShapes/pathPainter';
import { paintsPose } from './nodeShapes/poseBox';
import { RECT_FALLBACK_PAINTER } from './nodeShapes/rectFallbackPainter';
import { SHAPE_PAINTER } from './nodeShapes/shapePainter';
import { TEXT_PAINTER } from './nodeShapes/textPainter';

/** Optional per-call paint context, threaded through `defaultDrawOne`'s third
 *  argument. Lets a rendering entry point override ambient environment reads
 *  — the headless `renderSceneToPixels` path supplies its own bitmap resolver
 *  here so consumers reuse their own decode caches. Custom painters may
 *  ignore it entirely. */
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
  /** The node's derived path, resolved by the scene-aware `drawOne` wrapper
   *  before painting: `paint` has no scene handle, and deriving needs the
   *  dependencies' poses. **Absent** for a node that derives from nothing —
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
  /** Emits the draw commands for the node's primary visual. `ctx` is an
   *  optional per-call paint context (see `NodePaintCtx`); painters that
   *  don't need it can keep a two-argument signature.
   *
   *  **The returned array belongs to the painter.** Callers must treat it as
   *  immutable and copy before appending — a painter is free to memoize its
   *  command list (`kit:shape` and `kit:path` do), and an in-place `push`
   *  would grow that list on every frame. `defaultDrawOne` copies before
   *  adding its label overlay for exactly this reason. */
  paint(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodePaintCtx): DrawCommand[];
  /** Optional: derive the node's silhouette path from its pose.
   *  Used by clipping (when the container has no explicit
   *  `clipFromPose`), by non-rect hit-testing, and by lasso/area-select.
   *  Painters whose visual has no meaningful closed silhouette (e.g. text)
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
   *  This is declared separately from `paint` rather than read back off the
   *  emitted draw commands because picking runs on every pointer move, and
   *  `paint` is allowed to be expensive (`kit:text` lays out glyphs). Keep it
   *  to cheap field reads.
   *
   *  Painters that leave it undefined are treated as {@link DEFAULT_INK} —
   *  the pre-`ink` behavior, where the whole silhouette interior is grabbable
   *  and the outline adds nothing.
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

// ─── Per-node shape memo ────────────────────────────────────────────────────

/**
 * Slot names for the two things picking asks per node per pointer move: which
 * painter matches, and that painter's silhouette path. Both go through
 * {@link nodeMemo}, so they invalidate on `data` (and, for the silhouette,
 * `pose`) reference changes and on a painter registration.
 *
 * Worth memoizing because both are hot and neither is free. `findNodeShape`
 * runs every registered painter's `matches` predicate; `silhouette` *builds*
 * a path — `pathForShape` allocates a fresh `Float32Array` for every ellipse,
 * polygon and star. Picking runs on every pointermove through both the
 * hover-cursor pump and `classifyTarget`, so that's two rebuilds per move per
 * node under the pointer, and shape-accurate picking is now the default.
 *
 * Separate slots rather than one entry: they mostly invalidate together, but
 * not always, and a shared entry would force the stricter key on both.
 */
const PAINTER_SLOT = 'shape:painter';
const PAINTER_SLOT_NONRECT = 'shape:painter:nonrect';
const PAINTER_SLOT_DERIVED = 'shape:painter:derived';
const PAINTER_SLOT_DERIVED_NONRECT = 'shape:painter:derived:nonrect';
const SILHOUETTE_SLOT = 'shape:silhouette';
const TEXT_SILHOUETTE_SLOT = 'shape:silhouette:text';

/** Find the painter that will render `node` — first match in priority
 *  order. Returns undefined if no painter (including the built-in
 *  fallback) accepts the node. */
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

/** Find the painter for `node` and ask it for the node's silhouette path,
 *  in **world** coords. Returns null if no painter matches, or the matching
 *  painter has no `silhouette` method, or the method returns null. Used by
 *  clipping, generic non-rect hit-testing and lasso/area-select — anywhere
 *  the kit needs the "closed boundary" of whatever this kind of node draws as.
 *
 *  Painters return their silhouette in the pose's local (unrotated) frame;
 *  this bakes the pose's frame (`poseFrameOf`: its rotation and `transform`)
 *  on top, so clips/area-select of a turned or skewed node use the boundary
 *  the renderer draws. (`paint()` is unaffected — the render wrap applies
 *  the frame, not the silhouette, so nothing is applied twice.) */
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
   *  on screen and so stays exact under non-uniform zoom.
   *
   *  Without slop a hairline is a mathematically zero-width target: the
   *  stroke of a 1px outline is half a world unit wide at scale 1, which no
   *  one can hit. Defaults to `0` so a caller that hasn't thought about the
   *  view still gets exact geometry rather than a wrong guess. */
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
 * Does the shape `node` actually paints cover the world point?
 *
 * The pose rect says a node covers its whole bounding box. That is wrong for
 * everything that is not a rectangle: the concave notch of a star, the corner
 * outside an ellipse, the blank right half of a text box. This asks the
 * painter's silhouette instead, which is the same boundary used for clipping
 * and area-select, so "what you can click" and "what is drawn" answer
 * together.
 *
 * "What is drawn" includes the *ink*, not just the boundary. A shape whose
 * interior isn't filled — an outlined rect, a pencil stroke, a bare line — is
 * grabbable along its outline and not through its empty middle, which is the
 * opposite of what a fill test alone answers. The outline's grab width is the
 * stroke's half-width plus `tolerance`.
 *
 * A painter with no `silhouette`, or one that returns `null` for this node
 * (`kit:text` does, for a node with no non-blank lines), reports `true` —
 * "no opinion", leaving the caller's own AABB test as the answer. Callers
 * should keep that AABB test as a cheap pre-filter; this is the refinement,
 * not a replacement.
 *
 * Rotation is already baked by `findShapeSilhouette`, so the point is in
 * plain world coordinates.
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
  // The stroke reaches a different distance on each side, so which side the
  // point is on picks the reach. `tolerance` widens it to something a pointer
  // can actually land on, and also makes a filled shape grabbable a few pixels
  // outside its edge — which is what every editor does and what makes
  // edge-dragging feel possible.
  const slop = widenSlop(opts.tolerance, (inside ? ink.insetPx : ink.outsetPx) ?? 0, opts.scale);
  const { extra, opts: hit } = slopForStrokeHit(slop);
  const reach = (inside ? ink.inset : ink.outset) + extra;
  return (reach > 0 || hasSlop(slop)) && strokeHitTest(sil, x, y, reach, hit);
}

/** Snapshot of the current painters in evaluation order — `'high'` tier
 *  first, then `'normal'`. Useful for debugging which painter handles a
 *  given node. */
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
  // Swapping the painter set out from under a node invalidates anything
  // memoized against the old one. (`registerNodeShape` already bumps, but the
  // clearing above happens without one.)
  bumpNodeMemoGeneration();
}

// ─── Built-in painters ─────────────────────────────────────────────────

function registerBuiltInShapePainters(): void {
  registerNodeShape(TEXT_PAINTER);
  // Ahead of path/shape/image: a derived node whose `data` also carries a
  // `path`, `shape` or `image` means the derived path, and those three match
  // on the presence of the field alone.
  registerNodeShape(DERIVED_PAINTER);
  registerNodeShape(PATH_PAINTER);
  registerNodeShape(SHAPE_PAINTER);
  registerNodeShape(IMAGE_PAINTER);
  registerNodeShape(RECT_FALLBACK_PAINTER);
}
