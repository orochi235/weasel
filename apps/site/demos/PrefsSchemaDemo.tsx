import { useState } from 'react';
import { nestPrefValues, pref, prefLeaves, repairPrefValue } from '@weasel-js/prefs-schema';
import { Button } from '@weasel-js/ui/components/Button';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import s from './PrefsSchemaDemo.module.css';

const SCHEMA = pref.group('Brush', {
  size: pref.number('Size', 12, { min: 1, max: 64, control: 'slider', unit: { scale: 1, suffix: 'px' } }),
  shape: pref.enum('Shape', 'round', ['round', 'square', 'chisel'], { control: 'toggle' }),
  color: pref.color('Color', '#3a7bd5'),
  pressure: pref.boolean('Pressure', true, { control: 'switch' }),
  name: pref.string('Name', 'Pencil', { maxLength: 12 }),
});

const LEAVES = prefLeaves(SCHEMA);

/** Values the schema never allowed, as an older build or a hand-edited file might have stored them. */
const BAD: Record<string, unknown> = { size: 500, shape: 'triangle', color: 'teal-ish', pressure: 'yes', name: 'A very long brush name' };

const show = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));

export function PrefsSchemaDemo() {
  const [stored, setStored] = useState<Record<string, unknown>>({});
  // What each leaf reads as: its stored value repaired against the leaf, or its default where nothing is stored.
  const read = Object.fromEntries(
    [...LEAVES].map(([path, leaf]) => [path, Object.hasOwn(stored, path) ? repairPrefValue(leaf, stored[path]) : leaf.default]),
  );

  return (
    <div className={s.demo}>
      <PrefsForm
        layout="list"
        schema={SCHEMA}
        values={nestPrefValues(read)}
        onChange={(path, value) => setStored((was) => ({ ...was, [path]: value }))}
      />
      <div className={s.side}>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">path</th>
              <th scope="col">stored</th>
              <th scope="col">repairPrefValue</th>
            </tr>
          </thead>
          <tbody>
            {[...LEAVES.keys()].map((path) => (
              <tr key={path}>
                <th scope="row">{path}</th>
                <td>{show(stored[path])}</td>
                <td>{show(read[path])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={s.actions}>
          <Button onClick={() => setStored(BAD)}>Store bad values</Button>
          <Button variant="ghost" onClick={() => setStored({})}>Clear</Button>
        </div>
      </div>
    </div>
  );
}
