import { INHERIT } from '@weasel-js/paint';
import type { Node, NodeId } from 'core/scene/types';
import { inheritedPaintIn, inheritedPaintOf, sceneAncestors, type InheritedPaint } from 'core/scene/inheritedPaint';
import type { SceneViewDrawOne } from './nodeShapeTypes';

/** The part of a scene the lookup reads. */
type ParentLookup<TNode> = { get(id: NodeId): TNode | undefined };

type PaintedNode = { data?: unknown; parent?: NodeId | null };

export { inheritedPaintIn };

const INHERITS_BOTH = { data: { fill: INHERIT, stroke: INHERIT } };

/** What an `'inherit'` fill and stroke on `node` would take from its
 *  containers in `scene`, whatever `node` holds now — what an editor offering
 *  the choice shows it would paint. */
export function paintAbove<TNode extends PaintedNode>(scene: ParentLookup<TNode>, node: TNode): InheritedPaint {
  return inheritedPaintOf(INHERITS_BOTH, sceneAncestors((id: never) => scene.get(id), node));
}

/** {@link inheritedPaintIn} bound to `scene`. */
export function sceneInheritedPaintOf<TNode extends PaintedNode>(
  scene: ParentLookup<TNode>,
): (node: TNode) => InheritedPaint | undefined {
  return (node) => inheritedPaintIn(scene, node);
}

/**
 * Wrap a `drawOne` so a node whose fill or stroke is `'inherit'` arrives at
 * the painter with its containers' paint on `ctx.inherited`, as
 * `withDerivedPaths` does for a derived path. Every other node passes the
 * caller's `ctx` through untouched.
 */
export function withInheritedPaints<TData, TLayer extends string, TPose>(
  scene: ParentLookup<Node<TData, TLayer, TPose>>,
  drawOne: SceneViewDrawOne<TData, TLayer, TPose>,
): SceneViewDrawOne<TData, TLayer, TPose> {
  const inheritedOf = sceneInheritedPaintOf(scene);
  return (node, pose, view, ctx) => {
    const inherited = inheritedOf(node);
    return inherited === undefined ? drawOne(node, pose, view, ctx) : drawOne(node, pose, view, { ...ctx, inherited });
  };
}
