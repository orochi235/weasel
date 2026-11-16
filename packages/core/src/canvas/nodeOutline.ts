/**
 * A node kind's outline as paths: the geometry a node is made of where its silhouette does not
 * carry it — the glyphs a text node sets, whose silhouette is its line boxes. Booleans, Create
 * Outlines, Outline Stroke and the path gestures that convert what they reach read it through
 * {@link NodeShapeEntry.outline}; a kind whose silhouette is its outline declares none.
 */
import type { Path } from '@weasel-js/geom';
import type { PathPaint } from 'canvas/nodeShapes/nodePaint';
import { inheritedPaintIn, type InheritedPaint } from 'core/scene/inheritedPaint';
import type { Node } from 'core/scene/types';
import { findNodeShape } from './NodeShape';
import { evaluationOrder, nodeShapesOf, type NodeShapes } from './nodeShapeRegistry';

/** A world-space path and the paint it is to wear. */
export interface PaintedPath extends PathPaint {
  path: Path;
}

/** One node's outline, read lazily: building it may need something that has not landed, such as
 *  a face's glyph outlines. */
export interface NodeOutline {
  /** Whether any part wears a stroke that covers anything, read without building the outline. */
  readonly stroked: boolean;
  /** The outline as one world-space path, paint ignored; empty when nothing inks. Throws
   *  {@link NodeOutlineError} when it cannot be built. */
  path(): Path;
  /** The outline split by paint, world space, back to front; a paint that inks nothing is left
   *  out. Throws as {@link path} does. */
  parts(): readonly PaintedPath[];
  /** Settles once what {@link path} and {@link parts} read has landed, or failed to. */
  load(): Promise<void>;
}

/** Why a {@link NodeOutline} could not be built. */
export class NodeOutlineError extends Error {
  /** True while what the outline needs is still loading: a later try, after `load()`, may succeed. */
  readonly pending: boolean;
  /** One line for the user: what could not be converted. */
  readonly summary: string;

  constructor(message: string, opts: { summary: string; pending: boolean; cause?: unknown }) {
    super(message, opts.cause === undefined ? undefined : { cause: opts.cause });
    this.name = 'NodeOutlineError';
    this.summary = opts.summary;
    this.pending = opts.pending;
  }
}

/** Per-call context for {@link NodeShapeEntry.outline}. */
export interface NodeOutlineCtx {
  /** What the node's `'inherit'` fill and stroke resolve to; absent for a node inheriting nothing. */
  inherited?: InheritedPaint;
  /** The painters the caller resolves through. Absent, `defaultNodeShapes`. */
  shapes?: NodeShapes;
}

/** The outline `node`'s painter in `ctx.shapes` gives it at `pose`, or `undefined` when it has none. */
export function findNodeOutline<TData, TPose>(
  node: Node<TData, string, TPose>,
  pose: TPose,
  ctx: NodeOutlineCtx = {},
): NodeOutline | undefined {
  return findNodeShape(node, ctx.shapes)?.outline?.(node, pose, ctx) ?? undefined;
}

/** The outline of leaf `id` in `scene` at its own pose, its inherited paint resolved and the
 *  scene's painters asked: what an adapter's `getOutline` answers. */
export function sceneNodeOutline<TData, TLayer extends string, TPose>(
  scene: { get(id: never): Node<TData, TLayer, TPose> | undefined },
  id: string,
): NodeOutline | undefined {
  const node = scene.get(id as never);
  if (!node || node.kind !== 'mark') return undefined;
  const inherited = inheritedPaintIn(scene, node);
  return findNodeOutline(node, node.pose, { shapes: nodeShapesOf(scene), ...(inherited ? { inherited } : {}) });
}

/** The sum of every painter's `geometryGeneration` in `shapes`: a cache of outlines read through
 *  them keys on it, since it moves when any kind's outlines change with no edit to the scene. */
export function geometryGenerationOf(shapes: NodeShapes): number {
  let sum = 0;
  for (const { entry } of evaluationOrder(shapes)) sum += entry.geometryGeneration?.() ?? 0;
  return sum;
}
