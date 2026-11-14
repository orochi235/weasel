import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { actionItems, useActionsRegistry, type Action } from '@weasel-js/core';
import type { SchemaAction } from '@weasel-js/prefs/edit';
import { actionIcon, actionShortcutText } from '@weasel-js/ui';

/** An action a schema editor offers to place: one a host has registered, by the key an action pref fires. */
export interface EditorAction extends SchemaAction {
  icon?: ReactNode;
  shortcut?: string;
}

const NONE: readonly Action[] = Object.freeze([]);
const noSubscribe = (): (() => void) => () => {};
const none = (): readonly Action[] => NONE;

/**
 * The actions an editor lists: `given`, or else every action the `ActionsRegistry` above it can fire from a button.
 * `null` with neither, where the editor has no way to know which keys exist.
 */
export function useEditorActions(given: readonly EditorAction[] | undefined): readonly EditorAction[] | null {
  const registry = useActionsRegistry();
  const all = useSyncExternalStore(
    registry ? registry.subscribe : noSubscribe,
    registry ? registry.list : none,
    registry ? registry.list : none,
  );
  return useMemo(() => {
    if (given !== undefined) return given;
    if (!registry) return null;
    return all.flatMap(actionItems).map((item) => ({
      key: item.key,
      label: item.label,
      ...(item.action.group !== undefined ? { group: item.action.group } : {}),
      ...(item.tags.length > 0 ? { tags: item.tags } : {}),
      icon: actionIcon(item.icon),
      shortcut: actionShortcutText(item),
    }));
  }, [given, registry, all]);
}
