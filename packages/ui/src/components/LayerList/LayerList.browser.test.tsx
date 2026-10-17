import '@weasel-js/theme/tokens.css';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { LayerList } from './LayerList';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

test('a row\'s gridcell adds no box, so its content lays out as the row\'s own', () => {
  renderWithIcons(
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

test('a run of rows among cards adds no box, so its rows keep the level\'s spacing', () => {
  renderWithIcons(
    <LayerList
      label="Fills"
      items={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }, { id: 'c', label: 'Gamma' }, { id: 'd', label: 'Delta' }]}
      renderBody={(item) => (item.id === 'a' || item.id === 'd' ? <p>body</p> : null)}
      onReorder={() => {}}
    />,
  );
  const grid = screen.getByRole('treegrid', { name: 'Fills' });
  expect(getComputedStyle(grid).display).toBe('contents');
  const [beta, gamma] = screen.getAllByRole('row').map((r) => r.getBoundingClientRect());
  const cardAbove = screen.getByRole('button', { name: 'Drag to reorder Alpha' }).closest('[class*="entry"]')!.getBoundingClientRect();
  const cardBelow = screen.getByRole('button', { name: 'Drag to reorder Delta' }).closest('[class*="entry"]')!.getBoundingClientRect();
  expect(beta.height).toBeGreaterThan(10);
  const gap = beta.top - cardAbove.bottom;
  expect(gap).toBeGreaterThan(0);
  expect(gamma.top - beta.bottom).toBeCloseTo(gap, 0);
  expect(cardBelow.top - gamma.bottom).toBeCloseTo(gap, 0);
});
