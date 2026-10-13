import { useMemo } from 'react';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { readOnlySelection } from 'core/selection/readOnlySelection';
import { usePublishSceneSelection } from 'core/selection/usePublishSceneSelection';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';

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
  /** `<SceneCanvas selection>`. */
  supplied: SelectionApi | undefined;
  options: UseSelectionOptions | undefined;
  selectable: boolean;
  describeKind: ((node: Node<TData, TLayer, TPose>) => string | undefined) | undefined;
}): SelectionApi {
  const { scene, supplied, options, selectable, describeKind } = args;
  const derivedOptions = useMemo<UseSelectionOptions>(
    () => ({ scene, ...(options ?? {}) }),
    [scene, options],
  );
  const internal = useSelection(derivedOptions);
  const base = supplied ?? internal;
  const selection = selectable ? base : readOnlySelection(base);
  usePublishSceneSelection(scene, selection.current as readonly NodeId[], describeKind);
  return selection;
}
