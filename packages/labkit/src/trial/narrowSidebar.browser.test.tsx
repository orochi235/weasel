import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlPanel } from '../controls/ControlPanel';
import { TrialBody } from './TrialBody';

// Whether a label and its value share a cell without overlapping is a layout question, so only a real
// browser can answer it.

afterEach(cleanup);

const follow = (label: string, ...options: string[]) =>
  f
    .enum('lab', [
      { value: 'lab', label: 'Lab' },
      ...options.map((value) => ({ value, label: value })),
    ])
    .label(label);

const schema = f.schema({
  pins: f
    .group({
      mode: follow('Mode', 'Light', 'Dark'),
      density: follow('Density', 'Compact', 'Comfortable'),
      theme: follow('Theme', 'Default', 'Contrast'),
    })
    .label('')
    .section('Globals', { layout: 'inline', pack: 'pairs' }),
});

const frames = () =>
  new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

async function mount(width: number) {
  render(
    <div className="lk-root">
      <TrialBody
        width={width}
        viewport={{ w: 600, h: 400 }}
        sidebar={
          <ControlPanel
            schema={resolveConfigSchema(schema)}
            config={schema.defaults() as Record<string, unknown>}
            setConfig={() => {}}
          />
        }
      >
        <div />
      </TrialBody>
    </div>,
  );
  await frames();
  return [...document.querySelectorAll('[data-property-row]')].map((row) => {
    const label = row.querySelector(':scope > [class*="rowLabel"]')!;
    return {
      name: label.textContent,
      row: row.getBoundingClientRect(),
      label: label.getBoundingClientRect(),
      value: row.lastElementChild!.getBoundingClientRect(),
    };
  });
}

test('at the narrowest a drag makes a sidebar, a paired row keeps its label clear of its value', async () => {
  const rows = await mount(140);
  for (const { name, row, label, value } of rows) {
    expect(label.right, `${name}: label ends before its value starts`).toBeLessThanOrEqual(
      value.left + 0.5,
    );
    expect(value.right, `${name}: value stays inside its row`).toBeLessThanOrEqual(row.right + 0.5);
  }
});

test('a sidebar with room for two columns still pairs its rows', async () => {
  const [mode, density] = await mount(320);
  expect(density.row.top).toBe(mode.row.top);
  expect(density.row.left).toBeGreaterThan(mode.row.right - 0.5);
});
