import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { gradientForBounds, type Paint } from '@weasel-js/core';
import { afterEach, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PropertyControl } from './PropertyField';

// An inline paint is a stack of controls whose height depends on the paint. Whether the disabled form holds
// that height, and whether anything in it still takes focus, are the browser's to say.

afterEach(cleanup);

const PAINTS: [string, Paint][] = [
  ['solid', { color: '#3a86ff' }],
  ['gradient', gradientForBounds('linear-gradient', { x: 0, y: 0, width: 1, height: 1 }, [{ offset: 0, color: '#3a86ff' }, { offset: 1, color: '#ff3b7f' }], 'bounds')],
];

/** What each element under `root` is drawn at: its own opacity times every ancestor's. */
function strengths(root: Element): number[] {
  return [...root.querySelectorAll('*')].map((el) => {
    let at = 1;
    for (let node: Element | null = el; node !== null; node = node.parentElement) at *= Number(getComputedStyle(node).opacity);
    return at;
  });
}

function measure(paint: Paint, disabled: boolean): { height: number; drawn: number[] } {
  const { container, unmount } = render(
    <div>
      <PropertyControl kind="paint" control="inline" name="Fill" value={paint} disabled={disabled} onChange={() => {}} />
    </div>,
  );
  const cell = container.firstElementChild!;
  const editor = cell.querySelector('[role=radiogroup]')!.parentElement!;
  const found = { height: cell.getBoundingClientRect().height, drawn: strengths(editor) };
  unmount();
  return found;
}

it.each(PAINTS)('draws a disabled inline %s paint at the height of the enabled one, each part at half its strength', (_, paint) => {
  const enabled = measure(paint, false);
  const disabled = measure(paint, true);
  expect(enabled.height).toBeGreaterThan(40);
  expect(disabled.height).toBe(enabled.height);
  expect(disabled.drawn).toEqual(enabled.drawn.map((at) => at * 0.5));
});

it.each(PAINTS)('keeps focus out of a disabled inline %s paint', async (_, paint) => {
  render(
    <>
      <button type="button">Before</button>
      <PropertyControl kind="paint" control="inline" name="Fill" value={paint} disabled onChange={() => {}} />
      <button type="button">After</button>
    </>,
  );
  screen.getByRole('button', { name: 'Before' }).focus();
  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'After' }));

  expect(screen.getByRole('group', { name: 'Fill' }).getAttribute('aria-disabled')).toBe('true');
});
