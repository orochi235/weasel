import { INHERIT } from '@weasel-js/paint';
import type { Node, NodeId } from 'core/scene/types';
import { inheritedPaintIn, inheritedPaintOf, sceneAncestors, type InheritedPaint } from 'core/scene/inheritedPaint';
import type { SceneViewDrawOne } from './nodeShapeTypes';
import type { PaintBoundsFn } from './paintCull';

export { inheritedPaintIn };

const INHERITS_BOTH = { data: { fill: INHERIT, stroke: INHERIT } };

/** What an `'inherit'` fill and stroke on `node` would take from its
 *  containers in `scene`, whatever `node` holds now — what an editor offering
 *  the choice shows it would paint. */
export function paintAbove<TNode extends { data?: unknown; parent?: NodeId | null }>(scene: { get(id: NodeId): TNode | undefined }, node: TNode): InheritedPaint {
  return inheritedPaintOf(INHERITS_BOTH, sceneAncestors((id: never) => scene.get(id), node));
}

/** {@link inheritedPaintIn} bound to `scene`. */
export function sceneInheritedPaintOf<TNode extends { data?: unknown; parent?: NodeId | null }>(
  scene: { get(id: NodeId): TNode | undefined },
): (node: TNode) => InheritedPaint | undefined {
  return (node) => inheritedPaintIn(scene, node);
}

/**
 * Wrap a `drawOne` so a node whose fill or stroke is `'inherit'` arrives at
 * the painter with its containers' paint on `ctx.inherited`, as
 * `withDerivedPaths` does for a derived path. Every other node, and one whose
 * caller already says what it inherits — a ghost whose containers are mid-edit —
 * passes the caller's `ctx` through untouched.
 */
export function withInheritedPaints<TData, TLayer extends string, TPose>(
  scene: { get(id: NodeId): Node<TData, TLayer, TPose> | undefined },
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const inheritedOf = sceneInheritedPaintOf(scene);
  return (node, pose, view, ctx) => {
    const inherited = ctx?.inherited ?? inheritedOf(node);
    return inherited === undefined ? drawOne(node, pose, view, ctx) : drawOne(node, pose, view, { ...ctx, inherited });
  };
}

/**
 * {@link withInheritedPaints} for a cull's `paintBounds`: a node whose stroke
 * is `'inherit'` is measured with its containers' stroke on `ctx.inherited`,
 * unless its caller already says what it inherits. For a consumer culling its
 * own scene walk with `defaultPaintBounds`, which cannot bound such a node alone.
 */
export function withInheritedPaintBounds<TData, TLayer extends string, TPose>(
  scene: { get(id: NodeId): Node<TData, TLayer, TPose> | undefined },
  paintBounds: PaintBoundsFn<Node<TData, TLayer, TPose>, TPose>,
): PaintBoundsFn<Node<TData, TLayer, TPose>, TPose> {
  const inheritedOf = sceneInheritedPaintOf(scene);
  return (node, pose, view, ctx) => {
    const inherited = ctx?.inherited ?? inheritedOf(node);
    return paintBounds(node, pose, view, inherited === undefined ? ctx : { ...ctx, inherited });
  };
}
