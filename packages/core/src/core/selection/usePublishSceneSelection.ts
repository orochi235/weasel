import { usePublishSelection } from '@weasel-js/routing/react';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { useMemo } from 'react';

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
 *  `<SelectionContextProvider>`. A no-op without one. */
export function usePublishSceneSelection<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get'>,
  ids: readonly NodeId[],
  describe?: (node: Node<TData, TLayer, TPose>) => KindLabel,
): void {
  const kinds = useMemo(() => selectionKindLabels(scene, ids, describe), [scene, ids, describe]);
  usePublishSelection(ids, kinds);
}
