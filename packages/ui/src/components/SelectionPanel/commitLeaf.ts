import { asNodeId, type Scene, type SelectionApi } from '@weasel-js/core';
import { absentValue, nodeValueAt, setAtPath, type AnyNode, type PanelLeaf } from './model';

/**
 * Writes, into every selected node, what `next` derives from the value that
 * node holds at the leaf's path, as one labeled batch.
 */
export function commitLeaf<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  selection: Pick<SelectionApi, 'current'>,
  leaf: PanelLeaf,
  next: (prev: unknown) => unknown,
): void {
  const [head, ...rest] = leaf.path.split('.');
  if (rest.length === 0) return;
  const ids = selection.current.map(asNodeId);
  scene.batch(`Edit ${leaf.leaf.name}`, () => {
    for (const id of ids) {
      const node = scene.get(id);
      if (!node) continue;
      const held = nodeValueAt(node as AnyNode, leaf.path);
      const value = next(held === undefined ? absentValue(leaf.leaf) : held);
      // `setAtPath` spreads plain objects/arrays down the schema path;
      // consumer `pose`/`data` are assumed plain-object-shaped along
      // that path (a class instance's prototype would be dropped by
      // the spread) — the `as TPose`/`as TData` casts below rely on it.
      if (head === 'pose') {
        scene.setPose(id, setAtPath(node.pose as object, rest, value) as TPose);
      } else if (head === 'data') {
        scene.update(id, { data: setAtPath(node.data as object, rest, value) as TData });
      }
    }
  });
}
