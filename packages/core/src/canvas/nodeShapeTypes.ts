/** The types a node painter is written against; `NodeShape.ts` holds the registry. */
import type { Path } from '@weasel-js/geom';
import type { VertexColorChannel } from '@weasel-js/animator';
import type { DrawCommand } from '@weasel-js/renderer';
import type { Node } from 'core/scene/types';
import type { InheritedPaint } from 'core/scene/inheritedPaint';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { View } from 'core/viewport/view';

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
  /** What the node's `'inherit'` fill and stroke resolve to, looked up from
   *  its containers by the scene's `drawOne` wrapper. **Absent** for a node
   *  that inherits nothing. Hand it to `resolveFill` / `resolveStroke`. */
  inherited?: InheritedPaint;
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
   *  `ctx.scale` carries the view scale; a reach measured on screen, such as
   *  a `{ px }` stroke's, is reported in `outsetPx`, never in `outset`. */
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
  /** Optional: the tight box `paint` covers, stroke as drawn, in `bounds`'
   *  frame; what `drawnBoundsOf` puts the selection chrome on. Not
   *  conservative, unlike `bounds`. Absent or `null` is the pose box. */
  drawnBounds?(node: Node<TData, string, TPose>, pose: TPose, ctx?: NodeInkCtx): Bounds | null;
  /** Snap to the node's pose box — its edges, corners and center — rather
   *  than its silhouette. For content whose silhouette is no drawn outline,
   *  as text's line boxes and an image's pixels are not. */
  snapsToBox?: boolean;
}

/** How a painter inks its silhouette. See {@link NodeShapeEntry.ink}.
 *
 *  Reach is per-side because `align` decides which side the ribbon lands on:
 *  a centered stroke straddles the outline, `'inner'` puts nothing outside it,
 *  `'outer'` nothing inside. */
export interface NodeInk {
  /** True when the silhouette's interior is painted, and so grabbable. */
  filled: boolean;
  /** How far the ink reaches outside the outline. World units, independent of
   *  the view: a reach measured on screen goes in `outsetPx`. Pick indexes box
   *  nodes once for every zoom, so an `outset` that changes with `scale` goes
   *  unpicked. */
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
  /** View scale, for resolving `{ px }` lengths, which `ink` reports in
   *  `outsetPx`/`insetPx`, never folded into `outset`. The mean of the two
   *  axes' under non-uniform zoom. */
  scale?: number;
  /** The smaller axis's scale, where it differs from `scale`. A box bounding
   *  a `{ px }` stroke reads its reach here, where a pixel is the most world. */
  leastScale?: number;
  /** The linear map from the frame `drawnBounds` answers in to screen pixels,
   *  `[a, b, c, d]` in `Affine` order: the view's scale times the pose's
   *  rotation and `transform`. With it, a `{ px }` length is measured the way
   *  the renderer builds it, exact in every direction; without, at `scale`. */
  screen?: readonly [number, number, number, number];
  /** The path the node shows in place of its pose's, already where it is
   *  drawn: its box is measured from this, not from the placeholder pose. */
  derivedPath?: Path | null;
  /** As {@link NodePaintCtx.inherited}: a stroke or fill the node inherits
   *  inks it as its own does. */
  inherited?: InheritedPaint;
}
