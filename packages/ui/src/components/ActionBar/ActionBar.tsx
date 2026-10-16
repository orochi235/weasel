import { useMemo, useSyncExternalStore } from 'react';
import { useActionsRegistry, actionItems, taggedActionItems, type Action } from '@weasel-js/core';
import type { PrefAction, PrefGroup } from '@weasel-js/prefs';
import { Bar } from '../Bar/Bar';
import s from './ActionBar.module.css';

const EMPTY_LIST: readonly Action[] = Object.freeze([]);
const noopSubscribe = (): (() => void) => () => {};

/** Which actions an {@link ActionBar} draws: one group's, or every one carrying a tag. */
export type ActionBarSource =
  | {
    /** Group key — only actions with `action.group === group` are rendered. */
    group: string;
    tag?: never;
  }
  | {
    /** Only the entries carrying this tag are rendered, from any group: an
     *  action's own, or one variant's. See `taggedActionItems`. */
    tag: string;
    group?: never;
  };

/** Props for {@link ActionBar}. */
export type ActionBarProps = ActionBarSource & ActionBarOptions;

/** What an {@link ActionBar} takes besides its {@link ActionBarSource}. */
export interface ActionBarOptions {
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
 * Generic action toolbar. Reads the parent `ActionsRegistry`, filters to
 * actions whose `group` matches `props.group` — or to the entries carrying
 * `props.tag` — and draws them as a
 * {@link Bar} of `action` leaves: one icon button per match — or per variant,
 * for an action that declares `variants`. A button whose action's `enabled`
 * predicate fails greys out and swallows clicks, while the keybinding — if
 * any — still fires through the registry's keydown listener. No keyboard
 * navigation (roving tabindex).
 */
export function ActionBar(props: ActionBarProps) {
  const { group, tag, orientation = 'horizontal', icons, labels, className } = props;
  const registry = useActionsRegistry();
  const all = useSyncExternalStore(
    registry ? registry.subscribe : noopSubscribe,
    registry ? registry.list : () => EMPTY_LIST,
    registry ? registry.list : () => EMPTY_LIST,
  );
  const schema = useMemo((): PrefGroup => {
    const items = tag !== undefined ? taggedActionItems(all, tag) : all.filter((a) => a.group === group).flatMap(actionItems);
    const keys = items.map((item) => item.key);
    const leaf = (key: string): PrefAction => {
      const icon = icons?.[key];
      return {
        kind: 'action',
        // Empty, the button reads the registered action's own label.
        name: labels?.[key] ?? '',
        description: '',
        default: undefined,
        action: key,
        ...(icon === undefined ? {} : { icon }),
      };
    };
    // An action's key may hold a dot, which a schema key may not, and a key that reads as an index would sort first.
    return { name: '', children: Object.fromEntries(keys.map((key, i) => [`action${i}`, leaf(key)])) };
  }, [all, group, tag, icons, labels]);

  return (
    <Bar
      schema={schema}
      orientation={orientation}
      label={`${tag ?? group} actions`}
      className={[s.bar, className].filter(Boolean).join(' ')}
    />
  );
}
