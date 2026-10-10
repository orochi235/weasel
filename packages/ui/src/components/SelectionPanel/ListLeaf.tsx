import type { ReactNode } from 'react';
import type { PrefList } from '@weasel-js/prefs';
import { ListEditor } from '../ListEditor';
import type { PropertyRenderContext } from './renderLeaf';
import s from './SelectionPanel.module.css';

/**
 * A `list` leaf across a selection: one control per entry, each drawn as the
 * list's `item` leaf, and every edit commits the whole array to every node.
 * Nodes whose lists differ have no one list to edit, so nothing is offered.
 */
export function ListLeaf({
  ctx,
  renderItem,
}: {
  ctx: PropertyRenderContext;
  renderItem: (ctx: PropertyRenderContext, name: string) => ReactNode;
}) {
  const pref = ctx.pref as PrefList;
  const { item } = pref;
  if (ctx.mixed) return <span className={s.unrenderable}>Mixed</span>;
  return (
    <ListEditor<unknown>
      aria-label={item.name || pref.name}
      value={Array.isArray(ctx.value) ? (ctx.value as unknown[]) : []}
      onChange={ctx.setValue}
      minItems={pref.minItems}
      maxItems={pref.maxItems}
      newEntry={() => item.default}
      renderEntry={(entry, set, name, i) =>
        renderItem(
          {
            path: `${ctx.path}.${i}`,
            ...(ctx.fields ? { fields: ctx.fields } : {}),
            pref: item,
            value: entry,
            mixed: false,
            unset: entry === undefined,
            each: [entry],
            setValue: set,
            update: (fn) => set(fn(entry)),
            valueAt: ctx.valueAt,
            selectionKey: ctx.selectionKey,
          },
          name,
        )
      }
    />
  );
}
