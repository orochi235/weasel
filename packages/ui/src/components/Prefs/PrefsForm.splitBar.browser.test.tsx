import '@weasel-js/theme/tokens.css';
import { cleanup, render, within } from '@testing-library/react';
import type { PrefGroup, PrefLocus } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

// The mark's box and the bar's are the stylesheets', which jsdom does not load.

afterEach(cleanup);

const MODE = 'mode';

const BAR: PrefGroup = {
  name: 'Bar',
  as: 'bar',
  children: {
    mode: {
      kind: 'enum', name: 'Mode', description: '', default: 'dark',
      options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
    },
    gap: { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100, splitBy: [MODE] },
  },
};

const byMode = (dark: unknown, light: unknown): PrefLocus => ({ $by: MODE, $of: { dark, light } });

it('sets a split bar cell\'s mark inside the cell, beside its control, on its line and inside the bar', () => {
  render(<PrefsForm schema={BAR} values={{}} onChange={() => {}} loci={new Map([['gap', byMode(4, 8)]])} />);
  const cell = document.querySelector<HTMLElement>('[data-pref-path="gap"]')!;
  const box = cell.getBoundingClientRect();
  const strip = document.querySelector('[data-pref-bar]')!.getBoundingClientRect();
  const mark = within(cell).getByTitle('Mode: Dark').getBoundingClientRect();
  const field = within(cell).getByRole('spinbutton').getBoundingClientRect();
  expect(mark.width).toBeGreaterThan(0);
  expect(mark.left).toBeGreaterThanOrEqual(field.right);
  expect(mark.right).toBeLessThanOrEqual(box.right);
  expect(mark.top).toBeGreaterThanOrEqual(strip.top);
  expect(mark.bottom).toBeLessThanOrEqual(strip.bottom);
  expect(mark.top).toBeLessThan(field.bottom);
  expect(mark.bottom).toBeGreaterThan(field.top);
});
