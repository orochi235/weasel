import { usePublishSelection } from '@weasel-js/routing/react';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { sameList } from '@weasel-js/registry';
import { useCallback, useRef, useSyncExternalStore } from 'react';

type KindLabel = string | undefined;

/** The label published beside each selected id, parallel to `ids`; `undefined` when
 *  nothing is selected. Without `describe`, every entry is unlabeled. */
export function selectionKindLabels<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get'>,
  ids: readonly NodeId[],
  describe?: (node: Node<TData, TLayer, TPose>) => KindLabel,
): readonly KindLabel[] | undefined {
  if (ids.length === 0) return undefined;
  return ids.map((id) => {
    const node = scene.get(id);
    return node && describe ? describe(node) : undefined;
  });
}

/** Publishes a scene's selection, with a kind label per id, into any surrounding
 *  `<SelectionContextProvider>`. A no-op without one. The labels follow the scene's
 *  edits, so a selected node whose kind an edit changes is relabeled. */
export function usePublishSceneSelection<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get' | 'subscribe'>,
  ids: readonly NodeId[],
  describe?: (node: Node<TData, TLayer, TPose>) => KindLabel,
): void {
  const last = useRef<readonly KindLabel[] | undefined>(undefined);
  const read = useCallback(() => {
    const next = selectionKindLabels(scene, ids, describe);
    if (!next || !last.current || !sameList(next, last.current)) last.current = next;
    return last.current;
  }, [scene, ids, describe]);
  const kinds = useSyncExternalStore(scene.subscribe, read, read);
  usePublishSelection(ids, kinds);
}
