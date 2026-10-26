import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { actionItems, useActionsRegistry, type Action } from '@weasel-js/core';
import type { PrefAction, PrefLeaf } from '@weasel-js/prefs';
import { actionShortcutText } from '../actionShortcutText';
import { actionIcon } from '../../icons/actionIcon';
import { childrenOf, undigit, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** An action a schema editor offers to place: one a host has registered, by the key an action pref fires. */
export interface EditorAction {
  /** What an action pref's `action` holds: the action's id, or `id:variant`. */
  key: string;
  label: string;
  /** What the list files it under. */
  group?: string;
  /** Words its filter also finds it by: the action's tags, then its variant's. */
  tags?: readonly string[];
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

/** The pref that fires `action`: plain data, so it exports as written and survives a draft. */
export function actionLeaf(action: EditorAction): PrefLeaf {
  const leaf: PrefAction = { kind: 'action', name: action.label, description: '', default: undefined, action: action.key };
  return leaf;
}

/** A schema key for the pref that fires `key`: its words run together, since a key holds no `.` or `:`, and `_` first where it would start with a digit. */
export function actionLeafKey(key: string): string {
  const words = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return undigit(words.map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1))).join('')) || 'action';
}

/** The tree paths of the action prefs in `root` that fire a key not among `keys`, nor the bare id of one. */
export function deadActionPaths(root: SchemaRoot, keys: ReadonlySet<string>, join: (parent: string | null, key: string) => string): Set<string> {
  const out = new Set<string>();
  // A bare parametric id is drawn as its variants, so a variant key makes its id live too.
  const live = new Set([...keys].flatMap((k) => (k.includes(':') ? [k, k.slice(0, k.indexOf(':'))] : [k])));
  const walk = (node: SchemaNode, path: string | null): void => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const at = join(path, key);
      const fires = (child as { kind?: string; action?: string }).kind === 'action' ? (child as PrefAction).action : undefined;
      if (fires !== undefined && !live.has(fires)) out.add(at);
      walk(child, at);
    }
  };
  walk(root, null);
  return out;
}
