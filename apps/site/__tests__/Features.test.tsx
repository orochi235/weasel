import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FEATURE_PRESETS } from '@weasel-js/core';
import { Features } from '../Features/Features';
import { FEATURES_ID, routeOf } from '../routes';

afterEach(cleanup);

const rowNames = (table: HTMLElement) =>
  within(table).getAllByRole('rowheader').map((th) => th.textContent);

describe('the canvas features page', () => {
  it('has a row for every canvas and one per preset, read from the presets', () => {
    render(<Features />);
    const [presets] = screen.getAllByRole('table');
    expect(rowNames(presets!)).toEqual(['every canvas', ...Object.keys(FEATURE_PRESETS)]);
  });

  it('lists undo and redo for every canvas, and not under edit', () => {
    render(<Features />);
    const rows = within(screen.getAllByRole('table')[0]!).getAllByRole('row');
    const every = rows.find((r) => r.textContent?.startsWith('every canvas'))!;
    const edit = rows.find((r) => within(r).queryByRole('rowheader')?.textContent === 'edit')!;
    expect(every.textContent).toMatch(/Undo.*Redo/);
    expect(edit.textContent).not.toMatch(/Undo/);
  });

  it('lists the presets each one includes', () => {
    render(<Features />);
    const pick = within(screen.getAllByRole('table')[0]!).getAllByRole('row')
      .find((r) => within(r).queryByRole('rowheader')?.textContent === 'pick')!;
    const cells = within(pick).getAllByRole('cell');
    expect(cells.at(-1)!.textContent).toBe(FEATURE_PRESETS.pick.includes!.map((p) => p.id).join(''));
  });

  it('is a page the site routes to', () => {
    expect(routeOf(`#${FEATURES_ID}`, () => false)).toBe(FEATURES_ID);
  });
});
