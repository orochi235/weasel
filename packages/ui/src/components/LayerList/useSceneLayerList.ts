import { asNodeId, createMoveToIndexOp, dispatchApplyBatch } from '@weasel-js/core';
import type { NodeId, Scene, SceneNode, SelectionApi } from '@weasel-js/core';
import type { LayerListItem, LayerListProps } from './LayerList';

/** Arguments for {@link useSceneLayerList}. */
export interface UseSceneLayerListArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  selection: SelectionApi;
  /** What the reorder op is dispatched against — the adapter `<SceneCanvas>` uses. */
  adapter: object;
  /** A row's content for a node: its label, a leading swatch or icon, whether it is locked. */
  itemFor: (node: SceneNode<TData, TLayer, TPose>) => Omit<LayerListItem, 'id' | 'children'>;
  /** Label of the reorder's history entry. Default `'Reorder'`. */
  label?: string;
}

/**
 * The props that put a scene in a `<LayerList>`: a row per node, a container's
 * children nested under it, the front-most at the top, selection read from and
 * written to `selection`, and a drag dispatched as a `MoveToIndexOp`.
 */
export function useSceneLayerList<TData, TLayer extends string, TPose>(
  args: UseSceneLayerListArgs<TData, TLayer, TPose>,
): Required<Pick<LayerListProps, 'items' | 'selectedIds' | 'onSelect' | 'onReorder'>> {
  const { scene, selection, adapter, itemFor, label = 'Reorder' } = args;

  // A scene orders children back to front and the list front to back. Rebuilt
  // every render: the scene keeps its identity across a reorder, so a memo keyed
  // on it would serve the order from before.
  const build = (ids: readonly NodeId[]): LayerListItem[] =>
    [...ids].reverse().flatMap((id) => {
      const node = scene.get(id);
      if (!node) return [];
      const kids = scene.childrenOf(id);
      return [{ ...itemFor(node), id, ...(kids.length > 0 ? { children: build(kids) } : {}) }];
    });

  return {
    items: build(scene.roots),
    selectedIds: selection.current.map(String),
    onSelect: (ids) => selection.set(ids.map(asNodeId)),
    onReorder: ({ ids, parentId, index }) => {
      const siblings = parentId === null ? scene.roots : scene.childrenOf(asNodeId(parentId));
      // `index` counts from the front among the siblings the drag left behind.
      const back = siblings.length - ids.length - index;
      dispatchApplyBatch(adapter, [createMoveToIndexOp({ ids, parentId, index: Math.max(0, back) })], label);
    },
  };
}
