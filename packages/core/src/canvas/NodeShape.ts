/**
 * NodeShape — the **shape trait's** registry. Each trait of a node
 * (shape, routing, label, icon, affordances, …) is its own registry;
 * this one holds the per-kind `paint` + `silhouette` (and future
 * fields) used by `defaultDrawOne`, clipping, non-rect hit-testing,
 * lasso/area-select, and SVG export.
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
 * `matches` predicate returns true paints the node.
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
import type { Node } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { DrawCommand } from '../renderer';
import { textCommand, textCommandFromRuns } from 'features/text/textCommand';
import type { TextStyle } from 'features/text/textStyle';
import type { StyledRun } from 'features/text/runs';
import { textLineBoxes } from 'features/text/lineBoxes';
import type { FillStyle, Stroke } from 'core/paint-types';
import { DEFAULT_SHAPE_FILL } from '../util/paint';
import type { Path, PolygonPath } from 'features/paths/types';
import { PATH_M, PATH_L, PATH_Z } from 'features/paths/types';
import { ellipsePath, regularPolygonPath, starPath, linePath } from 'features/paths/builder';
import { pathContainsPoint } from 'features/paths/pathHitTest';
import { boundsOfPath } from 'features/paths/bounds';
import { strokeHitTest } from 'features/paths/hitTest';
import { resolveStrokeWidth } from 'features/paths/tessellate/stroke';
import { poseRotationOf, rotatePathAround } from 'features/paths/poseRotation';
import { pathInPoseFrame } from 'features/paths/pathInWorld';
import { fillInPoseFrame, type FillPoseBox } from '../core/fillInPoseFrame';
import { resolveFillPattern } from '../features/patterns/resolveSpec';
import { getImageBitmap, imageStatus } from 'features/images/imageCache';
import { nodeMemo, bumpNodeMemoGeneration } from 'core/scene/nodeMemo';

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
  /** The node's derived path, resolved by the scene-aware `drawOne` wrapper
   *  before painting: `paint` has no scene handle, and deriving needs the
   *  dependencies' poses. `null` for a node that derives from nothing. */
  derivedPath?: Path | null;
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
   *  painter (`'high'` tier first, then `'normal'`) wins. */
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
   *  `clipFromPose`), by non-rect hit-testing, by lasso/area-select,
   *  and by SVG export. Painters whose visual has no meaningful closed
   *  silhouette (e.g. text) leave this undefined. */
  silhouette?(node: Node<TData, string, TPose>, pose: TPose): Path | null;
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
}

/** Per-call context for {@link NodeShapeEntry.ink}. */
export interface NodeInkCtx {
  /** View scale, for resolving `{ px }` stroke widths to world units. */
  scale?: number;
}

/** What a painter that declares no `ink` is assumed to do. */
const DEFAULT_INK: NodeInk = { filled: true, outset: 0, inset: 0 };

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

