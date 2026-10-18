import { Field, LabToggle, RangeRow } from './ParamControl';
import type { LabCaps, LabSnapshot } from './snapshot';
import { linkPatch, padPatch, type PadSide } from './transitions';
import controls from './controls.stories.module.css';
import s from './ComposeLab.stories.module.css';

type Type = Pick<
  LabSnapshot,
  | 'fontFamily' | 'fontSizeDelta' | 'bold' | 'italic' | 'caps'
  | 'padTop' | 'padRight' | 'padBottom' | 'padLeft' | 'linkPadX' | 'linkPadY'
>;

const FONTS = [
  'inherit',
  'system-ui, sans-serif',
  'Helvetica, Arial, sans-serif',
  "Georgia, 'Times New Roman', serif",
  'ui-monospace, SFMono-Regular, Menlo, monospace',
  "'Helvetica Neue Condensed', 'Arial Narrow', sans-serif",
] as const;
const FONT_LABELS = ['inherit', 'system', 'sans', 'serif', 'mono', 'cond'] as const;
const CAPS: readonly LabCaps[] = ['normal', 'small-caps', 'all-small-caps'];
const PAD_SIDES: readonly { side: PadSide; key: 'padTop' | 'padRight' | 'padBottom' | 'padLeft' }[] = [
  { side: 'top', key: 'padTop' },
  { side: 'right', key: 'padRight' },
  { side: 'bottom', key: 'padBottom' },
  { side: 'left', key: 'padLeft' },
];

function LinkIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={s.linkIcon}>
      <path d="M6.5 4h-1.5a3 3 0 1 0 0 6h1.5M9.5 4h1.5a3 3 0 0 1 0 6h-1.5M5.5 7h5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaddingHead({ value, onChange }: { value: Type; onChange: (patch: Partial<Type>) => void }) {
  return (
    <div className={s.padHead}>
      <h4 className={s.padTitle}>Padding</h4>
      <div className={s.links}>
        <label className={`${s.check} ${s.link}`} title="Lock left/right padding">
          <input type="checkbox" checked={value.linkPadX} onChange={(e) => onChange(linkPatch(value, 'x', e.target.checked))} />
          <LinkIcon /> X
        </label>
        <label className={`${s.check} ${s.link}`} title="Lock top/bottom padding">
          <input type="checkbox" checked={value.linkPadY} onChange={(e) => onChange(linkPatch(value, 'y', e.target.checked))} />
          <LinkIcon /> Y
        </label>
      </div>
    </div>
  );
}

export function TypeSection({ value, onChange }: { value: Type; onChange: (patch: Partial<Type>) => void }) {
  const delta = value.fontSizeDelta;
  return (
    <section className={s.section}>
      <h3 className={s.sectionTitle}>Type & padding</h3>
      <Field label="font" columns={controls.narrow2}>
        <LabToggle<string> value={value.fontFamily} options={FONTS} labels={FONT_LABELS} onChange={(fontFamily) => onChange({ fontFamily })} />
      </Field>
      <RangeRow
        narrow
        label="size Δ"
        min={-6}
        max={24}
        step={0.5}
        value={delta}
        onChange={(fontSizeDelta) => onChange({ fontSizeDelta })}
        readout={delta > 0 ? `+${delta}` : String(delta)}
      />
      <Field label="style" columns={s.fontStyle} group>
        <label className={s.check}>
          <input type="checkbox" checked={value.bold} onChange={(e) => onChange({ bold: e.target.checked })} /> B
        </label>
        <label className={`${s.check} ${s.italic}`}>
          <input type="checkbox" checked={value.italic} onChange={(e) => onChange({ italic: e.target.checked })} /> I
        </label>
        <span />
      </Field>
      <Field label="caps" columns={controls.narrow2}>
        <LabToggle value={value.caps} options={CAPS} onChange={(caps) => onChange({ caps })} />
      </Field>
      <PaddingHead value={value} onChange={onChange} />
      {PAD_SIDES.map(({ side, key }) => (
        <RangeRow
          key={side}
          narrow
          label={side}
          min={0}
          max={40}
          step={0.5}
          value={value[key]}
          onChange={(v) => onChange(padPatch(value, side, v))}
        />
      ))}
    </section>
  );
}
