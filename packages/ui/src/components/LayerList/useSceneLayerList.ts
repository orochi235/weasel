import {
  asNodeId, createDeleteOp, createMoveToIndexOp, defaultCommitAdapter, dispatchApplyBatch, isAnnotationLayer,
} from '@weasel-js/core';
import type { NodeId, Op, Scene, SceneNode, SelectionApi } from '@weasel-js/core';
import type { LayerListItem, LayerListProps } from './LayerList';

/** The id prefix of an annotation layer's own row, which holds its nodes. */
export const ANNOTATION_LAYER_ROW = 'annotation-layer:';

/** How a {@link useSceneLayerList} list shows annotation layers. */
export interface SceneLayerListAnnotations {
  /** The picked annotation node, which reads as a selected row. */
  picked: string | null;
  /** Selecting an annotation row picks it; the content selection stays. */
  pick(id: string | null): void;
  /** The row label for annotation layer `layer`. Default: its id. */
  labelOf?(layer: string): string;
}

/** Arguments for {@link useSceneLayerList}. */
export interface UseSceneLayerListArgs<TData, TLayer extends string, TPose> {
  scene: Scene<TData, TLayer, TPose>;
  selection: SelectionApi;
  /** What the reorder op is dispatched against. Default: the scene itself, as one history entry. */
  adapter?: object;
  /** A row's content for a node: its label, a leading swatch or icon, whether it is locked. */
  itemFor: (node: SceneNode<TData, TLayer, TPose>) => Omit<LayerListItem, 'id' | 'children'>;
  /** Label of the reorder's history entry. Default `'Reorder'`. */
  label?: string;
  /** Given, each annotation layer (`isAnnotationLayer`) gets a row holding its
   *  nodes, marked not printed: the layer can be hidden, its nodes picked and
   *  removed. Absent, annotations are left out of the list — the canvas still
   *  draws them. */
  annotations?: SceneLayerListAnnotations;
}

type Props = Required<Pick<LayerListProps, 'items' | 'selectedIds' | 'onSelect' | 'onReorder'>>
  & Pick<LayerListProps, 'onVisibilityChange' | 'onRemove'>;

/**
 * The props that put a scene in a `<LayerList>`: a row per node, a container's
 * children nested under it, the front-most at the top, selection read from and
 * written to `selection`, and a drag dispatched as a `MoveToIndexOp`.
 * Annotation layers are left out unless `annotations` says how to show them.
 */
export function useSceneLayerList<TData, TLayer extends string, TPose>(
  args: UseSceneLayerListArgs<TData, TLayer, TPose>,
): Props {
  const { scene, selection, adapter, itemFor, label = 'Reorder', annotations } = args;
  const annotationLayers = scene.layers.filter(isAnnotationLayer);
  const onAnnotation = new Set<string>(annotationLayers.map((l) => l.id));
  const isAnnotation = (id: string) => {
    const layer = scene.get(asNodeId(id))?.layer;
    return layer !== undefined && onAnnotation.has(layer);
  };
  const commit = (ops: Op[], entry: string) => {
    if (adapter) dispatchApplyBatch(adapter, ops, entry);
    else scene.applyBatch(ops, entry, defaultCommitAdapter(scene, selection.adapterMethods));
  };

  // A scene orders children back to front and the list front to back. Rebuilt
  // every render: the scene keeps its identity across a reorder, so a memo keyed
  // on it would serve the order from before.
  const build = (ids: readonly NodeId[], extra: Partial<LayerListItem>): LayerListItem[] =>
    [...ids].reverse().flatMap((id) => {
      const node = scene.get(id);
      if (!node) return [];
      const kids = scene.childrenOf(id);
      return [{ ...itemFor(node), ...extra, id, ...(kids.length > 0 ? { children: build(kids, extra) } : {}) }];
    });

  const content = build(scene.roots.filter((id) => !isAnnotation(id)), annotations ? { hideable: false, removable: false } : {});
  const annotationRows: LayerListItem[] = annotations
    ? [...annotationLayers].reverse().map((layer) => ({
      id: `${ANNOTATION_LAYER_ROW}${layer.id}`,
      label: annotations.labelOf?.(layer.id) ?? layer.id,
      nonPrinting: true,
      visible: layer.visible,
      locked: layer.locked,
      removable: false,
      children: build(scene.roots.filter((id) => scene.get(id)?.layer === layer.id), { nonPrinting: true, hideable: false }),
    }))
    : [];
  const picked = annotations?.picked ?? null;

  return {
    items: [...annotationRows, ...content],
    selectedIds: [...selection.current.map(String), ...(picked !== null ? [picked] : [])],
    onSelect: (ids) => {
      const notes = ids.filter(isAnnotation);
      if (notes.length > 0) {
        annotations?.pick(notes.at(-1)!);
        return;
      }
      selection.set(ids.filter((id) => !id.startsWith(ANNOTATION_LAYER_ROW)).map(asNodeId));
    },
    onReorder: ({ ids, parentId, index }) => {
      const siblings = parentId === null ? scene.roots : scene.childrenOf(asNodeId(parentId));
      // `index` counts from the front among the siblings the drag left behind.
      const back = siblings.length - ids.length - index;
      commit([createMoveToIndexOp({ ids, parentId, index: Math.max(0, back) })], label);
    },
    ...(annotations ? {
      onVisibilityChange: (id: string, visible: boolean) => {
        if (id.startsWith(ANNOTATION_LAYER_ROW)) scene.setLayerVisible(id.slice(ANNOTATION_LAYER_ROW.length) as TLayer, visible);
      },
      onRemove: (id: string) => {
        const node = scene.get(asNodeId(id));
        if (!node || !isAnnotation(id)) return;
        const siblings = node.parent === null ? scene.roots : scene.childrenOf(node.parent);
        commit([createDeleteOp({ node, index: siblings.indexOf(node.id), label: 'Delete' })], 'Delete');
        if (annotations.picked === id) annotations.pick(null);
      },
    } : {}),
  };
}
