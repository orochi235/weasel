import { useEffect, useRef, useState, type ReactNode } from 'react';
import { actionItems, actionShortcuts, useActionsRegistry, type ActionItem } from '@weasel-js/core';
import type { PrefAction } from '@weasel-js/prefs';
import { resolveIcon } from '../../icons/resolveIcon';
import { actionIcon } from '../../icons/actionIcon';
import { formatShortcut } from '@weasel-js/gestures';
import { useActionStates } from '../ActionBar/useActionStates';
import { DEFAULT_REASON_LABELS } from '../ActionBar/reasonLabels';
import { useRegisteredActions } from './registeredActions';

/** What an action leaf's button is and does, on whatever surface draws it. */
export interface LeafAction {
  press: () => void;
  label: string;
  icon: ReactNode;
  /** The keys that fire it, for a tooltip. */
  shortcut: string | undefined;
  /** It cannot be pressed now: the action says so, a `run` is still going, or the leaf is disabled. */
  disabled: boolean;
  /** Why the action says it cannot run, in words, when it says. */
  reason: string | undefined;
  /** Held down. `undefined` for an action with no pressed state. */
  active: boolean | undefined;
  /** The key the leaf names, where nothing registered answers to it. */
  missing: string | undefined;
  /** Show what pressing would do; absent for an action with no `preview`. */
  preview?: () => () => void;
}

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
  const all = useRegisteredActions();
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
  const icon = resolveIcon(leaf.icon, 16) ?? (item ? actionIcon(item.icon) : undefined);

  if (key !== undefined) {
    return {
      press: () => {
        if (item) registry?.trigger(item.action.id, item.params);
      },
      label,
      icon,
      shortcut: item ? (item.action.shortcut ?? formatShortcut(actionShortcuts(item.action, item.params)[0])) : undefined,
      disabled: disabled || (item !== undefined && !shown.enabled),
      reason: item && !shown.enabled && shown.reason !== undefined ? (DEFAULT_REASON_LABELS[shown.reason] ?? shown.reason) : undefined,
      active: shown.active,
      missing: item ? undefined : key,
      ...(item?.action.preview && registry
        ? { preview: () => registry.preview(item.action.id, item.params) }
        : {}),
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
    reason: undefined,
    active: undefined,
    missing: undefined,
  };
}
