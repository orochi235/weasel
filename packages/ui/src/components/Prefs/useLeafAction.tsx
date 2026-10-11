import { useEffect, useLayoutEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  actionItems,
  actionShortcuts,
  buildDepsFromRequires,
  evaluateActive,
  evaluateEnabled,
  useActionsRegistry,
  useOptionalDepRegistry,
  type Action,
  type ActionItem,
} from '@weasel-js/core';
import type { PrefAction } from '@weasel-js/prefs';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import { formatShortcut } from '../ToolPalette/formatShortcut';

/** What an action leaf's button is and does, on whatever surface draws it. */
export interface LeafAction {
  press: () => void;
  label: string;
  icon: ReactNode;
  /** The keys that fire it, for a tooltip. */
  shortcut: string | undefined;
  /** It cannot be pressed now: the action says so, or a `run` is still going. */
  disabled: boolean;
  /** Held down. `undefined` for an action with no pressed state. */
  active: boolean | undefined;
  /** The key the leaf names, where nothing registered answers to it. */
  missing: string | undefined;
}

const NONE: readonly Action[] = Object.freeze([]);
const noSubscribe = (): (() => void) => () => {};
const none = (): readonly Action[] => NONE;

/**
 * An action leaf as a button: what pressing it does, and what it shows.
 *
 * A leaf naming an `action` fires that key on the `ActionsRegistry` above,
 * and takes the registered action's icon and shortcut where it has none of
 * its own. With no registry above, or a key the registry does not hold, the
 * button is dead and `missing` says which key. A leaf with only `run` calls
 * it, and is disabled while a promise it returned is pending.
 */
export function useLeafAction(leaf: PrefAction, path: string): LeafAction {
  const registry = useActionsRegistry();
  const depReg = useOptionalDepRegistry();
  const all = useSyncExternalStore(
    registry ? registry.subscribe : noSubscribe,
    registry ? registry.list : none,
    registry ? registry.list : none,
  );
  const key = leaf.action;
  const item = key === undefined ? undefined : all.flatMap(actionItems).find((i) => i.key === key);

  const read = (): { enabled: boolean; active: boolean | undefined } => {
    if (!item) return { enabled: true, active: undefined };
    const deps = depReg ? buildDepsFromRequires(item.action, depReg) : undefined;
    return { enabled: evaluateEnabled(item.action, deps).enabled, active: evaluateActive(item.action, deps) };
  };
  // Dep sources publish on commit, so a render reads the previous commit's
  // deps. Once this one commits, re-render if what they say now differs.
  const shown = read();
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => {
    const now = read();
    if (now.enabled !== shown.enabled || now.active !== shown.active) recheck();
  });

  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const label = leaf.label ?? (leaf.name !== '' ? leaf.name : (item?.label ?? ''));
  const icon = leafGlyph(leaf) ?? (item ? itemIcon(item) : undefined);

  if (key !== undefined) {
    return {
      press: () => {
        if (item) registry?.trigger(item.action.id, item.params);
      },
      label,
      icon,
      shortcut: item ? (item.action.shortcut ?? formatShortcut(actionShortcuts(item.action, item.params)[0])) : undefined,
      disabled: item !== undefined && !shown.enabled,
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
    disabled: pending,
    active: undefined,
    missing: undefined,
  };
}

function leafGlyph(leaf: PrefAction): ReactNode {
  return leaf.icon && leaf.icon in ICON_PATHS ? <Icon name={leaf.icon as IconName} size={16} /> : undefined;
}

function itemIcon(item: ActionItem): ReactNode {
  return typeof item.icon === 'function' ? item.icon() : item.icon;
}
