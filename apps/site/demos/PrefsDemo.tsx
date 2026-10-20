import { prefLeaves, prefValueAtPath, type PrefGroup } from '@weasel-js/prefs';
import { usePref, usePrefsStore, usePrefsValues } from '@weasel-js/prefs/react';
import { localStorageAdapter } from '@weasel-js/storage';
import { Button } from '@weasel-js/ui/components/Button';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import s from './PrefsDemo.module.css';

const GRID_ON = { path: 'grid.visible' };

const SCHEMA = {
  name: 'Preferences',
  children: {
    grid: {
      name: 'Grid',
      children: {
        visible: { kind: 'boolean', name: 'Show grid', description: 'Draw the grid.', default: true, control: 'switch' },
        size: {
          kind: 'number',
          name: 'Cell size',
          description: 'Width of one cell, from 4 to 64.',
          default: 16,
          min: 4,
          max: 64,
          step: 4,
          control: 'slider',
          enableIf: GRID_ON,
        },
        style: {
          kind: 'enum',
          name: 'Style',
          description: 'What marks the cells.',
          default: 'lines',
          options: [
            { value: 'lines', label: 'Lines' },
            { value: 'dots', label: 'Dots' },
          ],
          control: 'toggle',
          enableIf: GRID_ON,
        },
        color: { kind: 'color', name: 'Color', description: 'Color of the marks.', default: '#4a90d9', showIf: GRID_ON },
      },
    },
  },
} satisfies PrefGroup;

const PATHS = [...prefLeaves(SCHEMA).keys()];

const show = (value: unknown) => (value === undefined ? '—' : JSON.stringify(value));

export function PrefsDemo() {
  const store = usePrefsStore(SCHEMA, { storage: localStorageAdapter, prefix: 'weasel-demo-prefs.' });
  const { values, set, unset, stored, reset } = usePrefsValues(store);
  const [, setSize] = usePref(store, 'grid.size');

  return (
    <div className={s.demo}>
      <PrefsForm layout="list" schema={SCHEMA} values={values} onChange={set} />
      <div className={s.side}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>path</th>
              <th>values()</th>
              <th>stored()</th>
            </tr>
          </thead>
          <tbody>
            {PATHS.map((path) => (
              <tr key={path}>
                <td className={s.path}>{path}</td>
                <td>{show(prefValueAtPath(values, path))}</td>
                <td className={unset.has(path) ? s.unset : undefined}>
                  {unset.has(path) ? 'unset' : show(prefValueAtPath(stored, path))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={s.actions}>
          {/* Past the leaf's `max`: the record keeps 500 and every read clamps it. */}
          <Button onClick={() => setSize(500)}>Store size 500</Button>
          <Button onClick={() => reset()}>Reset</Button>
        </div>
      </div>
    </div>
  );
}

