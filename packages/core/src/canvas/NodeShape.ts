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
import { setDepOutlineReader } from 'core/scene/booleanOfChildren';
import type { Node } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { hasSlop, slopForStrokeHit, widenSlop, type PickSlop } from 'core/viewport/screenSlop';
import { DERIVED_PAINTER } from './nodeShapes/derivedPainter';
import { IMAGE_PAINTER } from './nodeShapes/imagePainter';
import { MEASURE_PAINTER } from './nodeShapes/measurePainter';
import { derivesPath } from './nodeShapes/memo';
import { PATH_PAINTER } from './nodeShapes/pathPainter';
import { paintsPose } from './nodeShapes/poseBox';
import { RECT_FALLBACK_PAINTER } from './nodeShapes/rectFallbackPainter';
import { SHAPE_PAINTER } from './nodeShapes/shapePainter';
import { TEXT_PAINTER } from './nodeShapes/textPainter';
import type { NodeShapeEntry, NodeInk, NodeSilhouetteCtx, NodeInkCtx } from './nodeShapeTypes';
export type { NodePaintCtx, SceneViewDrawOne, NodeShapeEntry, NodeInk, NodeSilhouetteCtx, NodeInkCtx } from './nodeShapeTypes';
export type { InheritedPaint } from 'core/scene/inheritedPaint';

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

// A boolean group's operands are its children's outlines.
setDepOutlineReader((dep) => findShapeSilhouette(dep.node, dep.pose, { derivedPath: dep.path }));

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
  /** See {@link NodeInkCtx.inherited}. Without it an `'inherit'` field is
   *  read as none. */
  inherited?: NodeInkCtx['inherited'];
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
  // A group paints nothing, so its interior is its box, which the caller's pre-filter tested.
  if (node.kind === 'group') return true;
  const sil = findShapeSilhouette(node, pose, { derivedPath: opts.derivedPath });
  if (sil === null) return true;
  const ink = findShapeInk(node, pose, { scale: opts.scale, inherited: opts.inherited }) ?? DEFAULT_INK;
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
