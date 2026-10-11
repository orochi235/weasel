import type { ReactNode } from 'react';
import type { PrefList, PrefString } from '@weasel-js/prefs';
import { ListEditor } from '../ListEditor';
import type { PrefRenderContext, PrefRenderer } from './PrefsRow';

/**
 * Whether a list's entries are plain text, drawn by `ListEditor`'s own fields: with them come Enter to add an
 * entry and Backspace to remove an empty one. `drawn` says the surface has its own renderer for strings.
 */
export function prefListIsText(pref: PrefList, drawn: boolean): boolean {
  return pref.item.kind === 'string' && !drawn && (pref.item as PrefString).control !== 'textarea';
}

/** The entries of a text list as `ListEditor` takes them: anything that is not a string reads as empty. */
export function prefListTexts(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).map((e) => (typeof e === 'string' ? e : ''));
}

/** What an entry of a list reads as: one holding nothing is the item's default, which is what a new entry starts as. */
export function prefListEntry(pref: PrefList, entry: unknown): unknown {
  return entry !== undefined ? entry : pref.item.default;
}

/** A `list` leaf: one control per entry, each drawn as the list's `item` leaf, and every edit commits the whole array. */
export function ListLeaf({
  ctx,
  renderers,
  renderItem,
}: {
  ctx: PrefRenderContext;
  renderers?: Record<string, PrefRenderer>;
  renderItem: (ctx: PrefRenderContext) => ReactNode;
}) {
  const pref = ctx.pref as PrefList;
  const { item } = pref;
  const shared = {
    'aria-label': item.name || pref.name,
    onChange: ctx.setValue,
    minItems: pref.minItems,
    maxItems: pref.maxItems,
    disabled: ctx.disabled,
  };
  const entries = Array.isArray(ctx.value) ? (ctx.value as unknown[]) : [];
  if (prefListIsText(pref, renderers?.string !== undefined)) return <ListEditor {...shared} value={prefListTexts(ctx.value)} />;
  return (
    <ListEditor<unknown>
      {...shared}
      value={entries}
      newEntry={() => item.default}
      renderEntry={(entry, set, name, i) =>
        renderItem({
          path: `${ctx.path}.${i}`,
          pref: { ...item, name },
          value: prefListEntry(pref, entry),
          setValue: set,
          // An entry is not pinned on its own: it shares the state of its list.
          auto: ctx.auto,
          setAuto: ctx.setAuto,
          ...(ctx.fields ? { fields: ctx.fields } : {}),
          disabled: ctx.disabled,
        })
      }
    />
  );
}
