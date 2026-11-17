/**
 * NodeShape — the **shape trait's** lookups: the per-kind `paint` + `silhouette` used by
 * `defaultDrawOne`, clipping, non-rect hit-testing, and lasso/area-select. Teaching the kit
 * about a new kind of shape goes through this registry rather than by overriding `drawOne`.
 *
 * The first entry whose `matches` predicate returns true paints the node: `'high'` entries
 * first, then the built-ins, then `'normal'` ones, in registration order within a tier, and
 * last `kit:path-pose` and `kit:rect-fallback`, which take any `Path`-posed or rect-posed node
 * nothing else claimed. Every other built-in but `kit:derived` requires a rect-shaped pose — a
 * scene whose poses are some other shape matches none of them, and paints through a consumer
 * painter or not at all.
 *
 * Every lookup asks a registry (`nodeShapeRegistry.ts`): the scene's own, `nodeShapesOf(scene)`,
 * where the caller draws or picks for a scene, and `defaultNodeShapes` where it passes none.
 */
import { pathThroughPoseFrame, poseFrameOf, type Path } from '@weasel-js/geom';
import { strokeTrimKey, type StrokeTrim } from '@weasel-js/paint';
import { nodeMemo } from 'core/scene/nodeMemo';
import { setDepOutlineReader } from 'core/scene/booleanOfChildren';
import type { Node } from 'core/scene/types';
import { positiveBox } from 'core/geometry/unionBounds';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PickSlop } from 'core/viewport/screenSlop';
import { derivedPartsOf } from 'core/scene/derivedParts';
import { DERIVED_PAINTER, partsCover } from './nodeShapes/derivedPainter';
import { inkCovers, trimmedOutline, type TrimmedOutline } from './nodeShapes/pickOutline';
import { IMAGE_PAINTER } from './nodeShapes/imagePainter';
import { derivesPath } from './nodeShapes/memo';
import { PATH_PAINTER } from './nodeShapes/pathPainter';
import { paintsPose } from './nodeShapes/poseBox';
import { PATH_POSE_PAINTER } from './nodeShapes/pathPosePainter';
import { RECT_FALLBACK_PAINTER } from './nodeShapes/rectFallbackPainter';
import { SHAPE_PAINTER } from './nodeShapes/shapePainter';
import type { NodeShapeEntry, NodeInk, NodeSilhouetteCtx, NodeInkCtx } from './nodeShapeTypes';
import {
  addBuiltInShape, defaultNodeShapes, effectiveShapes, ensureBuiltInShapes, evaluationOrder, nodeShapesChanged, nodeShapesOf,
  resetNodeShapesForTests, setBuiltInShapes, type NodeShapes,
} from './nodeShapeRegistry';
export {
  createNodeShapes, defaultNodeShapes, nodeShapesOf, subscribeNodeShapes,
  type NodeShapes, type RegisterNodeShapeOptions,
} from './nodeShapeRegistry';
import type { RegisterNodeShapeOptions } from './nodeShapeRegistry';
export type { NodePaintCtx, SceneViewDrawOne, NodeShapeEntry, NodeInk, NodeSilhouetteCtx, NodeInkCtx } from './nodeShapeTypes';
export type { InheritedPaint } from 'core/scene/inheritedPaint';

/** What a painter that declares no `ink` is assumed to do. */
export const DEFAULT_INK: Readonly<NodeInk> = Object.freeze({ filled: true, outset: 0, inset: 0 });

/** Register a painter in {@link defaultNodeShapes}, for every scene. A painter only some scenes
 *  should paint with goes in theirs: `nodeShapesOf(scene).register`, or a preset's `shapes`.
 *  Returns a disposer that removes this registration, and only it. */
export function registerNodeShape<TData, TPose>(
  painter: NodeShapeEntry<TData, TPose>,
  opts: RegisterNodeShapeOptions = {},
): () => void {
  return defaultNodeShapes.register(painter, opts);
}

/**
 * Tell the kit that something a registered painter reads besides the node has changed — a
 * table of named outlines, say — so every node's painter, silhouette and ink are read again,
 * and every mounted canvas repaints.
 */
