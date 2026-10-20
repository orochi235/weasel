import { useMemo } from 'react';
import { createNodeRouting, type NodeRoutingEntry } from 'core/scene/NodeRouting';
import type { NodeId, Scene } from 'core/scene/types';
import { inferredNodeRouting } from './defaultNodeRouting';

export interface NodeKinds<TData> {
  kindOf: ((node: { kind: string; data: TData }) => string) | undefined;
  kindOfNode: ((id: string) => string | undefined) | undefined;
}

/**
 * The canvas's routing-trait classifier, by node data and by node id, so
 * `target: 'kind:text'` on a binding speaks the vocabulary of `Hit.kind`.
 * Unset `routing` falls back to `inferredNodeRouting`. An explicit empty list
 * opts out: both are undefined, every hit is `kind: 'unknown'`, and no
 * `kind:` target form can match.
 */
export function useNodeKinds<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  routing: readonly NodeRoutingEntry[] | undefined,
): NodeKinds<TData> {
  const kindOf = useMemo(() => {
    const effective = routing === undefined ? inferredNodeRouting : routing;
    if (effective.length === 0) return undefined;
    const registry = createNodeRouting();
    for (const k of effective) registry.register(k);
    return (node: { kind: string; data: TData }) => registry.classify(node.data, node);
  }, [routing]);

  const kindOfNode = useMemo(() => {
    if (!kindOf) return undefined;
    return (id: string): string | undefined => {
      const node = scene.get(id as NodeId);
      return node ? kindOf(node) : undefined;
    };
  }, [kindOf, scene]);

  return { kindOf, kindOfNode };
}
