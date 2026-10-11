import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import type { PrefRenderContext } from '../Prefs';
import { ATTR_RENDERERS } from './attrRenderers';

// Where a flagged row's message pushes its neighbors is layout, which jsdom does not do.

afterEach(cleanup);

const ctx = (value: unknown): PrefRenderContext => ({
  path: 'x', pref: { kind: 'enum-options', name: 'X', description: '', default: undefined }, value, setValue: () => {}, auto: false, setAuto: () => {},
});

test('a flagged option draws its value in the danger color, with its label still level beside it', () => {
  render(<div style={{ width: 400 }}>{ATTR_RENDERERS['enum-options'](ctx([{ value: 'a', label: 'A' }, { value: 'a', label: 'B' }]))}</div>);
  const box = (name: string) => screen.getByRole('textbox', { name });
  const frame = (name: string) => box(name).parentElement!;
  expect(getComputedStyle(frame('Option 2 value')).borderColor).not.toBe(getComputedStyle(frame('Option 1 value')).borderColor);
  const message = screen.getByText('Repeats an earlier value');
  expect(message.getBoundingClientRect().height).toBeGreaterThan(0);
  expect(message.getBoundingClientRect().top).toBeGreaterThanOrEqual(frame('Option 2 value').getBoundingClientRect().bottom);
  expect(frame('Option 2 label').getBoundingClientRect().top).toBeCloseTo(frame('Option 2 value').getBoundingClientRect().top, 0);
});