export function refreshNodeShapes(): void {
  nodeShapesChanged();
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
const VARYING_SILHOUETTE_SLOT = 'shape:silhouette:varying';

/** A silhouette and the painter's `geometryGeneration` and `silhouetteKey` it was built under. */
interface VaryingSilhouette { generation: number; key: number; path: Path | null }
const TRIM_PICK_SLOT = 'shape:trim-pick';

/** Memo slot names for `shapes`'s lookups; the default registry keeps the bare names. */
const slotFor = (slot: string, shapes: NodeShapes): string => {
  const serial = effectiveShapes(shapes).serial;
  return serial === 0 ? slot : `${slot}#${serial}`;
};

/** The painter that will render `node` — first match in priority order in `shapes` — or
 *  undefined if none accepts it. */
export function findNodeShape<TData, TPose>(
  node: Node<TData, string, TPose>,
  shapes: NodeShapes = defaultNodeShapes,
): NodeShapeEntry<TData, TPose> | undefined {
  // Built-in painters also gate on pose shape and on whether the node derives
  // its path, neither of which shows in `data`, so the key carries both.
  const rect = paintsPose(node.pose);
  const slot = derivesPath(node)
    ? (rect ? PAINTER_SLOT_DERIVED : PAINTER_SLOT_DERIVED_NONRECT)
    : (rect ? PAINTER_SLOT : PAINTER_SLOT_NONRECT);
  return nodeMemo(node as { data?: unknown }, slotFor(slot, shapes), undefined, () =>
    matchNodeShape(node, shapes),
  );
}

function matchNodeShape<TData, TPose>(
  node: Node<TData, string, TPose>,
  shapes: NodeShapes,
): NodeShapeEntry<TData, TPose> | undefined {
  for (const { entry } of evaluationOrder(effectiveShapes(shapes))) {
    if (entry.matches(node as Node<unknown, string, unknown>)) return entry as NodeShapeEntry<TData, TPose>;
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
    const sil = localSilhouette(node, pose, ctx);
    return sil && pathThroughPoseFrame(sil.kind === 'rect' ? positiveBox(sil) : sil, pose);
  };
  // `SILHOUETTE_SLOT`'s key is (node, pose, data) and cannot see
  // `ctx.derivedPath` — the same reason `kit:derived` skips `PAINT_SLOT`.
  // Memoizing here would serve one caller's silhouette to a caller that
  // passed a different path. Only an actual path skips it: a scene-backed
  // source answers `null` for every ordinary node, and treating that as a
  // reason to bypass would retire the memo for the whole scene.
  if (ctx?.derivedPath != null) return build();
  // A painter whose outline moves with something the node does not show — faces landing, the
  // view scale — has its silhouette checked against each as it was built.
  const shapes = ctx?.shapes ?? defaultNodeShapes;
  const entry = findNodeShape(node, shapes);
  if (entry?.geometryGeneration || entry?.silhouetteKey) {
    const generation = entry.geometryGeneration?.() ?? 0;
    const key = entry.silhouetteKey?.(node, ctx) ?? 0;
    const held = nodeMemo(node as { data?: unknown }, slotFor(VARYING_SILHOUETTE_SLOT, shapes), pose,
      (): VaryingSilhouette => ({ generation, key, path: build() }));
    if (held.generation !== generation || held.key !== key) {
      held.generation = generation; held.key = key;
      held.path = build();
    }
    return held.path;
  }
  return nodeMemo(node as { data?: unknown }, slotFor(SILHOUETTE_SLOT, shapes), pose, build);
}

/** The silhouette `node`'s painter returns, in the pose's local frame: what its stroke is drawn along. */
function localSilhouette<TData, TPose>(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodeSilhouetteCtx): Path | null {
  return findNodeShape(node, ctx?.shapes)?.silhouette?.(node, pose, ctx) ?? null;
}

// A boolean group's operands are its children's outlines.
setDepOutlineReader((dep) => findShapeSilhouette(dep.node, dep.pose, {
  derivedPath: dep.path, ...(dep.scene ? { shapes: nodeShapesOf(dep.scene) } : {}),
}));

/** Find the painter for `node` and ask how it inks its silhouette. Returns
 *  the painter's declared {@link NodeInk}, or `null` when no painter matches
 *  or it declares none — callers substitute {@link DEFAULT_INK}. */
export function findShapeInk<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
  ctx?: NodeInkCtx,
): NodeInk | null {
  return findNodeShape(node, ctx?.shapes)?.ink?.(node, pose, ctx) ?? null;
}

