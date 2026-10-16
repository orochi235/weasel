import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  actionItems,
  actionShortcuts,
  useActionsRegistry,
  type Action,
  type ActionItem,
} from '@weasel-js/core';
import type { PrefAction } from '@weasel-js/prefs';
import { namedGlyph } from '../../icons/namedGlyph';
import { actionIcon } from '../../icons/actionIcon';
import { formatShortcut } from '../ToolPalette/formatShortcut';
import { useActionStates } from '../ActionBar/useActionStates';

/** What an action leaf's button is and does, on whatever surface draws it. */
export interface LeafAction {
  press: () => void;
  label: string;
  icon: ReactNode;
  /** The keys that fire it, for a tooltip. */
  shortcut: string | undefined;
  /** It cannot be pressed now: the action says so, a `run` is still going, or the leaf is disabled. */
  disabled: boolean;
  /** Held down. `undefined` for an action with no pressed state. */
  active: boolean | undefined;
  /** The key the leaf names, where nothing registered answers to it. */
  missing: string | undefined;
}

const NONE: readonly Action[] = Object.freeze([]);
const noSubscribe = (): (() => void) => () => {};
const none = (): readonly Action[] => NONE;
const NO_ITEMS: readonly ActionItem[] = Object.freeze([]);

/**
 * An action leaf as a button: what pressing it does, and what it shows.
 *
 * A leaf naming an `action` fires that key on the `ActionsRegistry` above,
 * and takes the registered action's icon and shortcut where it has none of
 * its own. With no registry above, or a key the registry does not hold, the
 * button is dead and `missing` says which key. A leaf with only `run` calls
 * it, and is disabled while a promise it returned is pending. `disabled` is
 * the leaf's own state on its surface: a failed `enableIf`.
 */
export function useLeafAction(leaf: PrefAction, path: string, disabled = false): LeafAction {
  const registry = useActionsRegistry();
  const all = useSyncExternalStore(
    registry ? registry.subscribe : noSubscribe,
    registry ? registry.list : none,
    registry ? registry.list : none,
  );
  const key = leaf.action;
  const item = key === undefined ? undefined : all.flatMap(actionItems).find((i) => i.key === key);

  const shown = useActionStates(item ? [item] : NO_ITEMS)[0] ?? { enabled: true, active: undefined };

  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const label = leaf.label ?? (leaf.name !== '' ? leaf.name : (item?.label ?? ''));
  const icon = namedGlyph(leaf.icon, 16) ?? (item ? actionIcon(item.icon) : undefined);

  if (key !== undefined) {
    return {
      press: () => {
        if (item) registry?.trigger(item.action.id, item.params);
      },
      label,
      icon,
      shortcut: item ? (item.action.shortcut ?? formatShortcut(actionShortcuts(item.action, item.params)[0])) : undefined,
      disabled: disabled || (item !== undefined && !shown.enabled),
      active: shown.active,
      missing: item ? undefined : key,
    };
  }
  return {
    press: () => {
      // A schema that has been through JSON, as a schema editor's saved draft has, comes back without `run`.
      const out = leaf.run?.({ path });
      if (typeof out?.then !== 'function') return;
      setPending(true);
      void out.finally(() => {
        if (mounted.current) setPending(false);
      });
    },
    label,
    icon,
    shortcut: undefined,
    disabled: disabled || pending,
    active: undefined,
    missing: undefined,
  };
}
