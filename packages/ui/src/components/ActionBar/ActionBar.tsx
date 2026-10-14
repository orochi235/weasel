import { useMemo, useSyncExternalStore } from 'react';
import { useActionsRegistry, actionItems, type Action } from '@weasel-js/core';
import type { PrefAction, PrefGroup } from '@weasel-js/prefs';
import { Bar } from '../Bar/Bar';
import s from './ActionBar.module.css';

const EMPTY_LIST: readonly Action[] = Object.freeze([]);
const noopSubscribe = (): (() => void) => () => {};

/** Props for {@link ActionBar}. */
export interface ActionBarProps {
  /** Group key — only actions with `action.group === group` are rendered. */
  group: string;
  /** Layout direction. Defaults to `'horizontal'`. */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Per-entry icon overrides, keyed by `ActionItem.key` — the action id, or
   * `id:variant` for one variant of a parametric action. Each names a glyph
   * in the kit's icon set, as a leaf's `icon` does, and replaces the action's
   * own `icon` for this bar only. A name the set lacks leaves the action's.
   */
  icons?: Record<string, string>;
  /**
   * Per-entry label overrides, keyed like `icons`. Drives both `aria-label`
   * and `title`. When omitted, the entry's own `label` is used.
   */
  labels?: Record<string, string>;
  /** Additional class for the toolbar root. */
  className?: string;
}

/**
 * Generic group-keyed action toolbar. Reads the parent `ActionsRegistry`,
 * filters to actions whose `group` matches `props.group`, and draws them as a
 * {@link Bar} of `action` leaves: one icon button per match — or per variant,
 * for an action that declares `variants`. A button whose action's `enabled`
 * predicate fails greys out and swallows clicks, while the keybinding — if
 * any — still fires through the registry's keydown listener. No keyboard
 * navigation (roving tabindex).
 */
export function ActionBar(props: ActionBarProps) {
  const { group, orientation = 'horizontal', icons, labels, className } = props;
  const registry = useActionsRegistry();
  const all = useSyncExternalStore(
    registry ? registry.subscribe : noopSubscribe,
    registry ? registry.list : () => EMPTY_LIST,
    registry ? registry.list : () => EMPTY_LIST,
  );
  const schema = useMemo((): PrefGroup => {
    const keys = all.filter((a) => a.group === group).flatMap(actionItems).map((item) => item.key);
    const leaf = (key: string): PrefAction => ({
      kind: 'action',
      // Empty, the button reads the registered action's own label.
      name: labels?.[key] ?? '',
      description: '',
      default: undefined,
      action: key,
      ...(icons?.[key] === undefined ? {} : { icon: icons[key] }),
    });
    // An action's key may hold a dot, which a schema key may not, and a key that reads as an index would sort first.
    return { name: '', children: Object.fromEntries(keys.map((key, i) => [`action${i}`, leaf(key)])) };
  }, [all, group, icons, labels]);

  return (
    <Bar
      schema={schema}
      orientation={orientation}
      label={`${group} actions`}
      className={[s.bar, className].filter(Boolean).join(' ')}
    />
  );
}
