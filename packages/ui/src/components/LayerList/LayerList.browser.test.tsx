import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { LayerList } from '@weasel-js/ui/components/LayerList';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

afterEach(cleanup);

test('a row\'s first gridcell adds no box, so its content lays out as the row\'s own', () => {
  renderWithIcons(
    <div style={{ width: 240 }}>
      <LayerList items={[{ id: 'a', label: 'Alpha' }]} onReorder={() => {}} onRemove={() => {}} />
    </div>,
  );
  const row = screen.getByRole('row');
  const cell = screen.getAllByRole('gridcell')[0]!;
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
