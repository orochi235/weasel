import { useState } from 'react';
import type { PrefRenderContext, PrefRenderer } from '../Prefs';
import { Button } from '../Button';
import { CloseButton } from '../CloseButton';
import { Input } from '../Input';
import { ListEditor } from '../ListEditor';
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
      {rows.map((r, i) => (
        <div key={i} className={s.optionRow}>
          <Input aria-label={`Option ${i + 1} value`} value={r.value} onChange={(v) => set(i, { value: v })} />
          <Input aria-label={`Option ${i + 1} label`} value={r.label} onChange={(v) => set(i, { label: v })} />
          <CloseButton ariaLabel={`Remove option ${i + 1}`} onClick={() => ctx.setValue(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button size="sm" onClick={() => ctx.setValue([...rows, { value: '', label: '' }])}>Add option</Button>
    </div>
  );
}

export const ATTR_RENDERERS: Record<'optional-number' | 'string-list' | 'enum-options', PrefRenderer> = {
  'optional-number': (ctx) => <OptionalNumber ctx={ctx} />,
  'string-list': (ctx) => <ListEditor aria-label={ctx.pref.name} value={(ctx.value as string[] | undefined) ?? []} onChange={ctx.setValue} />,
  'enum-options': (ctx) => <EnumOptions ctx={ctx} />,
};
