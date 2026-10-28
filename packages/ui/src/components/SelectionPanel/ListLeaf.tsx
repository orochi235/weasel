import type { ReactNode } from 'react';
import type { PrefList } from '@weasel-js/prefs';
import { ListEditor } from '../ListEditor';
import { entriesDisabled, entryConditions, entryDisabledAt } from '../Prefs/entry';
import { PrefTextList, prefListEntry, prefListIsText, prefListTexts } from '../Prefs/ListLeaf';
import { PrefMixed } from '../Prefs/PrefMixed';
import type { PropertyRenderContext } from './renderContext';

/**
 * A `list` leaf across a selection: one control per entry, each drawn as the
 * list's `item` leaf, and every edit commits the whole array to every node.
 * Nodes whose lists differ have no one list to edit, so nothing is offered.
 */
export function ListLeaf({
  ctx,
  drawsStrings,
  renderItem,
}: {
  ctx: PropertyRenderContext;
  /** The panel has a renderer of its own for strings, which then draws each entry. */
  drawsStrings: boolean;
  renderItem: (ctx: PropertyRenderContext, name: string) => ReactNode;
}) {
  const pref = ctx.pref as PrefList;
  const { item } = pref;
  if (ctx.mixed) return <PrefMixed onReplace={ctx.disabled ? undefined : () => ctx.setValue([])} />;
  const shared = {
    'aria-label': item.name || pref.name,
    onChange: ctx.setValue,
    minItems: pref.minItems,
    maxItems: pref.maxItems,
    disabled: ctx.disabled,
  };
  if (prefListIsText(pref, drawsStrings)) {
    const texts = prefListTexts(ctx.value);
    return <PrefTextList {...shared} pref={pref} disabled={entriesDisabled(ctx)} entryDisabled={entryDisabledAt(ctx, item, texts)} value={texts} />;
  }
  return (
    <ListEditor<unknown>
      {...shared}
      value={Array.isArray(ctx.value) ? (ctx.value as unknown[]) : []}
      newEntry={() => item.default}
      renderEntry={(held, set, name, i) => {
        const entry = prefListEntry(pref, held);
        const { item: drawn, ...conditions } = entryConditions(ctx, `${ctx.path}.${i}`, item, entry);
        return renderItem(
          {
            path: `${ctx.path}.${i}`,
            ...(ctx.fields ? { fields: ctx.fields } : {}),
            pref: drawn,
            value: entry,
            mixed: false,
            unset: entry === undefined,
            each: [entry],
            setValue: set,
            update: (fn) => set(fn(entry)),
            valueAt: ctx.valueAt,
            selectionKey: ctx.selectionKey,
            settles: ctx.settles,
            ...conditions,
          },
          name,
        );
      }}
    />
  );
}
