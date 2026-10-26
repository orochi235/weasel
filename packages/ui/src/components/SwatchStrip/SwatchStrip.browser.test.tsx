import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import type { RunAlign } from '@weasel-js/geom';
import { createRecentColorsStore } from '../RecentColors';
import { SwatchStrip } from './SwatchStrip';

afterEach(cleanup);

const RECENT = ['#ee6c4dff', '#3d5a80ff', '#98c1d9ff'];

async function mount(align?: RunAlign) {
  await page.viewport(800, 600);
  const store = createRecentColorsStore({ storage: null });
  store.record([...RECENT].reverse());
  render(
    <div style={{ width: 400 }}>
      <SwatchStrip store={store} columns={10} align={align} onChange={() => {}} />
    </div>,
  );
  const row = screen.getByRole('group', { name: 'Recent colors' });
  const box = row.getBoundingClientRect();
  const swatches = within(row).getAllByRole('button');
  return { box, swatches, lefts: swatches.map((b) => b.getBoundingClientRect().left - box.left) };
}

test('a row shorter than its run sits at the start by default', async () => {
  const { lefts } = await mount();
  expect(lefts[0]).toBeCloseTo(0, 0);
});

test('align moves a row shorter than its run along it', async () => {
  const start = await mount('start');
  cleanup();
  const center = await mount('center');
  cleanup();
  const end = await mount('end');
  const pitch = start.lefts[1]! - start.lefts[0]!;
  expect(pitch).toBeGreaterThan(10);
  expect(start.lefts[0]).toBeCloseTo(0, 0);
  // Ten columns, three swatches: the spare seven columns go before the row at the end, half of them in the center.
  expect(center.lefts[0]).toBeCloseTo(3.5 * pitch, 0);
  expect(end.lefts[0]).toBeCloseTo(7 * pitch, 0);
  const last = end.swatches[2]!.getBoundingClientRect();
  expect(last.right).toBeCloseTo(end.box.right, 0);
});

test('an arrow down from a full row lands on the swatch beneath it in a shifted row', async () => {
  await page.viewport(800, 600);
  const colors = Array.from({ length: 13 }, (_, i) => ({ value: `#${(i * 17).toString(16).padStart(2, '0')}0000ff` }));
  render(
    <div style={{ width: 400 }}>
      <SwatchStrip palettes={[{ id: 'p', name: 'P', columns: 10, colors }]} align="end" onChange={() => {}} />
    </div>,
  );
  const grid = screen.getByRole('group', { name: 'P' });
  const swatches = within(grid).getAllByRole('button');
  swatches[8]!.focus();
  await userEvent.keyboard('{ArrowDown}');
  // Columns 7–9 hold the last row's three swatches, so column 8 sits over its second.
  expect(document.activeElement).toBe(swatches[11]);
  await userEvent.keyboard('{ArrowUp}');
  expect(document.activeElement).toBe(swatches[8]);
  swatches[2]!.focus();
  await userEvent.keyboard('{ArrowDown}');
  expect(document.activeElement).toBe(swatches[2]);
});
