import { useState } from 'react';
import {
  bytes,
  compact,
  currency,
  decimal,
  duration,
  fraction,
  integer,
  multiplier,
  ordinal,
  percent,
  parseAs,
  partsOf,
  qty,
  ratio,
  roman,
  tag,
  unit,
  zoom,
  type Display,
  type Tagged,
} from '@weasel-js/quantity';
import { BandEditor, UnitField, type Band } from '@weasel-js/ui';
import s from './QuantityDemo.module.css';

const KINDS: [string, Display][] = [
  ['decimal', decimal()],
  ['integer', integer()],
  ['compact', compact({ places: 1 })],
  ['percent', percent({ places: 1 })],
  ['fraction', fraction({ mixed: true })],
  ['fraction, diagonal', fraction({ mixed: true, form: 'diagonal' })],
  ['fraction of π', fraction({ of: 'π' })],
  ['ratio', ratio()],
  ['multiplier', multiplier()],
  ['zoom', zoom()],
  ['unit', unit('in')],
  ['unit, marked', unit('"')],
  ['currency', currency('USD')],
  ['duration', duration({ places: 1 })],
  ['bytes', bytes()],
  ['roman', roman()],
  ['ordinal', ordinal()],
];

const ENTRY = decimal({ maxPlaces: 6, grouping: false });

const PRESETS = [1 / 12, 1.5, (3 * Math.PI) / 4, 22, 1994, 3723, 1_200_000];

// Every property below is measured, not declared: each kind runs over these
// values and the table reports what came back.
const SAMPLES = [0.3, 1.5, 2.7, 1994.25];
const NUMERIC_PARTS = new Set(['number', 'sign', 'whole', 'numerator', 'denominator', 'literal']);

const roundTrip = (v: number, d: Display) => parseAs(qty(v, d).text, d);

const PROPERTIES: { name: string; has: (d: Display, value: number) => boolean }[] = [
  { name: 'whole only', has: (d) => SAMPLES.every((v) => Number.isInteger(roundTrip(v, d))) },
  { name: 'negatives', has: (d) => roundTrip(-1.5, d) < 0 },
  { name: 'exact here', has: (d, value) => Math.abs(roundTrip(value, d) - value) <= 1e-9 * Math.max(1, Math.abs(value)) },
  { name: 'beyond digits', has: (d) => SAMPLES.some((v) => partsOf(v, d).some((p) => !NUMERIC_PARTS.has(p.type))) },
  { name: 'own speech', has: (d) => SAMPLES.some((v) => qty(v, d).spoken !== qty(v, d).text) },
  { name: 'MathML', has: (d) => SAMPLES.some((v) => qty(v, d).mathml !== undefined) },
];

const INITIAL_BANDS: Band<string, Tagged>[] = [
  { from: tag(1 / 64, fraction()), data: 'Icon' },
  { from: tag(1 / 24, fraction()), data: 'Radial' },
  { from: tag(1 / 12, fraction()), data: 'Name plate' },
];

export function QuantityDemo() {
  const [value, setValue] = useState(1 / 12);
  const [bands, setBands] = useState(INITIAL_BANDS);
  const [live, setLive] = useState<Band<string, Tagged>[] | null>(null);

  return (
    <div className={s.demo}>
      <div className={s.presets}>
        <UnitField value={value} onChange={setValue} display={ENTRY} width="fit" className={s.entry} aria-label="Value" />
        {PRESETS.map((p) => (
          <button key={p} type="button" className="ckd-btn" onClick={() => setValue(p)}>
            {qty(p, decimal({ maxPlaces: 4 })).text}
          </button>
        ))}
      </div>
      <table className={s.table}>
        <thead>
          <tr>
            <th>kind</th>
            <th>text</th>
            <th>spoken</th>
            <th>html parts</th>
          </tr>
        </thead>
        <tbody>
          {KINDS.map(([name, display]) => {
            const q = qty(value, display);
            return (
              <tr key={name}>
                <td className={s.kind}>{name}</td>
                <td className={s.text}>{q.text}</td>
                <td className={s.spoken}>{q.spoken}</td>
                <td>
                  <span className={s.parts} dangerouslySetInnerHTML={{ __html: q.html }} />
                  {q.mathml && <span className={s.math} dangerouslySetInnerHTML={{ __html: q.mathml }} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className={s.heading}>What each kind does, probed</h3>
      <table className={`${s.table} ${s.probe}`}>
        <thead>
          <tr>
            <th>kind</th>
            {PROPERTIES.map((p) => <th key={p.name}>{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {KINDS.map(([name, display]) => (
            <tr key={name}>
              <td className={s.kind}>{name}</td>
              {PROPERTIES.map((p) => {
                const has = p.has(display, value);
                return <td key={p.name} className={has ? s.yes : s.no}>{has ? '✓' : '—'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={s.heading}>A tagged value survives an edit</h3>
      <BandEditor<string, Tagged>
        value={live ?? bands}
        min={1 / 64}
        max={1 / 2}
        ticks={[1 / 32, 1 / 16, 1 / 8, 1 / 4].map((at) => ({ at }))}
        display={fraction()}
        onInput={setLive}
        onChange={(next) => {
          setLive(null);
          setBands(next);
        }}
        renderBand={(band) => band.data}
      />
      <pre className={s.json}>{JSON.stringify((live ?? bands).map((b) => b.from))}</pre>
    </div>
  );
}
