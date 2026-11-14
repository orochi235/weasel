import type { ReactNode } from 'react';
import { prefLeafValue, type PrefList, type PrefString } from '@weasel-js/prefs';
import { ListEditor, type ListEditorProps } from '../ListEditor';
import { TokenField } from '../TokenField';
import { entriesDisabled, entryDisabledAt } from './entry';
import type { LeafContext } from './renderContext';
import { entryContext } from './renderLeaf';

/**
 * Whether a list's entries are plain text, drawn by {@link PrefTextList} as `ListEditor`'s own fields or as
 * `TokenField`'s chips. `drawn` says the surface has its own renderer for strings.
 */
export function prefListIsText(pref: PrefList, drawn: boolean): boolean {
  return pref.item.kind === 'string' && !drawn && (pref.item as PrefString).control !== 'textarea';
}

/** The entries of a text list as `ListEditor` takes them: anything that is not a string reads as empty. */
export function prefListTexts(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).map((e) => (typeof e === 'string' ? e : ''));
}

/** Props for {@link PrefTextList}: a text list's entries and limits, as `ListEditor` takes them. */
export type PrefTextListProps = Pick<
  ListEditorProps<string>,
  'value' | 'onChange' | 'minItems' | 'maxItems' | 'placeholder' | 'disabled' | 'entryDisabled' | 'aria-label'
> & { pref: PrefList };

/** A text list's control: a field per entry, or a chip per entry where the list's `control` is `tokens`. */
export function PrefTextList({ pref, entryDisabled, ...props }: PrefTextListProps) {
  if (pref.control === 'tokens') return <TokenField {...props} reorder locked={entryDisabled} />;
  return <ListEditor {...props} entryDisabled={entryDisabled} />;
}

/** What an entry of a list reads as: one holding nothing is the item's default, which is what a new entry starts as. */
export function prefListEntry(pref: PrefList, entry: unknown): unknown {
  return prefLeafValue(pref.item, entry);
}

/**
 * A `list` leaf: one control per entry, each drawn as the list's `item` leaf, and every edit commits the whole
 * array to every target. Targets whose lists differ are drawn mixed before this is reached.
 */
export function ListLeaf({
  ctx,
  drawsStrings,
  renderItem,
}: {
  ctx: LeafContext;
  /** The surface has a renderer of its own for strings, which then draws each entry. */
  drawsStrings: boolean;
  renderItem: (ctx: LeafContext) => ReactNode;
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
  if (prefListIsText(pref, drawsStrings)) {
    const texts = prefListTexts(ctx.value);
    return <PrefTextList {...shared} pref={pref} disabled={entriesDisabled(ctx)} entryDisabled={entryDisabledAt(ctx, item, texts)} value={texts} />;
  }
  return (
    <ListEditor<unknown>
      {...shared}
      value={Array.isArray(ctx.value) ? (ctx.value as unknown[]) : []}
      newEntry={() => item.default}
      // An entry is not pinned on its own: it shares the auto state of its list.
      renderEntry={(entry, set, name, i) => renderItem(entryContext(ctx, i, item, prefListEntry(pref, entry), set, name))}
    />
  );
}
