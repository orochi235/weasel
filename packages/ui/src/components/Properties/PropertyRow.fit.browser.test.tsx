import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { PropertyField, PropertyList } from '@weasel-js/ui/components/Properties';

// Whether a control sits beside its label or under it is the browser's flex wrapping to decide.

beforeAll(async () => { await document.fonts.load('400 16px Oswald'); });
afterEach(cleanup);

const SLOP = 6;
const TRACK_MIN = 64;
const ENDS = [{ value: 'butt', label: 'Butt' }, { value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }];

const labelOf = (text: string) => screen.getByText(text).closest('[class*="rowLabel"]')!;
const rowOf = (text: string) => labelOf(text).parentElement!;
const box = (el: Element) => el.getBoundingClientRect();
const under = (control: Element, text: string) => box(control).top >= box(labelOf(text)).bottom - 0.5;

function pairs(width: number) {
  render(
    <div style={{ width }}>
      <PropertyList pack="pairs">
        <PropertyField kind="number" control="slider" layout="inline" label="Gap" value={20} min={5} max={80} step={5} onChange={() => {}} />
        <PropertyField kind="number" control="slider" layout="inline" label="Shift angle step" value={15} min={5} max={90} step={5} onChange={() => {}} />
        <PropertyField kind="number" layout="inline" label="Snap tolerance in pixels" value={6} min={0} max={40} onChange={() => {}} />
        <PropertyField kind="enum" control="toggle" layout="inline" label="Line ends here" value="round" options={ENDS} onChange={() => {}} />
      </PropertyList>
    </div>,
  );
}

test('a slider whose label would starve its track puts the track under the label, its readout beside it', () => {
  pairs(320);
  const row = rowOf('Shift angle step');
  const range = row.querySelector('input[type="range"]')!;
  const readout = row.querySelector('[class*="readoutAfter"]')!;
  expect(under(range, 'Shift angle step')).toBe(true);
  expect(box(range).width - 2 * SLOP).toBeGreaterThanOrEqual(TRACK_MIN - 0.5);
  expect(box(readout).top).toBeLessThan(box(range).bottom);
  expect(box(readout).bottom).toBeGreaterThan(box(range).top);
  expect(box(readout).left).toBeGreaterThanOrEqual(box(range).right - SLOP);
  expect(box(readout).right).toBeLessThanOrEqual(box(row).right + 0.5);
});

test('a slider beside a short label stays on the label\'s line', () => {
  pairs(320);
  const range = rowOf('Gap').querySelector('input[type="range"]')!;
  expect(under(range, 'Gap')).toBe(false);
  expect(box(range).width - 2 * SLOP).toBeGreaterThanOrEqual(TRACK_MIN - 0.5);
});

test('with room, a long label keeps its slider beside it, at the width it takes beside a short one', () => {
  pairs(900);
  const long = rowOf('Shift angle step').querySelector('input[type="range"]')!;
  const short = rowOf('Gap').querySelector('input[type="range"]')!;
  expect(under(long, 'Shift angle step')).toBe(false);
  expect(Math.abs(box(long).width - box(short).width)).toBeLessThan(0.5);
  expect(box(long).width).toBeLessThan(rowOf('Gap').getBoundingClientRect().width / 2);
});

test('a field and a toggle follow the same rule', () => {
  pairs(320);
  const field = rowOf('Snap tolerance in pixels').querySelector('input')!;
  expect(under(field, 'Snap tolerance in pixels')).toBe(true);
  const toggle = screen.getByRole('radio', { name: 'Square' });
  expect(under(toggle, 'Line ends here')).toBe(true);
  for (const name of ['Butt', 'Round', 'Square']) {
    const seg = screen.getByRole('radio', { name });
    expect(seg.scrollWidth).toBeLessThanOrEqual(seg.clientWidth + 1);
  }
});
