import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';

// A disabled row's look is the stylesheet's, and so is the space a hidden row leaves: jsdom resolves neither.

afterEach(cleanup);

const on = { path: 'on' };
const leaf = (kind: string, name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind, name, description: '', default: kind === 'number' ? 4 : kind === 'boolean' ? false : '', ...extra }) as PrefLeaf;

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    on: leaf('boolean', 'On'),
    size: leaf('number', 'Size', { enableIf: on }),
    blur: leaf('number', 'Blur', { control: 'slider', min: 0, max: 10, enableIf: on }),
    notes: leaf('string', 'Notes', { control: 'textarea', enableIf: on }),
    tint: leaf('color', 'Tint', { default: '#ff0000', enableIf: on }),
    fill: leaf('paint', 'Fill', { default: { color: '#00ff00' }, enableIf: on }),
    gone: leaf('number', 'Gone', { showIf: on }),
    last: leaf('number', 'Last'),
  },
};

const opacityOf = (el: Element): number => Number(getComputedStyle(el).opacity);
/** The label of the row a control sits in: the row's first child. */
const labelOf = (control: Element): Element => control.closest('[data-property-row]')!.firstElementChild!;

it('dims a disabled row\'s label and every disabled control, and leaves an enabled row alone', () => {
  render(<PrefsForm schema={SCHEMA} values={{ on: false }} onChange={() => {}} layout="list" />);
  const size = screen.getByRole('spinbutton', { name: 'Size' });
  const row = size.closest('[data-property-row][data-disabled]')!;
  expect(opacityOf(row.firstElementChild!)).toBe(0.5);
  expect(getComputedStyle(row).cursor).toBe('not-allowed');
  // A typed number dims at its frame, which holds the steppers too.
  expect(opacityOf(size.parentElement!)).toBe(0.5);
  expect(opacityOf(screen.getByRole('slider', { name: 'Blur' }))).toBe(0.55);
  expect(opacityOf(screen.getByRole('spinbutton', { name: 'Blur' }))).toBe(0.5);
  expect(opacityOf(screen.getByRole('textbox', { name: 'Notes' }))).toBe(0.5);
  expect(opacityOf(screen.getByLabelText('Tint'))).toBe(0.5);
  expect(opacityOf(screen.getByRole('button', { name: 'Fill' }))).toBe(0.5);

  const last = screen.getByRole('spinbutton', { name: 'Last' });
  expect(last.closest('[data-property-row][data-disabled]')).toBeNull();
  expect(opacityOf(labelOf(last))).toBe(1);
  expect(opacityOf(last.parentElement!)).toBe(1);
});

it('gives a hidden row no box: the rows after it sit where they would without it', () => {
  const without: PrefGroup = { ...SCHEMA, children: Object.fromEntries(Object.entries(SCHEMA.children).filter(([key]) => key !== 'gone')) };
  const top = (schema: PrefGroup): number => {
    const { container, unmount } = render(<PrefsForm schema={schema} values={{ on: false }} onChange={() => {}} layout="list" />);
    const at = screen.getByRole('spinbutton', { name: 'Last' }).getBoundingClientRect().top - container.getBoundingClientRect().top;
    unmount();
    return at;
  };
  expect(top(SCHEMA)).toBe(top(without));
});
