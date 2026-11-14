import type { PrefEnumOption, PrefPair } from '@weasel-js/prefs';
import {
  Checkbox, Button, CLOSE_BUTTON_PROPS, Input, type LeafContext, type LeafRenderer, MIXED_HINT, Select, TokenField,
} from '@weasel-js/ui';
import { NumberText } from './NumberText';
import { IconAttrField } from './IconAttrField';
import { UnitEditor } from './UnitAttr';
import s from './PrefSchemaEditor.module.css';

/** A number that may be unset: empty text clears it, and text that is not a number is left uncommitted. */
function OptionalNumber({ ctx }: { ctx: LeafContext }) {
  return <NumberText label={ctx.pref.name} value={ctx.mixed ? undefined : (ctx.value as number | undefined)} placeholder={ctx.mixed ? MIXED_HINT : undefined} onCommit={ctx.setValue} />;
}

type Option = PrefEnumOption;

/** `o` with `key` set to `value`, or without it where `value` is empty: an option keeps only what it says. */
function optionWith(o: Option, key: 'description' | 'disabled' | 'disabledReason', value: string | boolean): Option {
  const next: Option = { ...o };
  if (value === '' || value === false) delete next[key];
  else Object.assign(next, { [key]: value });
  return next;
}

/** Why an option's stored value cannot round-trip through an enum, if it cannot. */
function optionProblem(rows: readonly Option[], i: number): string | undefined {
  const { value } = rows[i]!;
  if (value === '') return 'Value is empty';
  if (rows.findIndex((r) => r.value === value) < i) return 'Repeats an earlier value';
  return undefined;
}

/** An enum's options as chips: each shows its label, and its stored value on hover; typing adds one stored as typed. */
function EnumOptions({ ctx }: { ctx: LeafContext }) {
  const rows = (ctx.value as Option[] | undefined) ?? [];
  return (
    <TokenField<Option>
      aria-label="Options"
      placeholder="Add option…"
      reorder
      value={rows}
      onChange={ctx.setValue}
      label={(o) => o.label || o.value}
      tooltip={(o) => <code>{o.value}</code>}
      create={(text) => ({ value: text, label: text })}
      problem={optionProblem}
      renderEditor={(o, set, i) => (
        <>
          <Input className={s.symbol} label="Value stored" value={o.value} onChange={(v) => set({ ...o, value: v })}
            isInvalid={optionProblem(rows, i) !== undefined} errorMessage={optionProblem(rows, i)} />
          <Input label="Label shown" value={o.label} onChange={(v) => set({ ...o, label: v })} />
          <Input label="Description" value={o.description ?? ''} onChange={(v) => set(optionWith(o, 'description', v))} />
          <Checkbox isSelected={o.disabled === true} onChange={(on) => set(optionWith(on ? o : optionWith(o, 'disabledReason', ''), 'disabled', on))}>Disabled</Checkbox>
          {o.disabled === true && (
            <Input label="Why disabled" value={o.disabledReason ?? ''} onChange={(v) => set(optionWith(o, 'disabledReason', v))} />
          )}
        </>
      )}
    />
  );
}

/** The fields sharing a leaf's row, each picked from the schema's fields by path, and the row's label override.
 *  Picking none removes the pairing. */
function PairEditor({ ctx }: { ctx: LeafContext }) {
  const pair = ctx.value as PrefPair | undefined;
  const partners = pair === undefined ? [] : typeof pair.with === 'string' ? [pair.with] : [...pair.with];
  const label = pair?.label ?? '';
  const write = (nextWith: readonly string[], nextLabel: string) => {
    const kept = nextWith.filter((p) => p !== '');
    ctx.setValue(kept.length === 0 ? undefined : {
      with: kept.length === 1 ? kept[0]! : kept,
      ...(nextLabel.trim() !== '' ? { label: nextLabel } : {}),
    });
  };
  const options = (ctx.fields ?? []).map((f) => ({ value: f.path, label: `${f.name} (${f.path})` }));
  return (
    <div className={s.options}>
      {partners.map((path, i) => (
        <div key={i} className={s.pairRow}>
          <Select aria-label={`Paired field ${i + 1}`} selectedKey={path}
            options={options.some((o) => o.value === path) ? options : [{ value: path, label: path }, ...options]}
            onSelectionChange={(k) => write(partners.map((p, j) => (j === i ? String(k) : p)), label)} />
          <Button {...CLOSE_BUTTON_PROPS} aria-label={`Remove paired field ${i + 1}`} onClick={() => write(partners.filter((_, j) => j !== i), label)} />
        </div>
      ))}
      <Select aria-label="Add a paired field" placeholder="Add field…" selectedKey={null} options={options}
        onSelectionChange={(k) => write([...partners, String(k)], label)} />
      {partners.length > 0 && (
        <Input aria-label="Row label" placeholder="Row label (default: this pref's name)" value={label}
          // Kept as typed until the field is left: trimmed on each key, a space could never be typed.
          onChange={(v) => write(partners, v)} onBlur={() => { if (label !== label.trim()) write(partners, label.trim()); }} />
      )}
    </div>
  );
}

export const ATTR_RENDERERS: Record<'optional-number' | 'enum-options' | 'pair' | 'symbol' | 'unit' | 'icon', LeafRenderer> = {
  // Four fields across, which the control column has no room for.
  unit: Object.assign<LeafRenderer, { group: boolean; wide: boolean }>((ctx) => <UnitEditor ctx={ctx} />, { group: true, wide: true }),
  // A search box and a grid of glyphs, which the control column has no room for.
  icon: Object.assign<LeafRenderer, { group: boolean; wide: boolean }>((ctx) => (
    <IconAttrField value={ctx.value} mixed={ctx.mixed} onChange={ctx.setValue} />
  ), { group: true, wide: true }),
  pair: Object.assign<LeafRenderer, { group: boolean }>((ctx) => <PairEditor ctx={ctx} />, { group: true }),
  'optional-number': (ctx) => <OptionalNumber ctx={ctx} />,
  'enum-options': Object.assign<LeafRenderer, { group: boolean }>((ctx) => <EnumOptions ctx={ctx} />, { group: true }),
  symbol: (ctx) => (
    <Input className={s.symbol} aria-label={ctx.pref.name} mixed={ctx.mixed}
      value={typeof ctx.value === 'string' ? ctx.value : ''} onChange={ctx.setValue} />
  ),
};
