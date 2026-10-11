import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, expect, it } from 'vitest';
import { Bar } from './Bar';

// A disabled cell's control dims itself and its name is the bar's own, so whether the two read as one
// disabled cell, and whether anything is dimmed twice, is the stylesheet's, which jsdom does not resolve.

afterEach(cleanup);

const on = { path: 'on' };
const leaf = (kind: string, name: string, extra: Record<string, unknown> = {}): PrefLeaf =>
  ({ kind, name, description: '', default: kind === 'number' ? 4 : kind === 'boolean' ? true : 'abc', ...extra }) as PrefLeaf;

const schema: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: {
    on: leaf('boolean', 'On', { control: 'toggle' }),
    step: leaf('number', 'Step', { enableIf: on }),
    blur: leaf('number', 'Blur', { control: 'slider', min: 0, max: 10, enableIf: on }),
    title: leaf('string', 'Title', { enableIf: on }),
    snap: leaf('boolean', 'Snap', { control: 'switch', enableIf: on }),
    grid: leaf('boolean', 'Grid', { control: 'checkbox', enableIf: on }),
    size: leaf('number', 'Size'),
    wrap: leaf('boolean', 'Wrap', { control: 'switch' }),
  },
};

/** What `el` is drawn at: its own opacity times every ancestor's. */
function drawnAt(el: Element): number {
  let at = 1;
  for (let node: Element | null = el; node !== null; node = node.parentElement) at *= Number(getComputedStyle(node).opacity);
  return at;
}
/** The words a bar sets beside a control: its label before, or its name after. Hidden from a reader, which has the control's own name. */
function wordsOf(control: Element): Element {
  for (let at = control.parentElement; at !== null; at = at.parentElement) {
    const words = at.querySelector(':scope > [aria-hidden="true"]');
    if (words !== null) return words;
  }
  throw new Error('no words beside the control');
}

it('dims the name of a disabled cell with its control, and nothing twice', () => {
  render(<Bar schema={schema} values={{ on: false }} onChange={() => {}} />);
  for (const [role, name] of [['spinbutton', 'Step'], ['slider', 'Blur'], ['textbox', 'Title'], ['switch', 'Snap'], ['checkbox', 'Grid']] as const) {
    const control = screen.getByRole(role, { name });
    expect(control).toBeDisabled();
    expect(wordsOf(control).textContent).toBe(name);
    expect(drawnAt(wordsOf(control))).toBe(0.5);
  }
  expect(drawnAt(screen.getByRole('spinbutton', { name: 'Step' }))).toBe(0.5);
  expect(drawnAt(screen.getByRole('textbox', { name: 'Title' }))).toBe(0.5);
  expect(drawnAt(screen.getByRole('slider', { name: 'Blur' }))).toBe(0.55);
});

it('leaves the name of an enabled cell beside a disabled one alone', () => {
  render(<Bar schema={schema} values={{ on: false }} onChange={() => {}} />);
  expect(drawnAt(wordsOf(screen.getByRole('spinbutton', { name: 'Size' })))).toBe(1);
  expect(drawnAt(wordsOf(screen.getByRole('switch', { name: 'Wrap' })))).toBe(1);
  expect(drawnAt(screen.getByRole('spinbutton', { name: 'Size' }))).toBe(1);
});
