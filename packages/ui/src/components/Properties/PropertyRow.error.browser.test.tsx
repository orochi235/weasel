import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { PropertyField } from './PropertyField';
import { PropertyList } from './PropertyList';

// Where a row's message lands is a layout question, so only a real browser can answer it.

afterEach(cleanup);

const box = (el: Element) => el.getBoundingClientRect();

test.each([
  ['an inline number row', 'number'],
  ['a color row', 'color'],
  ['a block number row', 'block'],
] as const)('%s puts its message under its control, across the row', (_, kind) => {
  render(
    <div style={{ width: 260 }}>
      <PropertyList>
        {kind === 'color' ? (
          <PropertyField kind="color" label="Ink" value="#ff0000" onChange={() => {}} error="too red" />
        ) : (
          <PropertyField
            kind="number"
            layout={kind === 'block' ? 'block' : 'inline'}
            label="Gap"
            value={1}
            onChange={() => {}}
            error="too small"
          />
        )}
      </PropertyList>
    </div>,
  );
  const message = screen.getByRole('alert');
  const row = message.parentElement as HTMLElement;
  const control = row.querySelector('input') as HTMLElement;
  const label = row.firstElementChild as HTMLElement;
  expect(box(message).top).toBeGreaterThanOrEqual(box(control).bottom - 0.5);
  expect(box(message).left).toBeCloseTo(box(label).left, 0);
  expect(getComputedStyle(message).color).not.toBe(getComputedStyle(label).color);
});
