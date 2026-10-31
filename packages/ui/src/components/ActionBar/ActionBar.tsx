import { useMemo } from 'react';
import { taggedActionItems } from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import type { PrefActions, PrefGroup } from '@weasel-js/prefs';
import { Bar } from '../Bar/Bar';
import { BarActions } from '../Bar/BarActions';
import type { Orientation } from '../orientation';
import type { PropertyRenderer } from '../SelectionPanel/renderContext';

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
  orientation?: Orientation;
  /**
   * Per-entry icon overrides, keyed by `ActionItem.key` — the action id, or
   * `id:variant` for one variant of a parametric action. Each names a glyph
   * in the icon registry, as a leaf's `icon` does, and replaces the action's
   * own `icon` for this bar only.
   */
  icons?: Record<string, IconRef>;
  /**
   * Per-entry label overrides, keyed like `icons`. Drives both `aria-label`
   * and `title`. When omitted, the entry's own `label` is used.
   */
  labels?: Record<string, string>;
  /** Only these of the entries `group` or `tag` picks, each an action id — every variant of
   *  it — or an `id:variant` key. Absent, all of them. */
  only?: readonly string[];
  /** Additional class for the toolbar root. */
  className?: string;
}

/**
 * Generic action toolbar: a {@link Bar} over one `actions` leaf for `group`,
 * so it draws one icon button per action in that group — or per variant, for
 * an action that declares `variants` — in registry order. `tag`, `only`,
 * `icons`, and `labels` have no form in a schema, and reach the leaf's
 * buttons as a filter over what it expands to. A button whose action's
 * `enabled` predicate fails greys out and swallows clicks, while the
 * keybinding — if any — still fires through the registry's keydown listener.
 * No keyboard navigation (roving tabindex).
 */
export function ActionBar(props: ActionBarProps) {
  const { group, tag, orientation = 'horizontal', icons, labels, only, className } = props;
  const schema = useMemo((): PrefGroup => {
    const leaf: PrefActions = { kind: 'actions', name: '', description: '', default: undefined, group: group ?? '' };
    return { name: '', children: { actions: leaf } };
  }, [group]);
  const renderers = useMemo((): Record<string, PropertyRenderer> | undefined => {
    if (tag === undefined && !only && !icons && !labels) return undefined;
    const pick = tag === undefined ? undefined : (all: Parameters<typeof taggedActionItems>[0]) => taggedActionItems(all, tag);
    return {
      actions: (ctx) => (
        <BarActions leaf={ctx.pref as PrefActions} path={ctx.path} disabled={ctx.disabled} pick={pick} only={only} icons={icons} labels={labels} />
      ),
    };
  }, [tag, only, icons, labels]);

  return (
    <Bar
      schema={schema}
      renderers={renderers}
      orientation={orientation}
      label={`${tag ?? group} actions`}
      framed="segmented"
      className={className}
    />
  );
}
