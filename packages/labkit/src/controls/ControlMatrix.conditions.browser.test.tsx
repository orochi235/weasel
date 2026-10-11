import '@weasel-js/theme/tokens.css';
import '../styles.less';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { f } from '../config/builder';
import { resolveConfigSchema } from '../config/resolve';
import { ControlMatrix, type ControlMatrixColumn } from './ControlMatrix';

// Whether a disabled cell's dimming reaches its control is the stylesheet's to say, which jsdom does not load.

afterEach(cleanup);

const look = () => ({ background: f.boolean(true), glow: f.number(0.25) });
const config = f.schema({
  locked: f.boolean(true),
  looks: f.group({
    defaults: f.group(look()),
    window: f.group(look()).enableIf({ path: 'locked', is: false }),
  }),
});
const schema = resolveConfigSchema(config, []);
const columns: ControlMatrixColumn[] = [
  { key: 'looks.defaults', label: 'Def', title: 'Defaults' },
  { key: 'looks.window', label: 'Win', title: 'Window' },
];

test('a disabled cell is dimmed, a switch and a value alike, and an enabled one is not', () => {
  render(
    <div className="lk-root">
      <ControlMatrix
        schema={schema}
        columns={columns}
        rows={[{ key: 'background' }, { key: 'glow' }]}
        config={config.defaults() as Record<string, unknown>}
        auto={new Set()}
        setConfig={() => {}}
      />
    </div>,
  );
  const opacity = (el: Element): string => getComputedStyle(el).opacity;
  expect(opacity(screen.getByRole('switch', { name: 'Window Background' }))).toBe('0.5');
  expect(opacity(screen.getByRole('button', { name: 'Window Glow' }))).toBe('0.5');
  expect(opacity(screen.getByRole('switch', { name: 'Defaults Background' }))).toBe('1');
  expect(opacity(screen.getByRole('button', { name: 'Defaults Glow' }))).toBe('1');
});
