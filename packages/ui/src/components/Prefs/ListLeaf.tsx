import type { ReactNode } from 'react';
import type { PrefList, PrefString } from '@weasel-js/prefs';
import { ListEditor } from '../ListEditor';
import type { PrefRenderContext, PrefRenderer } from './PrefsRow';

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
  };
  const entries = Array.isArray(ctx.value) ? (ctx.value as unknown[]) : [];
  // Plain text entries keep the editor's own fields, and with them Enter to add and Backspace to remove.
  if (item.kind === 'string' && !renderers?.string && (item as PrefString).control !== 'textarea')
    return <ListEditor {...shared} value={entries.map((e) => (typeof e === 'string' ? e : ''))} />;
  return (
    <ListEditor<unknown>
      {...shared}
      value={entries}
      newEntry={() => item.default}
      renderEntry={(entry, set, name, i) =>
        renderItem({
          path: `${ctx.path}.${i}`,
          pref: { ...item, name },
          value: entry !== undefined ? entry : item.default,
          setValue: set,
          // An entry is not pinned on its own: it shares the state of its list.
          auto: ctx.auto,
          setAuto: ctx.setAuto,
          ...(ctx.fields ? { fields: ctx.fields } : {}),
        })
      }
    />
  );
}
