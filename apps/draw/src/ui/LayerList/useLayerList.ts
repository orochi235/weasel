import {
  asNodeId,
  createMoveToIndexOp,
  dispatchApplyBatch,
} from '@weasel-js/core';
import type { SceneNode, Scene, SelectionApi } from '@weasel-js/core';
import type { LayerListItem, LayerListProps } from './LayerList';

export interface UseLayerListArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  selection: SelectionApi;
  /** Adapter to dispatch the reorder op against. Typically the same one
   *  passed to `<SceneCanvas>` / `useSelectTool`. */
  adapter: object;
  /** Per-node mapper to build the row's display content (label, swatch,
   *  locked, etc). Receives the live scene node. */
  itemFor: (node: SceneNode<TData, TLayer, TPose>) => Omit<LayerListItem, 'id'>;
  /** Op label used for the reorder batch. Default `'Reorder'`. */
  label?: string;
}

/**
 * Wires a `Scene` + `SelectionApi` to `<LayerList>`. Returns the four
 * frequently-changing props (`items`, `selectedIds`, `onSelect`,
 * `onReorder`) ready to spread into the component.
 *
 * Handles the bottom-up scene order ↔ top-down layer-list index inversion,
 * and dispatches a `MoveToIndexOp` through the supplied adapter on reorder.
 */
export function useLayerList<TData, TLayer extends string, TPose>(
  args: UseLayerListArgs<TData, TLayer, TPose>,
): Pick<LayerListProps, 'items' | 'selectedIds' | 'onSelect' | 'onReorder'> {
  const { scene, selection, adapter, itemFor, label = 'Reorder' } = args;

  // renderOrder is bottom→top; reverse so index 0 is top of stack. Computed
  // each render — scene's object identity is stable across reorders, so a
  // useMemo keyed on [scene] would serve stale items.
  const order = [...scene.renderOrder()];
  const total = order.length;
  const items: LayerListItem[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const id = order[i];
    const node = scene.get(id);
    if (!node) continue;
    items.push({ id, ...itemFor(node) });
  }

  return {
    items,
    selectedIds: selection.current.map(String),
    onSelect: (ids) => selection.set(ids.map(asNodeId)),
    onReorder: (ids, targetIndex) => {
      // LayerList index is top-down (0 = front); MoveToIndex takes a
      // bottom-up scene index. Convert and clamp.
      const sceneIndex = total - targetIndex - ids.length;
      dispatchApplyBatch(
        adapter,
        [createMoveToIndexOp({ ids, parentId: null, index: Math.max(0, sceneIndex) })],
        label,
      );
    },
  };
}
