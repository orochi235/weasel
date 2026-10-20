import { useMemo } from 'react';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { readOnlySelection } from 'core/selection/readOnlySelection';
import { usePublishSceneSelection } from 'core/selection/usePublishSceneSelection';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import type { SceneCanvasProps } from './props';

/**
 * The canvas's selection, published to any surrounding selection context.
 *
 * A caller-supplied api wins, and the one built here is then unused. The
 * built one is bound to the scene, so the selection an edit was made under
 * rides on the scene's history entries and undo can put it back.
 *
 * Everything the kit writes selection through (the `selection` dep, the
 * adapter's `setSelection`, ops committed through either) reads the returned
 * api, so on an unselectable canvas every write path here is closed. The
 * caller's own api is not wrapped and still writes.
 */
export function useCanvasSelection<TData, TLayer extends string, TPose>(args: {
  scene: Scene<TData, TLayer, TPose>;
  props: Pick<SceneCanvasProps<TData, TLayer, TPose>, 'selection' | 'selectionOptions' | 'describeKind'>;
  selectable: boolean;
  /** The canvas's routing kind, published for each node unless `describeKind` is given. */
  kindOf: ((node: { kind: string; data: TData }) => string) | undefined;
}): SelectionApi {
  const { scene, selectable, kindOf } = args;
  const { selection: supplied, selectionOptions: options, describeKind } = args.props;
  const describe = useMemo(() => describeKind ?? (kindOf && ((node: Node<TData, TLayer, TPose>) => {
    const kind = kindOf(node);
    return kind === 'unknown' ? undefined : kind;
  })), [describeKind, kindOf]);
  const derivedOptions = useMemo<UseSelectionOptions>(
    () => ({ scene, ...(options ?? {}) }),
    [scene, options],
  );
  const internal = useSelection(derivedOptions);
  const base = supplied ?? internal;
  const selection = selectable ? base : readOnlySelection(base);
  usePublishSceneSelection(scene, selection.current as readonly NodeId[], describe);
  return selection;
}
