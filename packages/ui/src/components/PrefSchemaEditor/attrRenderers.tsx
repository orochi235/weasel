import { useState } from 'react';
import type { PrefPair } from '@weasel-js/prefs';
import type { PrefRenderContext, PrefRenderer } from '../Prefs';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import { Input } from '../Input';
import { Select } from '../Select';
import s from './PrefSchemaEditor.module.css';

/** A number that may be unset: empty text clears it, and text that is not a number is left uncommitted. */
function OptionalNumber({ ctx }: { ctx: PrefRenderContext }) {
  const shown = ctx.value === undefined ? '' : String(ctx.value);
  const [draft, setDraft] = useState(shown);
  const [seen, setSeen] = useState(shown);
  if (seen !== shown) {
    setSeen(shown);
    setDraft(shown);
  }
  const commit = () => {
    const t = draft.trim();
    if (t === '') ctx.setValue(undefined);
    else if (Number.isFinite(Number(t))) ctx.setValue(Number(t));
    else setDraft(shown);
  };
  return <Input className={s.number} aria-label={ctx.pref.name} value={draft} onChange={setDraft} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />;
}

interface Option { value: string; label: string }

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
          <Input className={s.optionValue} placeholder="value" aria-label={`Option ${i + 1} value`} value={r.value} onChange={(v) => set(i, { value: v })} />
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
      ...(nextLabel.trim() !== '' ? { label: nextLabel.trim() } : {}),
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
          onChange={(v) => write(partners, v)} />
      )}
    </div>
  );
}

export const ATTR_RENDERERS: Record<'optional-number' | 'enum-options' | 'pair', PrefRenderer> = {
  pair: (ctx) => <PairEditor ctx={ctx} />,
  'optional-number': (ctx) => <OptionalNumber ctx={ctx} />,
  'enum-options': (ctx) => <EnumOptions ctx={ctx} />,
};
