import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Disabled, ReadOnly } from '../Disabled';
import { DataGrid, type DataGridColumn, type DataGridProps } from './DataGrid';

type Row = { id: string; name: string };
const ROWS: Row[] = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }];
const COLUMNS: DataGridColumn<Row>[] = [{ id: 'name', header: 'Name' }];

function renderGrid(wrap: (node: ReactNode) => ReactNode, props: Partial<DataGridProps<Row>> = {}) {
  const calls = { onReorder: vi.fn(), onRowClick: vi.fn(), onExpandedChange: vi.fn() };
  render(
    <>
      {wrap(
        <DataGrid<Row>
          rows={ROWS} columns={COLUMNS} rowLabel={(r) => r.name} renderDetail={(r) => <p>{r.name} detail</p>}
          {...calls} {...props}
        />,
      )}
    </>,
  );
  return calls;
}

const sortedNames = () => screen.getAllByRole('row').slice(1).map((r) => r.textContent);

/** A press on a row, its disclosure, its handle by key, and the sort. */
function tryEverything() {
  fireEvent.click(screen.getByText('Alpha'));
  fireEvent.click(screen.getAllByRole('button', { name: 'Show details' })[0]!);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Drag to reorder Alpha' }), { key: 'ArrowDown', altKey: true });
  fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
}

describe('DataGrid held', () => {
  it('unheld, every press, toggle, move, and sort goes through', () => {
    const calls = renderGrid((n) => n);
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).toHaveBeenCalled();
    expect(sortedNames()[0]).toContain('Beta');
  });

  it('disabled with no reason refuses everything and takes its rows out of the tab order', () => {
    const calls = renderGrid((n) => n, { disabled: true });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(sortedNames()[0]).toContain('Alpha');
    expect(screen.getByText('Alpha').closest('tr')?.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('button', { name: /^Name/ })).toBeDisabled();
  });

  it('disabled for a reason refuses everything, keeps its rows reachable, and says why', () => {
    const calls = renderGrid((n) => n, { disabled: true, disabledReason: 'Loading' });
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    const row = screen.getByText('Alpha').closest('tr')!;
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row).toHaveAccessibleDescription('Loading');
    const sort = screen.getByRole('button', { name: /^Name/ });
    expect(sort).not.toBeDisabled();
    expect(sort.getAttribute('aria-disabled')).toBe('true');
  });

  it('read-only still activates, expands, and sorts, and moves nothing', () => {
    const calls = renderGrid((n) => <ReadOnly reason="Shared">{n}</ReadOnly>);
    tryEverything();
    expect(calls.onRowClick).toHaveBeenCalled();
    expect(calls.onExpandedChange).toHaveBeenCalled();
    expect(calls.onReorder).not.toHaveBeenCalled();
    expect(sortedNames()[0]).toContain('Beta');
    expect(screen.getByRole('button', { name: 'Drag to reorder Alpha' }).getAttribute('aria-disabled')).toBe('true');
  });

  it('nested scopes: the nearest reason wins, disabled={false} adds nothing, and disabled beats read-only', () => {
    const calls = renderGrid(
      (n) => <ReadOnly><Disabled reason="Locked"><Disabled reason="Busy">{n}</Disabled></Disabled></ReadOnly>,
      { disabled: false },
    );
    tryEverything();
    for (const fn of Object.values(calls)) expect(fn).not.toHaveBeenCalled();
    expect(screen.getByText('Alpha').closest('tr')).toHaveAccessibleDescription('Busy');
  });
});
