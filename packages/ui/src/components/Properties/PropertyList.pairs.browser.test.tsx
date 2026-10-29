import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render, screen } from '@testing-library/react';
import { baselineOf } from '@weasel-js/react/testing/baselineOf';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { PropertyField } from './PropertyField';
import { PropertyList } from './PropertyList';

// Where the two rows of a pair put their labels, and how wide a row is, are layout questions.

// Measured in the kit's own face: without it each OS lays text out in a fallback of its own.
beforeAll(async () => { await document.fonts.load('400 16px Oswald'); });

afterEach(cleanup);

const labelOf = (text: string) => screen.getByText(text).closest('[class*="rowLabel"]')!;

function pairs() {
  render(
    <div style={{ width: 320 }}>
      <PropertyList pack="pairs">
        <PropertyField kind="number" control="slider" label="Opacity" value={0.5} min={0} max={1} onChange={() => {}} />
        <PropertyField kind="color" label="Fill" value="#b08adb" onChange={() => {}} />
        <PropertyField kind="color" label="Stroke" value="#1a1428" onChange={() => {}} />
        <PropertyField kind="boolean" label="Visible" hug value onChange={() => {}} />
      </PropertyList>
    </div>,
  );
}

test('the two rows of a pair set their labels on one line, a slider row beside a color row', () => {
  pairs();
  expect(Math.abs(baselineOf(labelOf('Opacity')) - baselineOf(labelOf('Fill')))).toBeLessThan(0.5);
});

test('a hug row is as wide as its label and control, at the leading edge of its cell', () => {
  pairs();
  const row = labelOf('Visible').parentElement!;
  const cell = labelOf('Fill').parentElement!;
  expect(row.getBoundingClientRect().left).toBe(cell.getBoundingClientRect().left);
  expect(row.getBoundingClientRect().width).toBeLessThan(cell.getBoundingClientRect().width / 2);
  const box = screen.getByRole('checkbox', { name: 'Visible' }).getBoundingClientRect();
  expect(box.left - labelOf('Visible').getBoundingClientRect().right).toBeLessThan(16);
});
