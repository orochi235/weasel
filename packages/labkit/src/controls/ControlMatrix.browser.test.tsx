import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import { f, resolveConfigSchema } from '@weasel-js/labkit/config';
import { ControlMatrix, type ControlMatrixColumn } from '@weasel-js/labkit/controls';
import { baselineOf } from '@weasel-js/react/testing/baselineOf';
import { afterEach, expect, test } from 'vitest';
import { commands } from 'vitest/browser';

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

test('under forced colors a switch draws its thumb apart from its track', async () => {
  await commands.forcedColors('active');
  try {
    const looks = {
      defaults: { background: true, glow: 0.25 },
      window: { background: false, glow: 0.25 },
    };
    matrix({ config: { looks } });
    const switches = [...document.querySelectorAll('.lk-control-matrix__switch')];
    expect(switches.map((sw) => sw.getAttribute('aria-checked')).sort()).toEqual(['false', 'true']);
    for (const sw of switches) {
      const bg = (part: string) =>
        getComputedStyle(sw.querySelector(`.lk-control-matrix__${part}`) as Element)
          .backgroundColor;
      expect(bg('thumb')).not.toBe(bg('track'));
    }
  } finally {
    await commands.forcedColors('none');
  }
});
