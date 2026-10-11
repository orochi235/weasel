import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { PropertyField } from './PropertyField';

// Opacity multiplies down the tree, so a control dimmed inside something already dimmed reads fainter than the
// rest of its row. Only a browser resolves which rule wins.

afterEach(cleanup);

const opacityOf = (el: Element): number => Number(getComputedStyle(el).opacity);
/** What `el` is drawn at: its own opacity times every ancestor's. */
function drawnAt(el: Element): number {
  let at = 1;
  for (let node: Element | null = el; node !== null; node = node.parentElement) at *= opacityOf(node);
  return at;
}

it('draws a disabled slider row\'s label, readout, and track at one strength', () => {
  render(<PropertyField kind="number" control="slider" label="Blur" value={4} min={0} max={10} disabled onChange={() => {}} />);
  const readout = screen.getByRole('spinbutton', { name: 'Blur' });
  expect(drawnAt(readout)).toBe(0.5);
  expect(drawnAt(screen.getByText('Blur'))).toBe(0.5);
  expect(drawnAt(screen.getByRole('slider', { name: 'Blur' }))).toBe(0.55);
});

it('draws a disabled number\'s steppers at the strength of its field', () => {
  render(<PropertyField kind="number" label="Size" value={4} min={4} steppers disabled onChange={() => {}} />);
  const field = screen.getByRole('spinbutton', { name: 'Size' });
  expect(drawnAt(field)).toBe(0.5);
  for (const stepper of screen.getAllByRole('button', { hidden: true })) expect(drawnAt(stepper)).toBe(0.5);
});

it('leaves an enabled row at full strength', () => {
  render(<PropertyField kind="number" control="slider" label="Blur" value={4} min={0} max={10} onChange={() => {}} />);
  expect(drawnAt(screen.getByRole('spinbutton', { name: 'Blur' }))).toBe(1);
  expect(drawnAt(screen.getByText('Blur'))).toBe(1);
});
