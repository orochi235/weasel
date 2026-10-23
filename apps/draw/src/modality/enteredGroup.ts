import {
  asNodeId,
  createEnteredGroupScope,
  useEnteredGroup,
  type EnteredGroupDep,
  type EnteredGroupScope,
} from '@weasel-js/core';
import type { WorkspaceVisual } from '@weasel-js/modes';
import { useMemo, useSyncExternalStore } from 'react';
import type { DrawScene } from '../drawDocument';

/** The workspace tint while a group is entered and no mode has a tint of its own. */
export const ENTERED_GROUP_TINT: WorkspaceVisual = { tint: '#8b5cf6', gradient: 'bottom-up', intensity: 0.12 };

/** Draw's entered group and the ways it shows: the dim, the tint, and the breadcrumb's exit. */
export interface DrawEnteredGroup {
  entered: EnteredGroupDep;
  /** Dims what is outside the entered group; `<SceneCanvas>` already keeps it from taking hits. */
  scope: EnteredGroupScope;
  /** `workspaceTintLayer`'s `fallback`. */
  tint: { visual: () => WorkspaceVisual | null; subscribe: (fn: () => void) => () => void };
  /** Leaves every entered group. */
  leaveAll: () => void;
}

export function useDrawEnteredGroup(scene: DrawScene): DrawEnteredGroup {
  const entered = useEnteredGroup(scene);
  return useMemo(() => ({
    entered,
    scope: createEnteredGroupScope({ entered, scene }),
    tint: { visual: () => (entered.get() === null ? null : ENTERED_GROUP_TINT), subscribe: entered.subscribe },
    leaveAll: () => {
      for (let id = entered.get(); id !== null; id = entered.get()) {
        entered.leave();
        if (entered.get() === id) return;
      }
    },
  }), [entered, scene]);
}

/** What the breadcrumb calls the entered group: its label or its id, or null with none entered. */
export function useEnteredGroupLabel(group: DrawEnteredGroup, scene: DrawScene): string | null {
  const id = useSyncExternalStore(group.entered.subscribe, group.entered.get);
  if (id === null) return null;
  return scene.get(asNodeId(id))?.data.label ?? id;
}

/**
 * Draw's canvas alpha: nothing for the node whose text is being edited, since the editor draws
 * it, and otherwise the lower of the open mode's dim and the entered group's.
 */
export function canvasAlphaFor(
  scoping: (id: string) => number,
  group: Pick<EnteredGroupScope, 'alphaFor'>,
  editingId: string | null,
): (id: string) => number {
  return (id) => (id === editingId ? 0 : Math.min(scoping(id), group.alphaFor(id)));
}
