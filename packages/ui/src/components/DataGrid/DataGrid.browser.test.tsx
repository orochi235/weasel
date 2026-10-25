import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { DataGrid } from './DataGrid';

afterEach(cleanup);

interface Row { id: string; name: string }
const ROWS: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

function Grid({ tall = false }: { tall?: boolean }) {
  const [rows, setRows] = useState(ROWS);
  return (
    <DataGrid<Row>
      rows={rows}
      columns={[{ id: 'name', header: 'Name', sortable: false, render: (r) => (tall ? <p>{r.name}<br />second line</p> : r.name) }]}
      rowLabel={(r) => r.name}
      onReorder={(ids, target) => {
        const moved = rows.filter((r) => ids.includes(r.id));
        const before = rows.slice(0, target).filter((r) => !ids.includes(r.id));
        const after = rows.slice(target).filter((r) => !ids.includes(r.id));
        setRows([...before, ...moved, ...after]);
      }}
    />
  );
}

const order = () => screen.getAllByRole('button', { name: /^Drag to reorder / }).map((b) => b.getAttribute('aria-label'));

test('a handle fills its cell, in a row its own content does not set the height of', () => {
  render(<Grid tall />);
  const handle = screen.getByRole('button', { name: 'Drag to reorder Alpha' });
  const cell = handle.closest('td')!;
  const name = cell.nextElementSibling!;
  const h = handle.getBoundingClientRect();
  const c = cell.getBoundingClientRect();
  expect(c.height).toBeGreaterThan(40);
  expect(Math.abs(h.height - c.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(h.width - c.width)).toBeLessThan(1);
  expect(c.width).toBeLessThan(name.getBoundingClientRect().width / 4);
});

test('Alt+Arrow on a focused handle moves the row and keeps focus on it', async () => {
  render(<Grid />);
  const handle = screen.getByRole('button', { name: 'Drag to reorder Alpha' });
  handle.focus();
  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
  expect(order()).toEqual(['Drag to reorder Beta', 'Drag to reorder Alpha', 'Drag to reorder Gamma']);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Drag to reorder Alpha' }));
  await userEvent.keyboard('{Alt>}{ArrowDown}{ArrowUp}{ArrowUp}{/Alt}');
  expect(order()).toEqual(['Drag to reorder Alpha', 'Drag to reorder Beta', 'Drag to reorder Gamma']);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Drag to reorder Alpha' }));
});
