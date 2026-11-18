/** The renderers for the attributes pane's own rows: the name, the key, the kind pickers and a condition's editor. */
import { imeKey } from '@weasel-js/ui-input';
import type { PrefCondition, PrefList, PrefMap } from '@weasel-js/prefs';
import { Input, type LeafRenderer, Select } from '@weasel-js/ui';
import { conditionGroupAt, entryHolderAt, type KindChoice, type SchemaRoot } from '@weasel-js/prefs/edit';
import { PrefConditionEditor } from '../PrefConditionEditor/PrefConditionEditor';
import { ENTRY } from './attributeForm';
import s from './PrefSchemaEditor.module.css';

/**
 * Draws a `showIf` or an `enableIf` as its editor. `holder` is the selected list or map: the condition of its
 * entry may read the entry's own fields, where the node's own reads the schema's. A node at one of `targets` that is
 * a field of an entry may read that entry's other fields, where every target is a field of the same one.
 */
export function conditionRenderer(schema: SchemaRoot, exclude: readonly string[], holder: PrefList | PrefMap | undefined, targets: ReadonlyArray<string | null>, over: SchemaRoot | undefined): LeafRenderer {
  const holders = targets.map((p) => entryHolderAt(schema, p));
  const within = holders.every((h) => h === holders[0]) ? holders[0] : undefined;
  const groups = targets.map((p) => conditionGroupAt(schema, p));
  const group = groups.every((g) => g === groups[0]) ? groups[0] : undefined;
  return Object.assign<LeafRenderer, { group: boolean; wide: boolean }>(({ path, pref, value, setValue }) => {
    const ofEntry = path.startsWith(`${ENTRY}.`);
    const entryOf = ofEntry ? holder : within;
    return (
      <PrefConditionEditor aria-label={ofEntry ? `Entry ${pref.name.toLowerCase()}` : pref.name} schema={schema} over={over} exclude={exclude}
        entryOf={entryOf} group={group} value={value as PrefCondition | undefined} onChange={setValue} />
    );
  }, { group: true, wide: true });
}

/** The name's field; `onBlur` runs when it loses focus. */
export const nameRenderer = (onBlur: (() => void) | undefined): LeafRenderer => ({ value, mixed, setValue }) => (
  <Input aria-label="Name" value={String(value ?? '')} mixed={mixed} onChange={setValue} onBlur={onBlur} />
);

/** The key's field, holding the key typed so far: `commit` takes it on blur and on Enter. */
export const keyRenderer = (draft: { key: string; setKey(key: string): void; error: string | null }, commit: () => void): LeafRenderer => () => (
  <Input aria-label="Key" className={s.symbol} value={draft.key} onChange={draft.setKey} onBlur={commit}
    onKeyDown={(e) => { if (e.key === 'Enter' && !imeKey(e.nativeEvent)) commit(); }} errorMessage={draft.error ?? undefined} invalid={draft.error !== null} />
);

/** A kind picker named `label`, on `selected` among `options` and mixed on `null`; draws nothing without options. */
export const kindPickerRenderer = (label: string, selected: string | null, options: readonly KindChoice[] | null, onPick: (kind: string) => void): LeafRenderer => () => options && (
  <Select aria-label={label} selectedKey={selected} mixed={selected === null} options={options}
    onSelectionChange={(k) => onPick(String(k))} />
);
