import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { LayerList } from './LayerList';

afterEach(cleanup);

test('a row\'s gridcell adds no box, so its content lays out as the row\'s own', () => {
  render(
    <div style={{ width: 240 }}>
      <LayerList items={[{ id: 'a', label: 'Alpha' }]} onReorder={() => {}} onRemove={() => {}} />
    </div>,
  );
  const row = screen.getByRole('row');
  const cell = screen.getByRole('gridcell');
  expect(getComputedStyle(cell).display).toBe('contents');
  const label = screen.getByText('Alpha').getBoundingClientRect();
  const remove = screen.getByRole('button', { name: 'Remove Alpha' }).getBoundingClientRect();
  const box = row.getBoundingClientRect();
  expect(remove.left).toBeGreaterThanOrEqual(label.right);
  expect(remove.top).toBeGreaterThanOrEqual(box.top);
  expect(remove.bottom).toBeLessThanOrEqual(box.bottom);
  expect(label.top).toBeGreaterThanOrEqual(box.top);
  expect(label.bottom).toBeLessThanOrEqual(box.bottom);
});
