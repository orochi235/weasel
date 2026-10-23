/** The scene's reads of one node and its place in the tree. */
import type { Node, NodeId, Scene } from './types';

export function createTreeReads<TData, TLayer extends string, TPose>(
  nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>,
): Pick<Scene<TData, TLayer, TPose>, 'get' | 'incarnation' | 'childrenOf' | 'ancestorsOf'> {
  // Keyed by node object: every entry into `nodes` is a fresh object and
  // every edit mutates it in place, which is exactly an incarnation's lifetime.
  const incarnations = new WeakMap<object, number>();
  let nextIncarnation = 1;

  return {
    get: (id) => nodes.get(id),

    incarnation(id) {
      const node = nodes.get(id);
      if (!node) return undefined;
      let token = incarnations.get(node);
      if (token === undefined) {
        token = nextIncarnation++;
        incarnations.set(node, token);
      }
      return token;
    },

    childrenOf(id) {
      const n = nodes.get(id);
      return n?.children ?? [];
    },

    ancestorsOf(id) {
      const out: NodeId[] = [];
      let cur = nodes.get(id)?.parent ?? null;
      while (cur !== null) {
        out.push(cur);
        cur = nodes.get(cur)?.parent ?? null;
      }
      return out;
    },
  };
}
