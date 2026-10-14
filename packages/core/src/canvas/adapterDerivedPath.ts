/**
 * A derived node's path, resolved through an adapter with no scene in scope.
 *
 * A derivation reads its dependencies' nodes and where they are drawn, and
 * every adapter already answers both by id. Nothing pushes an invalidation
 * here, so freshness is the memo's own re-check of what the adapter answers.
 */
import type { Path } from '@weasel-js/geom';
import { resolveDerivedPath, type PathDerivingNode } from 'core/scene/derivedPath';
import { createNodeMemoScope, type NodeMemoScope } from 'core/scene/nodeMemo';
import type { DerivedDep, Node, NodeId } from 'core/scene/types';

/** What deriving reads of an adapter. */
export interface DerivingAdapter<TPose> {
  getNode(id: string): unknown;
  getPose(id: string): TPose;
  /** Where the node is drawn, when the adapter composes poses. */
  getWorldPose?(id: string): TPose;
  getChildren(parentId: string | null): readonly string[];
}

const scopes = new WeakMap<object, NodeMemoScope>();

/**
 * The path the node `id` computes from its dependencies, or `null` when it
 * derives none. Memoized against `adapter`, so every reader of one adapter
 * shares a route.
 */
export function adapterDerivedPathOf<TPose>(
  adapter: DerivingAdapter<TPose>,
): (id: string) => Path | null {
  let scope = scopes.get(adapter);
  if (scope === undefined) {
    scope = createNodeMemoScope();
    scopes.set(adapter, scope);
  }
  const slot = scope;
  const poseOf = (id: string): TPose =>
    (typeof adapter.getWorldPose === 'function' ? adapter.getWorldPose(id) : adapter.getPose(id));
  const childrenOf = (id: NodeId): readonly NodeId[] =>
    adapter.getChildren(id) as readonly NodeId[];
  const depOf = (id: NodeId): DerivedDep<TPose> | undefined => {
    const node = adapter.getNode(id);
    if (node === undefined || node === null) return undefined;
    return {
      node: node as Node<unknown, string, TPose>,
      pose: poseOf(id),
      get path(): Path | null { return pathOf(id); },
    };
  };
  const pathOf = (id: string): Path | null => {
    const node = adapter.getNode(id) as PathDerivingNode<TPose> | undefined | null;
    if (!node || node.dependsOn === undefined || node.derivePath === undefined) return null;
    return resolveDerivedPath(node, depOf, childrenOf, slot);
  };
  return pathOf;
}
