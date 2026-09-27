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

const PRESETS = [1 / 12, 1.5, 22, 1994, 3723, 1_200_000];

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
