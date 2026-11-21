import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, test } from 'vitest';
import { DataGrid } from '@weasel-js/ui/components/DataGrid';

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

test('the empty state is centered, and the disclosure column centers its control with no inline padding', () => {
  const { unmount } = render(<DataGrid<Row> rows={[]} columns={[{ id: 'name', header: 'Name' }]} rowLabel={(r) => r.name} />);
  const empty = screen.getByText('—');
  expect(getComputedStyle(empty).textAlign).toBe('center');
  unmount();
  render(
    <DataGrid<Row>
      rows={ROWS}
      columns={[{ id: 'name', header: 'Name' }]}
      rowLabel={(r) => r.name}
      renderDetail={(r) => r.name}
    />,
  );
  const head = screen.getByText('Details').closest('th')!;
  for (const cell of [head, ...document.querySelectorAll('tbody tr:first-child td:first-child')]) {
    expect(getComputedStyle(cell).textAlign).toBe('center');
    expect(getComputedStyle(cell).paddingLeft).toBe('0px');
  }
});
