import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import { baselineOf } from '@weasel-js/react/testing/baselineOf';
import { afterEach, expect, test } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix, type ControlMatrixColumn } from './ControlMatrix';

// Where the lifted column headers sit against the panel title is a layout question.

afterEach(cleanup);

const look = () => ({ background: f.boolean(true), glow: f.number(0.25).range(0, 1).step(0.05) });
const config = f.schema({
  looks: f.group({ defaults: f.group(look()), window: f.group(look()) }),
});
const schema = resolveConfigSchema(config, []);
const columns: ControlMatrixColumn[] = [
  { key: 'looks.defaults', label: 'Def', title: 'Defaults' },
  { key: 'looks.window', label: 'Win', title: 'Window' },
];

function matrix(over: Partial<Parameters<typeof ControlMatrix>[0]> = {}) {
  render(
    <div className="lk-root">
      <ControlMatrix
        title="Looks"
        schema={schema}
        columns={columns}
        rows={[{ key: 'background' }, { key: 'glow' }]}
        config={config.defaults() as Record<string, unknown>}
        auto={new Set()}
        setConfig={() => {}}
        {...over}
      />
    </div>,
  );
  const title = screen.getByRole('heading', { name: 'Looks' });
  const heads = [...document.querySelectorAll('.lk-control-matrix__heads > *')];
  expect(heads).toHaveLength(columns.length);
  return { title, heads };
}

test('the column headers sit on the panel title’s baseline', () => {
  const { title, heads } = matrix();
  for (const head of heads) {
    expect(Math.abs(baselineOf(head) - baselineOf(title))).toBeLessThan(0.5);
  }
});

test('and so do headers that are buttons, beside a twisty', () => {
  const { title, heads } = matrix({ onColumnClick: () => {}, collapsible: true });
  for (const head of heads) {
    expect(Math.abs(baselineOf(head) - baselineOf(title))).toBeLessThan(0.5);
  }
});