/** Find the painter for `node` and ask for the box its paint fits in. `null`
 *  when no painter matches, or the one that does cannot say — see
 *  {@link NodeShapeEntry.bounds}. */
export function findShapeBounds<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
  ctx?: NodeInkCtx,
): Bounds | null {
  return findNodeShape(node, ctx?.shapes)?.bounds?.(node, pose, ctx) ?? null;
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
  /** The painters to ask: the scene's, `nodeShapesOf(scene)`. Default `defaultNodeShapes`. */
  shapes?: NodeShapes;
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
  const shapes = opts.shapes;
  const sil = findShapeSilhouette(node, pose, { derivedPath: opts.derivedPath, scale: opts.scale, shapes });
  if (sil === null) return true;
  const parts = derivedPartsOf(opts.derivedPath);
  if (parts !== undefined) return partsCover(node, parts, pose, x, y, opts);
  const ink = findShapeInk(node, pose, { scale: opts.scale, inherited: opts.inherited, shapes }) ?? DEFAULT_INK;
  const trim = ink.stroke?.trim;
  const trimmed = trim === undefined ? undefined : trimmedOutlineOf(node, pose, sil, trim, opts.derivedPath, shapes ?? defaultNodeShapes);
  return inkCovers(sil, ink, trimmed, x, y, opts);
}

/** {@link trimmedOutline} for `node`'s silhouette `sil`, memoized as the silhouette is. */
function trimmedOutlineOf<TData, TPose>(
  node: Node<TData, string, TPose>, pose: TPose, sil: Path, trim: StrokeTrim, derivedPath: Path | null | undefined,
  shapes: NodeShapes,
): TrimmedOutline {
  const build = (): TrimmedOutline => {
    const local = poseFrameOf(pose) === null ? sil : localSilhouette(node, pose, { derivedPath, shapes }) ?? sil;
    return trimmedOutline(local, sil, pose, trim);
  };
  // The trim may be inherited, rebuilt per query, so its value keys the memo beside the node;
  // see `findShapeSilhouette` for the derived path.
  return derivedPath != null ? build() : nodeMemo(node as { data?: unknown }, slotFor(TRIM_PICK_SLOT, shapes), pose, build, strokeTrimKey(trim));
}

/** The painters `shapes` resolves, in evaluation order — `'high'` tier first, then `'normal'`,
 *  then the rect fallback. Default `defaultNodeShapes`. */
export function nodeShapeEntries(shapes: NodeShapes = defaultNodeShapes): readonly NodeShapeEntry[] {
  return shapes.entries();
}

/** Test-only: clear the default registry and re-register the built-ins. */
export function _resetShapePaintersForTests(): void {
  resetNodeShapesForTests();
  ensureBuiltInShapes();
  nodeShapesChanged();
}

setBuiltInShapes(() => {
  // Ahead of path/shape/image: a derived node whose `data` also carries a
  // `path`, `shape` or `image` means the derived path, and those three match
  // on the presence of the field alone.
  addBuiltInShape(DERIVED_PAINTER as NodeShapeEntry, 'builtin');
  addBuiltInShape(PATH_PAINTER as NodeShapeEntry, 'builtin');
  addBuiltInShape(SHAPE_PAINTER as NodeShapeEntry, 'builtin');
  addBuiltInShape(IMAGE_PAINTER as NodeShapeEntry, 'builtin');
  addBuiltInShape(PATH_POSE_PAINTER as NodeShapeEntry, 'fallback');
  addBuiltInShape(RECT_FALLBACK_PAINTER as NodeShapeEntry, 'fallback');
});
