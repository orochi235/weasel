import {
  asNodeId, createDeleteOp, createMoveToIndexOp, createSetDataOp, createSetHiddenOp, createSetLockedOp,
  defaultCommitAdapter, dispatchApplyBatch, isAnnotationLayer, pageName, pageOfNode, pageRunOf, placedPagesOf,
  withoutPageStructure,
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
  /** A row's content for a node: its label, a leading swatch or icon. Its
   *  `visible` and `locked` come from the node's own flags. */
  itemFor: (node: SceneNode<TData, TLayer, TPose>) => Omit<LayerListItem, 'id' | 'children'>;
  /** The data a rename to `label` writes, which makes rows renamable. The
   *  scene has no name of its own, so where one lives is the consumer's call. */
  rename?: (node: SceneNode<TData, TLayer, TPose>, label: string) => TData;
  /** Label of the reorder's history entry. Default `'Reorder'`. */
  label?: string;
  /** Given, each annotation layer (`isAnnotationLayer`) gets a row holding its
   *  nodes, marked not printed: the layer can be hidden and locked, its nodes
   *  picked and removed. Absent, annotations are left out of the list — the canvas still
   *  draws them. */
  annotations?: SceneLayerListAnnotations;
}

/** The `<LayerList>` props `useSceneLayerList` answers. */
export type SceneLayerListProps = Required<Pick<LayerListProps, 'items' | 'selectedIds' | 'onSelectionChange' | 'onReorder' | 'onVisibilityChange' | 'onLockChange'>>
  & Pick<LayerListProps, 'onRemove' | 'onRename'>;

/**
 * The props that put a scene in a `<LayerList>`: a row per node, a container's
 * children nested under it, the front-most at the top, selection read from and
 * written to `selection`, a drag dispatched as a `MoveToIndexOp`, and each
 * row's visibility and lock toggling the node's own (`setHidden` / `setLocked`
 * ops), each one undo step.
 * Annotation layers are left out unless `annotations` says how to show them.
 */
export function useSceneLayerList<TData, TLayer extends string, TPose>(
  args: UseSceneLayerListArgs<TData, TLayer, TPose>,
): SceneLayerListProps {
  const { scene, selection, adapter, itemFor, rename, label = 'Reorder', annotations } = args;
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
  // on it would serve the order from before. The page run lists as what it holds,
  // and a page as a fixed row of what is on it: pages are edited through the page API.
  const run = pageRunOf(scene);
  const pages = new Map(placedPagesOf(scene).map((page) => [page.id, page]));
  const build = (ids: readonly NodeId[], extra: Partial<LayerListItem>): LayerListItem[] =>
    [...ids].reverse().flatMap((id) => {
      const node = scene.get(id);
      if (!node) return [];
      const kids = scene.childrenOf(id);
      if (id === run) return build(kids, extra);
      const children = kids.length > 0 ? { children: build(kids, extra) } : {};
      const page = node.page === undefined ? undefined : pages.get(pageOfNode(scene, id)!);
      if (page !== undefined) return [{ id, label: pageName(page, page.index), fixed: true, ...children }];
      return [{
        ...itemFor(node), ...extra, id, visible: node.hidden !== true, locked: node.locked === true, ...children,
      }];
    });

  // The list's top level holds the run's children and the scene's own roots alike. A drag that stays there
  // keeps its parent; one brought up from inside a container goes to the run, or with the pasteboard on, the root.
  const topParent = (ids: readonly string[]): NodeId | null => {
    const from = scene.get(asNodeId(ids[0]!))?.parent ?? null;
    if (from === null || from === run) return from;
    if (run === null) return null;
    return scene.get(run)!.pageRun!.pasteboard === true ? null : run;
  };

  const content = build(scene.roots.filter((id) => !isAnnotation(id)), annotations ? { removable: false } : {});
  const annotationRows: LayerListItem[] = annotations
    ? [...annotationLayers].reverse().map((layer) => ({
      id: `${ANNOTATION_LAYER_ROW}${layer.id}`,
      label: annotations.labelOf?.(layer.id) ?? layer.id,
      nonPrinting: true,
      visible: layer.visible,
      locked: layer.locked,
      removable: false,
      renamable: false,
      children: build(scene.roots.filter((id) => scene.get(id)?.layer === layer.id), { nonPrinting: true }),
    }))
    : [];
  const picked = annotations?.picked ?? null;

  return {
    items: [...annotationRows, ...content],
    selectedIds: [...selection.current.map(String), ...(picked !== null ? [picked] : [])],
    onSelectionChange: (ids) => {
      const notes = ids.filter(isAnnotation);
      if (notes.length > 0) {
        annotations?.pick(notes.at(-1)!);
        return;
      }
      selection.set([...withoutPageStructure(scene, ids.filter((id) => !id.startsWith(ANNOTATION_LAYER_ROW)).map(asNodeId))]);
    },
    onReorder: ({ ids, parentId, index }) => {
      const parent = parentId ?? topParent(ids);
      const moved = new Set(ids);
      const left = (parent === null ? scene.roots : scene.childrenOf(asNodeId(parent))).filter((id) => !moved.has(id));
      // `index` counts from the front among the rows the drag left behind, the annotation rows heading the top
      // level among them; the content rows stand for the siblings that are not annotations.
      const shown = left.filter((id) => !isAnnotation(id));
      const at = parentId === null ? Math.max(0, index - annotationRows.length) : index;
      const back = Math.max(0, shown.length - at);
      const to = back < shown.length ? left.indexOf(shown[back]!) : shown.length > 0 ? left.indexOf(shown.at(-1)!) + 1 : left.length;
      commit([createMoveToIndexOp({ ids, parentId: parent, index: to })], label);
    },
    onVisibilityChange: (id, visible) => {
      if (id.startsWith(ANNOTATION_LAYER_ROW)) scene.setLayerVisible(id.slice(ANNOTATION_LAYER_ROW.length) as TLayer, visible);
      else commit([createSetHiddenOp({ id, from: scene.get(asNodeId(id))?.hidden === true, to: !visible })], visible ? 'Show' : 'Hide');
    },
    onLockChange: (id, locked) => {
      if (id.startsWith(ANNOTATION_LAYER_ROW)) scene.setLayerLocked(id.slice(ANNOTATION_LAYER_ROW.length) as TLayer, locked);
      else commit([createSetLockedOp({ id, from: scene.get(asNodeId(id))?.locked === true, to: locked })], locked ? 'Lock' : 'Unlock');
    },
    ...(rename ? {
      onRename: (id: string, to: string) => {
        const node = scene.get(asNodeId(id));
        if (node) commit([createSetDataOp({ id, from: node.data, to: rename(node, to) })], 'Rename');
      },
    } : {}),
    ...(annotations ? {
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
