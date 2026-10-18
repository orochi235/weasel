import type { ActiveMode } from '@weasel-js/modes';
import { useMemo } from 'react';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { isSelectedNode } from 'features/paths/pathEditState';
import { usePathEditState, type UsePathEditStateOptions } from 'features/paths/usePathEdit';
import type { SceneCanvasProps } from './props';

/**
 * The canvas's path-edit state, and the select tool options that defer shift-click to it while
 * a path is being anchor-edited.
 */
export function useSceneCanvasPathEdit<TData, TLayer extends string, TPose>(args: {
  host: UsePathEditStateOptions['host'];
  opening: UsePathEditStateOptions['opening'];
  getActiveMode: (() => ActiveMode) | undefined;
  scene: Scene<TData, TLayer, TPose>;
  selection: SelectionApi;
  extensions: UsePathEditStateOptions['extensions'];
  selectTool: SceneCanvasProps<TData, TLayer, TPose>['selectTool'];
}) {
  const { getActiveMode, scene, selection, selectTool } = args;
  // `isAllowed` is absent, not a predicate, when no mode registry is wired: see `PathEditSource.isAllowed`.
  const pathEditState = usePathEditState({
    host: args.host, opening: args.opening,
    isAllowed: getActiveMode
      ? () => getActiveMode().allowedCapabilities.has('edits-anchors')
      : undefined,
    isSelectedNode: (id) => isSelectedNode(scene, selection, id),
    extensions: args.extensions,
  });

  const selectToolWithDefaults = useMemo(() => ({
    // Shift-click belongs to the anchor selection while a path is being
    // anchor-edited; see `UseSelectToolOptions.extendClickLocked`.
    extendClickLocked: () => pathEditState.getEditingId() !== '',
    ...selectTool,
  }), [selectTool, pathEditState]);

  return { pathEditState, selectToolWithDefaults };
}
