import type { PrefPair } from '@weasel-js/prefs';
import type { PrefRenderContext, PrefRenderer } from '../Prefs';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import { Input } from '../Input';
import { Select } from '../Select';
import { NumberText } from './NumberText';
import { IconAttrField } from './IconAttrField';
import { UnitEditor } from './UnitAttr';
import { MIXED_HINT } from '../mixedHint';
import s from './PrefSchemaEditor.module.css';

/** A number that may be unset: empty text clears it, and text that is not a number is left uncommitted. */
function OptionalNumber({ ctx }: { ctx: PrefRenderContext }) {
  return <NumberText label={ctx.pref.name} value={ctx.mixed ? undefined : (ctx.value as number | undefined)} placeholder={ctx.mixed ? MIXED_HINT : undefined} onCommit={ctx.setValue} />;
}

interface Option { value: string; label: string }

/** Why an option's stored value cannot round-trip through an enum, if it cannot. */
function optionProblem(rows: readonly Option[], i: number): string | undefined {
  const { value } = rows[i]!;
  if (value === '') return 'Value is empty';
  if (rows.findIndex((r) => r.value === value) < i) return 'Repeats an earlier value';
  return undefined;
}

function EnumOptions({ ctx }: { ctx: PrefRenderContext }) {
  const rows = (ctx.value as Option[] | undefined) ?? [];
  const set = (i: number, patch: Partial<Option>) => ctx.setValue(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className={s.options}>
      {rows.length > 0 && (
        <div className={`${s.optionRow} ${s.optionHeads}`} aria-hidden="true">
          <span>Value stored</span>
          <span>Label shown</span>
          <span className={s.optionHeadSpacer} />
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className={s.optionRow}>
          <Input className={s.symbol} placeholder="value" aria-label={`Option ${i + 1} value`} value={r.value} onChange={(v) => set(i, { value: v })}
            isInvalid={optionProblem(rows, i) !== undefined} errorMessage={optionProblem(rows, i)} />
          <Input placeholder="Label" aria-label={`Option ${i + 1} label`} value={r.label} onChange={(v) => set(i, { label: v })} />
          <CloseButton ariaLabel={`Remove option ${i + 1}`} onClick={() => ctx.setValue(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button size="sm" onClick={() => ctx.setValue([...rows, { value: '', label: '' }])}>Add option</Button>
    </div>
  );
}

/** The fields sharing a leaf's row, each picked from the schema's fields by path, and the row's label override.
 *  Picking none removes the pairing. */
function PairEditor({ ctx }: { ctx: PrefRenderContext }) {
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
          <CloseButton ariaLabel={`Remove paired field ${i + 1}`} onClick={() => write(partners.filter((_, j) => j !== i), label)} />
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

export const ATTR_RENDERERS: Record<'optional-number' | 'enum-options' | 'pair' | 'symbol' | 'unit' | 'icon', PrefRenderer> = {
  // Four fields across, which the control column has no room for.
  unit: Object.assign<PrefRenderer, { group: boolean; wide: boolean }>((ctx) => <UnitEditor ctx={ctx} />, { group: true, wide: true }),
  // A search box and a grid of glyphs, which the control column has no room for.
  icon: Object.assign<PrefRenderer, { group: boolean; wide: boolean }>((ctx) => (
    <IconAttrField value={typeof ctx.value === 'string' ? ctx.value : undefined} mixed={ctx.mixed} onChange={ctx.setValue} />
  ), { group: true, wide: true }),
  pair: Object.assign<PrefRenderer, { group: boolean }>((ctx) => <PairEditor ctx={ctx} />, { group: true }),
  'optional-number': (ctx) => <OptionalNumber ctx={ctx} />,
  'enum-options': Object.assign<PrefRenderer, { group: boolean }>((ctx) => <EnumOptions ctx={ctx} />, { group: true }),
  symbol: (ctx) => (
    <Input className={s.symbol} aria-label={ctx.pref.name} mixed={ctx.mixed}
      value={typeof ctx.value === 'string' ? ctx.value : ''} onChange={ctx.setValue} />
  ),
};