/** Register a shape painter. Returns a disposer that removes it. */
export function registerNodeShape<TData, TPose>(
  painter: NodeShapeEntry<TData, TPose>,
  opts: RegisterNodeShapeOptions = {},
): () => void {
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
const SILHOUETTE_SLOT = 'shape:silhouette';

/**
 * Slot for a painter's memoized `paint` output.
 *
 * Distinct from {@link SILHOUETTE_SLOT} even though the two mostly invalidate
 * together: the silhouette bakes `pose.rotation` in (paint does not — the
 * render wrap applies it), and paint alone can depend on `NodePaintCtx` and on
 * ambient readiness. One entry keyed the same way for both would be wrong in
 * both directions.
 *
 * **Only for painters that are a pure function of `(node, pose, data)`.**
 * `kit:shape` and `kit:path` qualify and are also precisely the painters that
 * allocated a fresh `Path` per frame, defeating the tessellation cache in
 * `renderer/cache/cache.ts` (`WeakMap<Path, Mesh>`, keyed on Path identity).
 * `kit:text` and `kit:image` do not qualify — see the tests in
 * `NodeShape.cache.test.ts` that pin their opt-out.
 */
const PAINT_SLOT = 'shape:paint';

/** Find the painter that will render `node` — first match in priority
 *  order. Returns undefined if no painter (including the built-in
 *  fallback) accepts the node. */
export function findNodeShape<TData, TPose>(
  node: Node<TData, string, TPose>,
): NodeShapeEntry<TData, TPose> | undefined {
  // No pose in the key: `matches` predicates read `node.data`, never the pose.
  return nodeMemo(node as { data?: unknown }, PAINTER_SLOT, undefined, () =>
    matchNodeShape(node),
  );
}

function matchNodeShape<TData, TPose>(
  node: Node<TData, string, TPose>,
): NodeShapeEntry<TData, TPose> | undefined {
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
 *  clipping, generic non-rect hit-testing, lasso, and SVG export — anywhere
 *  the kit needs the "closed boundary" of whatever this kind of node draws as.
 *
 *  Painters return their silhouette in the pose's local (unrotated) frame;
 *  this bakes `pose.rotation` on top via the shared rotation convention, so
 *  clips/area-select of a rotated node use the rotated boundary the renderer
 *  draws. (`paint()` is unaffected — it applies rotation via the render wrap,
 *  not the silhouette, so there is no double-rotation.) */
export function findShapeSilhouette<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
): Path | null {
  return nodeMemo(node as { data?: unknown }, SILHOUETTE_SLOT, pose, () => {
    const sil = findNodeShape(node)?.silhouette?.(node, pose) ?? null;
    const r = sil ? poseRotationOf(pose) : null;
    return sil && r ? rotatePathAround(sil, r.cx, r.cy, r.rotation) : sil;
  });
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

/** Options for {@link shapeCoversPoint}. */
export interface ShapeCoversPointOptions {
  /** Extra grab distance around the outline, in **world** units. Callers
   *  derive it from a screen-pixel slop and the view scale, the same way
   *  affordance hit radii work.
   *
   *  Without slop a hairline is a mathematically zero-width target: the
   *  stroke of a 1px outline is half a world unit wide at scale 1, which no
   *  one can hit. Defaults to `0` so a caller that hasn't thought about the
   *  view still gets exact geometry rather than a wrong guess. */
  tolerance?: number;
  /** View scale, passed to the painter's `ink` so a `{ px }` stroke width
   *  resolves to world units. Defaults to 1. */
  scale?: number;
}

/**
 * Does the shape `node` actually paints cover the world point?
 *
 * The pose rect says a node covers its whole bounding box. That is wrong for
 * everything that is not a rectangle: the concave notch of a star, the corner
 * outside an ellipse, the blank right half of a text box. This asks the
 * painter's silhouette instead, which is the same boundary used for clipping
 * and SVG export, so "what you can click" and "what is drawn" answer together.
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
  const sil = findShapeSilhouette(node, pose);
  if (sil === null) return true;
  const ink = findShapeInk(node, pose, { scale: opts.scale }) ?? DEFAULT_INK;
  const inside = pathContainsPoint(sil, x, y);
  if (ink.filled && inside) return true;
  // The stroke reaches a different distance on each side, so which side the
  // point is on picks the reach. `tolerance` widens it to something a pointer
  // can actually land on, and also makes a filled shape grabbable a few pixels
  // outside its edge — which is what every editor does and what makes
  // edge-dragging feel possible.
  const reach = (inside ? ink.inset : ink.outset) + (opts.tolerance ?? 0);
  return reach > 0 && strokeHitTest(sil, x, y, reach);
}

/** Snapshot of the current painters in evaluation order — `'high'` tier
 *  first, then `'normal'`. Useful for debugging which painter handles a
 *  given node. */
export function getNodeShapes(): readonly NodeShapeEntry[] {
  return [...PAINTERS.high, ...PAINTERS.normal];
}

/** Test-only: clear the registry and re-register the built-ins. */
export function _resetShapePaintersForTests(): void {
  PAINTERS.high.length = 0;
  PAINTERS.normal.length = 0;
  registerBuiltInShapePainters();
  // Swapping the painter set out from under a node invalidates anything
  // memoized against the old one. (`registerNodeShape` already bumps, but the
  // clearing above happens without one.)
  bumpNodeMemoGeneration();
}

// ─── Built-in painters ─────────────────────────────────────────────────

interface RectPose { x: number; y: number; width: number; height: number }

const TEXT_PAINTER: NodeShapeEntry = {
  id: 'kit:text',
  matches: (node) => {
    const d = node.data as { text?: string } | null;
    return d?.text != null;
  },
  // Memoized, and not for its own sake — `resolveTextStyle` + `resolveRuns`
  // are cheap (0.14 ms/frame at 1000 text nodes). It is the enabler: the
  // renderer's layout cache keys on the `ResolvedRun[]` array identity, and
  // `layoutRuns` costs 25.9 ms/frame for 200 wrapped paragraphs. Handing back
  // a fresh runs array per frame would leave that cache missing on every
  // draw, exactly as a fresh `Path` per frame defeated the mesh cache. Both
  // resolvers are pure style merging — no font reads — so `(data, pose)` is
  // the whole key. See PAINT_SLOT.
  paint: (node, pose) => nodeMemo(node, PAINT_SLOT, pose, () => {
    const d = node.data as {
      text: string;
      style?: TextStyle;
      runs?: readonly StyledRun[];
      fill?: FillStyle | null;
      stroke?: Stroke | null;
    };
    const p = pose as RectPose;
    // `y` is the TOP of the first line box, not a baseline: `layoutRuns`
    // walks down from it by `common.base * scale` to reach the baseline, and
    // `verticalAlign` aligns the laid-out block within `[y, y + height]`.
    // This used to pass `p.y + fontSize`, which is the canvas-2D
    // `fillText` convention and wrong here — it put the baseline nearly two
    // ems below the box top, hung descenders outside the pose, and made the
    // box handed to `verticalAlign` a different box from the node's own. It
    // also disagreed with `createTextLayer` and with the DOM editing overlay
    // (`useSceneTextEdit.getScreenPose`), both of which anchor on `pose.y` —
    // so text jumped a full line the moment an edit was committed.
    //
    // Forward the pose's box height so a future `verticalAlign` opt-in has
    // something to align within. Default `verticalAlign` is 'top', which
    // resolves to a zero offset regardless of `height` — so this is a no-op
    // for every existing kit:text node. `maxWidth` (word-wrap) is
    // deliberately NOT forwarded: generic kit:text nodes have no data/style
    // slot for opting into wrap or box vertical-align yet, and forwarding
    // maxWidth would silently start wrapping consumers' existing text.
    //
    // `runs` wins over `text` when present. It is the richer form of the same
    // content — `useTextEdit` commits both, keeping `runsToPlainText(runs)`
    // equal to `text` — so re-flattening the string here would make the whole
    // run algebra write-only for anything painted by the default scene layer.
    // Empty runs are not a styling, so they fall back rather than paint
    // nothing.
    const y = p.y;
    // Text reads the same `data.fill` / `data.stroke` every other node kind
    // reads, so one set of paint controls writes all of them.
    const paint = { fill: d.fill, stroke: d.stroke };
    return d.runs && d.runs.length > 0
      ? [textCommandFromRuns(p.x, y, d.runs, d.style, undefined, p.height, undefined, paint)]
      : [textCommand(p.x, y, d.text, d.style, undefined, p.height, undefined, paint)];
  }),
  // The pose is a *wrap box*, not a bounding box — "Away" in a 300-unit box
  // leaves most of it empty, and a pose-rect silhouette claims all of it. The
  // union of the line boxes is what the node actually covers, so picking,
  // lasso and clipping stop grabbing blank space. `Infinity` because `paint`
  // above deliberately does not forward `maxWidth`: this text does not wrap,
  // and boxes measured against `p.width` would wrap where the paint did not.
  //
  // `null` rather than an empty path when there are no non-blank lines: an
  // empty text node would otherwise become unpickable, and a caller reading
  // "no silhouette" falls back to the pose rect, which is the behavior an
  // empty box wants.
  silhouette: (node, pose) => {
    const d = node.data as { text: string; style?: TextStyle; runs?: readonly StyledRun[] };
    const p = pose as RectPose;
    const boxes = textLineBoxes(
      {
        x: p.x, y: p.y, width: p.width, height: p.height,
        text: d.text, runs: d.runs as StyledRun[] | undefined, style: d.style,
      },
      { maxWidth: Infinity },
    );
    if (boxes.length === 0) return null;
    return rectsToPath(boxes);
  },
};

/**
 * Union of axis-aligned rects as one multi-contour `PolygonPath`.
 *
 * Every contour winds the same way, so `'nonzero'` reads overlapping rects as
 * covered rather than punching a hole where two lines happen to overlap —
 * which they do the moment `lineHeight` drops below 1.
 */
function rectsToPath(rects: readonly { x: number; y: number; width: number; height: number }[]): PolygonPath {
  const commands = new Uint8Array(rects.length * 6);
  const coords = new Float32Array(rects.length * 10);
  let ci = 0;
  let cmd = 0;
  for (const r of rects) {
    const { x, y, width: w, height: h } = r;
    commands[cmd++] = PATH_M; coords[ci++] = x; coords[ci++] = y;
    commands[cmd++] = PATH_L; coords[ci++] = x + w; coords[ci++] = y;
    commands[cmd++] = PATH_L; coords[ci++] = x + w; coords[ci++] = y + h;
    commands[cmd++] = PATH_L; coords[ci++] = x; coords[ci++] = y + h;
    commands[cmd++] = PATH_L; coords[ci++] = x; coords[ci++] = y;
    commands[cmd++] = PATH_Z;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

/**
 * What a node's `data.fill` means to the built-in painters.
 *
 * A {@link FillStyle} is used as-is — which is how a gradient or a pattern
 * reaches the renderer without a consumer registering a painter of its own.
 * `null` is an explicit "no fill"; `undefined` takes the painter's fallback.
 * Write one with {@link solid} rather than by hand when all you have is a
 * color.
 */
function resolveNodeFill(
  fill: FillStyle | null | undefined,
  fallback: FillStyle | null,
): FillStyle | null {
  return fill === undefined ? fallback : fill;
}

/** The stroke a built-in painter should emit, or `null` for "no stroke".
 *  `data.stroke` is a whole {@link Stroke} — width, cap, join, dash, miter
 *  limit and align all reach the renderer. {@link strokeOf} builds one from a
 *  color. */
function resolveNodeStroke(stroke: Stroke | null | undefined): Stroke | null {
  return stroke ?? null;
}

/** Bake a bounds-relative stroke paint onto the given box, the way a fill is
 *  baked. The box is the frame the path was projected into, so a paint left in
 *  `'bounds'` units would reach the renderer describing a frame that never
 *  exists. `null` when a pattern spec fails to resolve. */
function strokeInPoseFrame(stroke: Stroke, box: FillPoseBox): Stroke | null {
  const paint = resolveFillPattern(fillInPoseFrame(stroke.paint, box));
  if (paint === null) return null;
  return paint === stroke.paint ? stroke : { ...stroke, paint };
}

/** Per-side grab reach for a resolved stroke, in world units. */
function inkReach(
  stroke: Stroke | null,
  scale: number | undefined,
): { outset: number; inset: number } {
  if (stroke === null) return { outset: 0, inset: 0 };
  const w = resolveStrokeWidth(stroke.width ?? 1, scale ?? 1);
  switch (stroke.align ?? 'center') {
    case 'inner':
      return { outset: 0, inset: w };
    case 'outer':
      return { outset: w, inset: 0 };
    default:
      return { outset: w / 2, inset: w / 2 };
  }
}

const PATH_PAINTER: NodeShapeEntry = {
  id: 'kit:path',
  matches: (node) => {
    const d = node.data as { path?: Path } | null;
    return d?.path != null;
  },
  // Memoized: a pure function of `(data, pose)`, and `pathInPoseFrame`
  // allocates on every call but the identity (`kind: 'rect'`) branch. See
  // PAINT_SLOT.
  paint: (node, pose) => nodeMemo(node, PAINT_SLOT, pose, () => {
    const d = node.data as {
      path: Path;
      fill?: FillStyle | null;
      stroke?: Stroke | null;
    };
    const projected = pathInPoseFrame(d.path, pose as RectPose);
    const strokeSpec = resolveNodeStroke(d.stroke);
    const hasStroke = strokeSpec !== null;
    // An undeclared fill falls back to the default one only if there's no
    // stroke — otherwise the path is stroke-only (e.g. pencil) and a default
    // fill would be wrong.
    const declared = resolveNodeFill(d.fill, hasStroke ? null : DEFAULT_SHAPE_FILL);
    // The pose is baked into `projected` rather than emitted as a transform,
    // so a box-relative gradient has to be baked onto the same box here or
    // it would arrive in the renderer referring to a frame that never exists.
    const fill = declared && resolveFillPattern(fillInPoseFrame(declared, pose as RectPose));
    const stroke = strokeSpec && strokeInPoseFrame(strokeSpec, pose as RectPose);
    const cmd: DrawCommand = {
      kind: 'path',
      path: projected,
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    };
    return [cmd];
  }),
  silhouette: (node, pose) => {
    const d = node.data as { path: Path };
    return pathInPoseFrame(d.path, pose as RectPose);
  },
  // Mirrors the fill/stroke decisions `paint` makes above — same reads, same
  // 'none' handling, same "no fill declared and a stroke present means
  // stroke-only" fallback. Kept in step with `paint` by
  // `NodeShape.ink.test.ts`, which asserts the two agree.
  ink: (node, _pose, ctx) => {
    const d = node.data as {
      fill?: FillStyle | null;
      stroke?: Stroke | null;
    };
    const stroke = resolveNodeStroke(d.stroke);
    const hasStroke = stroke !== null;
    return {
      filled: resolveNodeFill(d.fill, hasStroke ? null : DEFAULT_SHAPE_FILL) !== null,
      ...inkReach(stroke, ctx?.scale),
    };
  },
};

/** Built-in shape dispatcher — matches when `data.shape` names a kit-known
 *  shape kind. Computes both paint and silhouette from the pose so consumer
 *  scenes can declare clipping/rendering directly in JSON without
 *  registering a custom painter. */
const SHAPE_PAINTER: NodeShapeEntry = {
  id: 'kit:shape',
  matches: (node) => {
    const s = (node.data as { shape?: string } | null)?.shape;
    return s != null && SHAPE_KINDS.has(s);
  },
  // Memoized: a pure function of `(data, pose)`, and `pathForShape` builds a
  // fresh `Uint8Array` + `Float32Array` for every ellipse, polygon and star.
  // See PAINT_SLOT.
  paint: (node, pose) => nodeMemo(node, PAINT_SLOT, pose, () => {
    const d = node.data as { shape: string; fill?: FillStyle | null; stroke?: Stroke | null; sides?: number; points?: number };
    const path = pathForShape(d, pose as RectPose);
    const declaredFill = resolveNodeFill(d.fill, DEFAULT_SHAPE_FILL);
    const shapeFill = declaredFill && resolveFillPattern(fillInPoseFrame(declaredFill, pose as RectPose));
    const strokeSpec = resolveNodeStroke(d.stroke);
    const stroke = strokeSpec && strokeInPoseFrame(strokeSpec, pose as RectPose);
    return [{
      kind: 'path',
      path,
      ...(shapeFill ? { fill: shapeFill } : {}),
      ...(stroke ? { stroke } : {}),
    }];
  }),
  silhouette: (node, pose) => {
    const d = node.data as { shape: string; sides?: number; points?: number };
    return pathForShape(d, pose as RectPose);
  },
  // `paint` above emits the default fill when none is declared, so a shape
  // is filled unless it declares `fill: null` — unlike `kit:path`, it has no
  // implicit stroke-only form.
  ink: (node, _pose, ctx) => {
    const d = node.data as { fill?: FillStyle | null; stroke?: Stroke | null };
    return {
      filled: resolveNodeFill(d.fill, DEFAULT_SHAPE_FILL) !== null,
      ...inkReach(resolveNodeStroke(d.stroke), ctx?.scale),
    };
  },
};

const SHAPE_KINDS = new Set(['rect', 'ellipse', 'polygon', 'star']);

function pathForShape(
  d: { shape: string; sides?: number; points?: number },
  p: RectPose,
): Path {
  switch (d.shape) {
    case 'ellipse':
      return ellipsePath(p);
    case 'polygon': {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const r = Math.min(p.width, p.height) / 2;
      return regularPolygonPath({ x: cx, y: cy }, r, d.sides ?? 6);
    }
    case 'star': {
      const cx = p.x + p.width / 2;
      const cy = p.y + p.height / 2;
      const r = Math.min(p.width, p.height) / 2;
      return starPath({ x: cx, y: cy }, r, d.points ?? 5);
    }
    case 'rect':
    default:
      return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  }
}

/** Raster-image painter. Renders `data.image.src` (URL / blob: / data-URI)
 *  via an `ImageDrawCommand` once the bitmap has decoded; until then it paints
 *  a faint placeholder outline so the node stays visible + selectable (a
 *  reddish outline + slash marks a failed load). The decoded bitmap is owned
 *  by `imageCache`, keyed on `src`; the node holds only the serializable `src`.
 *  Registered before `kit:rect-fallback` so image nodes don't fall through. */
const IMAGE_PAINTER: NodeShapeEntry = {
  id: 'kit:image',
  matches: (node) => {
    const src = (node.data as { image?: { src?: unknown } } | null)?.image?.src;
    return typeof src === 'string' && src.length > 0;
  },
  paint: (node, pose, ctx) => {
    const d = node.data as { image: { src: string; opacity?: number } };
    const p = pose as RectPose;
    const bmp = ctx?.resolveImage
      ? ctx.resolveImage(node)
      : getImageBitmap(d.image.src);
    if (bmp) {
      return [{
        kind: 'image',
        image: bmp,
        x: p.x, y: p.y, w: p.width, h: p.height,
        ...(d.image.opacity !== undefined ? { opacity: d.image.opacity } : {}),
      }];
    }
    // Not ready — faint placeholder (grey while loading, reddish + slash on
    // error). With a caller-supplied resolver the fallback is deterministic:
    // always the plain grey outline, no ambient load-status read.
    const error = ctx?.resolveImage ? false : imageStatus(d.image.src) === 'error';
    const color = error ? '#d08a8a' : '#bbbbbb';
    const cmds: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      stroke: { paint: { color }, width: 1 },
    }];
    if (error) {
      cmds.push({
        kind: 'path',
        path: linePath({ x: p.x, y: p.y }, { x: p.x + p.width, y: p.y + p.height }),
        stroke: { paint: { color }, width: 1 },
      });
    }
    return cmds;
  },
  silhouette: (_node, pose) => {
    const p = pose as RectPose;
    return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  },
};

/**
 * Built-in painter for nodes whose geometry is computed from other nodes'
 * poses. The path itself arrives on the paint context — see
 * {@link NodePaintCtx.derivedPath}.
 *
 * Fill and stroke resolve as `kit:path`'s do, but against the **derived path's
 * own bounds**, not the pose. `kit:path` projects its path into the pose frame
 * first, so there the two boxes are the same one; here the path is already
 * absolute and the pose is typically a zero-sized placeholder, which would
 * collapse a box-relative gradient onto a point.
 *
 * Not memoized on {@link PAINT_SLOT} on purpose: that key is `(node, pose,
 * data)` and cannot see `ctx.derivedPath`, so it would serve one caller's
 * commands to a caller that passed a different path.
 *
 * Rotation still comes from the pose — `wrapNodeOutput` turns the output about
 * the pose AABB's center, which for a zero-sized pose is its origin.
 */
const DERIVED_PAINTER: NodeShapeEntry = {
  id: 'kit:derived',
  matches: (node) => (node.dependsOn?.length ?? 0) > 0,
  paint: (node, _pose, ctx) => {
    const path = ctx?.derivedPath;
    if (path == null) return [];
    const box = boundsOfPath(path);
    const d = node.data as { fill?: FillStyle | null; stroke?: Stroke | null } | null;
    const strokeSpec = resolveNodeStroke(d?.stroke);
    const declared = resolveNodeFill(d?.fill, strokeSpec === null ? DEFAULT_SHAPE_FILL : null);
    const fill = declared && resolveFillPattern(fillInPoseFrame(declared, box));
    const stroke = strokeSpec && strokeInPoseFrame(strokeSpec, box);
    return [{
      kind: 'path',
      path,
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    }];
  },
};

const RECT_FALLBACK_PAINTER: NodeShapeEntry = {
  // Last-resort painter — always matches, so it must be registered last
  // within `'normal'`. Consumers who want a different fallback should
  // register their own painter at `'high'` priority and let this one
  // never fire (or unregister it explicitly).
  id: 'kit:rect-fallback',
  matches: () => true,
  paint: (node, pose) => {
    const d = node.data as { fill?: FillStyle | null } | null;
    const p = pose as RectPose;
    const fill = resolveNodeFill(d?.fill, DEFAULT_SHAPE_FILL);
    return [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      ...(fill ? { fill } : {}),
    }];
  },
  silhouette: (_node, pose) => {
    const p = pose as RectPose;
    return { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height };
  },
};

function registerBuiltInShapePainters(): void {
  registerNodeShape(TEXT_PAINTER);
  registerNodeShape(PATH_PAINTER);
  registerNodeShape(SHAPE_PAINTER);
  registerNodeShape(IMAGE_PAINTER);
  registerNodeShape(DERIVED_PAINTER);
  registerNodeShape(RECT_FALLBACK_PAINTER);
}

registerBuiltInShapePainters();
