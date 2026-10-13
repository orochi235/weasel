import { usePublishSelection } from '@weasel-js/routing/react';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { useMemo } from 'react';

type KindLabel = string | undefined;

// Not the routing kind: this reads the node and its pose where `NodeRouting.classify` reads
// `data`, and the two disagree on most nodes (`SceneCanvas.selectionKinds.test.tsx`).
function defaultKindLabel(node: Node<unknown, string, unknown>): KindLabel {
  if (node.kind === 'container') return 'group';
  const pose = node.pose as { kind?: unknown } | null;
  if (pose && typeof pose === 'object' && 'kind' in pose && typeof pose.kind === 'string') return 'path';
  return undefined;
}

/** The label published beside each selected id, parallel to `ids`; `undefined` when
 *  nothing is selected. `describeKind` replaces the default for every node. */
export function selectionKindLabels<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get'>,
  ids: readonly NodeId[],
  describeKind?: (node: Node<TData, TLayer, TPose>) => KindLabel,
): readonly KindLabel[] | undefined {
  if (ids.length === 0) return undefined;
  return ids.map((id) => {
    const node = scene.get(id);
    if (!node) return undefined;
    return describeKind ? describeKind(node) : defaultKindLabel(node as Node<unknown, string, unknown>);
  });
}

/** Publishes a scene's selection, with a kind label per id, into any surrounding
 *  `<SelectionContextProvider>`. A no-op without one. */
export function usePublishSceneSelection<TData, TLayer extends string, TPose>(
  scene: Pick<Scene<TData, TLayer, TPose>, 'get'>,
  ids: readonly NodeId[],
  describeKind?: (node: Node<TData, TLayer, TPose>) => KindLabel,
): void {
  const kinds = useMemo(() => selectionKindLabels(scene, ids, describeKind), [scene, ids, describeKind]);
  usePublishSelection(ids, kinds);
}
