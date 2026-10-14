/** The tree of a fake adapter whose nodes never nest: every id in `order` is a root, bottom
 *  first. `setChildOrder` rewrites `order` in place. */
export function rootsTree<TNode extends { id: string } = { id: string }>(
  order: string[] = [],
  nodeOf: (id: string) => TNode | undefined = () => undefined,
) {
  return {
    getNode: nodeOf,
    getParent: (_id: string): string | null => null,
    getChildren: (parentId: string | null): string[] => (parentId === null ? order.slice() : []),
    setChildOrder: (parentId: string | null, ids: string[]): void => {
      if (parentId === null) order.splice(0, order.length, ...ids);
    },
  };
}
