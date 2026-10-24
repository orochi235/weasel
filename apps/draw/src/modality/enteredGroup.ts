import {
  asNodeId,
  createEnteredGroupScope,
  useEnteredGroup,
  type EnteredGroupApi,
} from '@weasel-js/core';
import type { NodeScope, WorkspaceVisual } from '@weasel-js/modes';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { DrawScene } from '../drawDocument';

/** The workspace tint while a group is entered and no mode has a tint of its own. */
export const ENTERED_GROUP_TINT: WorkspaceVisual = { tint: '#8b5cf6', gradient: 'bottom-up', intensity: 0.12 };

/** Draw's entered group and the ways it shows: the dim and the tint. */
export interface DrawEnteredGroup {
  entered: EnteredGroupApi;
  /** Dims what is outside the entered group; `<SceneCanvas>` already keeps it from taking hits. */
  scope: NodeScope;
  /** `workspaceTintLayer`'s `fallback`. */
  tint: { visual: () => WorkspaceVisual | null; subscribe: (fn: () => void) => () => void };
}

export function useDrawEnteredGroup(scene: DrawScene): DrawEnteredGroup {
  const entered = useEnteredGroup(scene);
  return useMemo(() => ({
    entered,
    scope: createEnteredGroupScope({ entered, scene }),
    tint: { visual: () => (entered.get() === null ? null : ENTERED_GROUP_TINT), subscribe: entered.subscribe },
  }), [entered, scene]);
}

/** What the breadcrumb calls the entered group: its label or its id, or null with none entered. */
export function useEnteredGroupLabel(group: DrawEnteredGroup, scene: DrawScene): string | null {
  const { entered } = group;
  const subscribe = useCallback((fn: () => void) => {
    const offGroup = entered.subscribe(fn);
    const offScene = scene.subscribe(fn);
    return () => { offGroup(); offScene(); };
  }, [entered, scene]);
  const read = useCallback(() => {
    const id = entered.get();
    return id === null ? null : scene.get(asNodeId(id))?.data.label ?? id;
  }, [entered, scene]);
  return useSyncExternalStore(subscribe, read);
}

/**
 * Draw's canvas alpha: nothing for the node whose text is being edited, since the editor draws
 * it, and otherwise the lower of the open mode's dim and the entered group's.
 */
export function canvasAlphaFor(
  scoping: (id: string) => number,
  group: Pick<NodeScope, 'alphaFor'>,
  editingId: string | null,
): (id: string) => number {
  return (id) => (id === editingId ? 0 : Math.min(scoping(id), group.alphaFor(id)));
}
