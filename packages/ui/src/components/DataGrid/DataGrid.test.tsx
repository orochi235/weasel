import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataGrid } from './DataGrid';

interface Row { id: string; name: string; count: number }
const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', count: 3 },
  { id: 'b', name: 'Beta', count: 1 },
  { id: 'c', name: 'Gamma', count: 2 },
];
const COLUMNS = [
  { id: 'name', header: 'Name' },
  { id: 'count', header: 'Count' },
];

const ROW_H = 30;

/** Stub row geometry: header at y 0..30, then one 30px row each. */
function stubGeometry(container: HTMLElement): void {
  const rows = Array.from(container.querySelectorAll('tbody tr')) as HTMLElement[];
  rows.forEach((row, i) => {
    const top = (i + 1) * ROW_H;
    Object.defineProperty(row, 'getBoundingClientRect', {
      value: () => ({ x: 0, y: top, top, left: 0, right: 300, bottom: top + ROW_H, width: 300, height: ROW_H }) as unknown as DOMRect,
    });
  });
}

function pointer(type: string, y: number): PointerEvent {
  return new PointerEvent(type, { clientX: 20, clientY: y, bubbles: true, cancelable: true, pointerId: 1 });
}

describe('DataGrid sorting', () => {
  it('cycles a sortable header asc → desc → none from the keyboard', () => {
    render(<DataGrid<Row> rows={ROWS} columns={COLUMNS} />);
    const header = screen.getByRole('button', { name: /Name/ });
    const th = header.closest('th')!;
    expect(th).toHaveAttribute('aria-sort', 'none');
    fireEvent.click(header);
    expect(th).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(header);
    expect(th).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(header);
    expect(th).toHaveAttribute('aria-sort', 'none');
  });

  it('leaves a non-sortable column with no sort control and no aria-sort', () => {
    render(<DataGrid<Row> rows={ROWS} columns={[{ id: 'name', header: 'Name', sortable: false }]} />);
    expect(screen.queryByRole('button', { name: /Name/ })).toBeNull();
    expect(screen.getByRole('columnheader')).not.toHaveAttribute('aria-sort');
  });
});

describe('DataGrid reorder', () => {
  it('reports the drop index of the row the pointer is over', () => {
    const onReorder = vi.fn();
    const { container } = render(<DataGrid<Row> rows={ROWS} columns={COLUMNS} onReorder={onReorder} />);
    stubGeometry(container);
    const handles = container.querySelectorAll('tbody tr td:first-child');
    // Grab row 2 ('c', y 90..120) and drop it onto row 0 ('a', y 30..60).
    fireEvent(handles[2], pointer('pointerdown', 105));
    fireEvent(handles[2], pointer('pointermove', 45));
    fireEvent(handles[2], pointer('pointerup', 45));
    expect(onReorder).toHaveBeenCalledWith(['c'], 0);
  });

  it('reports items.length when the drop lands past the last row', () => {
    const onReorder = vi.fn();
    const { container } = render(<DataGrid<Row> rows={ROWS} columns={COLUMNS} onReorder={onReorder} />);
    stubGeometry(container);
    const handles = container.querySelectorAll('tbody tr td:first-child');
    fireEvent(handles[0], pointer('pointerdown', 45));
    fireEvent(handles[0], pointer('pointermove', 400));
    fireEvent(handles[0], pointer('pointerup', 400));
    expect(onReorder).toHaveBeenCalledWith(['a'], ROWS.length);
  });
});

describe('DataGrid row hooks', () => {
  it('adds rowClassName to each body row', () => {
    const { container } = render(
      <DataGrid<Row> rows={ROWS} columns={COLUMNS} rowClassName={(r) => (r.count > 1 ? `hot-${r.id}` : undefined)} />,
    );
    const trs = container.querySelectorAll('tbody tr');
    expect(trs[0]).toHaveClass('hot-a');
    expect(trs[1]).not.toHaveAttribute('class');
    expect(trs[2]).toHaveClass('hot-c');
  });

  it('calls onRowClick with the row, from a click or Enter/Space on the focused row', () => {
    const onRowClick = vi.fn();
    const { container } = render(<DataGrid<Row> rows={ROWS} columns={COLUMNS} onRowClick={onRowClick} />);
    const tr = container.querySelectorAll('tbody tr')[1] as HTMLElement;
    expect(tr).toHaveAttribute('tabindex', '0');
    expect(tr).not.toHaveAttribute('role');
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
    fireEvent.click(tr.querySelector('td')!);
    expect(onRowClick).toHaveBeenLastCalledWith(ROWS[1]);
    fireEvent.keyDown(tr, { key: 'Enter' });
    fireEvent.keyDown(tr, { key: ' ' });
    expect(onRowClick).toHaveBeenCalledTimes(3);
  });

  it('ignores clicks and keys that land on a control inside a cell', () => {
    const onRowClick = vi.fn();
    const columns = [{ id: 'name', header: 'Name', render: (r: Row) => <button type="button">{r.name}</button> }];
    render(<DataGrid<Row> rows={ROWS} columns={columns} onRowClick={onRowClick} />);
    const button = screen.getByRole('button', { name: 'Alpha' });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('leaves rows unfocusable without onRowClick', () => {
    const { container } = render(<DataGrid<Row> rows={ROWS} columns={COLUMNS} />);
    expect(container.querySelector('tbody tr')).not.toHaveAttribute('tabindex');
  });
});

describe('DataGrid detail rows', () => {
  const detail = (r: Row) => <span>detail {r.id}</span>;

  it('expands a full-width detail row under its row from the disclosure', () => {
    const { container } = render(<DataGrid<Row> rows={ROWS} columns={COLUMNS} renderDetail={detail} />);
    const toggle = screen.getAllByRole('button', { name: 'Show details' })[1]!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('detail b')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const cell = screen.getByText('detail b').closest('td')!;
    expect(cell).toHaveAttribute('colspan', String(COLUMNS.length + 1));
    const detailRow = cell.closest('tr')!;
    expect(toggle).toHaveAttribute('aria-controls', detailRow.id);
    const trs = Array.from(container.querySelectorAll('tbody tr'));
    expect(trs.indexOf(detailRow)).toBe(2);
    expect(trs[1]).toHaveAttribute('data-expanded', 'true');
  });

  it('follows controlled expandedIds and reports toggles through onExpandedChange', () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <DataGrid<Row> rows={ROWS} columns={COLUMNS} renderDetail={detail} expandedIds={new Set(['a'])} onExpandedChange={onExpandedChange} />,
    );
    expect(screen.getByText('detail a')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /details/ })[2]!);
    expect(onExpandedChange).toHaveBeenCalledWith(new Set(['a', 'c']));
    expect(screen.queryByText('detail c')).toBeNull();
    rerender(<DataGrid<Row> rows={ROWS} columns={COLUMNS} renderDetail={detail} expandedIds={new Set(['c'])} />);
    expect(screen.queryByText('detail a')).toBeNull();
    expect(screen.getByText('detail c')).toBeInTheDocument();
  });

  it('keeps each detail row under its parent when sorted', () => {
    const { container } = render(
      <DataGrid<Row> rows={ROWS} columns={COLUMNS} renderDetail={detail} defaultExpandedIds={['a', 'b']} defaultSort={{ columnId: 'count', direction: 'asc' }} />,
    );
    const text = Array.from(container.querySelectorAll('tbody tr')).map((tr) => tr.textContent);
    expect(text).toEqual(['Beta1', 'detail b', 'Gamma2', 'Alpha3', 'detail a']);
  });

  it('offers no disclosure on rows rowExpandable rejects, and renders nothing when renderDetail returns null', () => {
    render(
      <DataGrid<Row>
        rows={ROWS}
        columns={COLUMNS}
        renderDetail={(r) => (r.id === 'c' ? null : detail(r))}
        rowExpandable={(r) => r.id !== 'b'}
        defaultExpandedIds={['a', 'b', 'c']}
      />,
    );
    expect(screen.getAllByRole('button', { name: /details/ })).toHaveLength(2);
    expect(screen.getByText('detail a')).toBeInTheDocument();
    expect(screen.queryByText('detail b')).toBeNull();
    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 2);
  });

  it('measures drop indices against data rows only, skipping open detail rows', () => {
    const onReorder = vi.fn();
    const { container } = render(
      <DataGrid<Row> rows={ROWS} columns={COLUMNS} onReorder={onReorder} renderDetail={detail} defaultExpandedIds={['a']} />,
    );
    // Rows in the DOM: a, detail a, b, c. Stub only the data rows' geometry.
    const dataRows = Array.from(container.querySelectorAll('tbody tr')).filter((tr) => !tr.id);
    dataRows.forEach((row, i) => {
      const top = (i + 1) * ROW_H;
      Object.defineProperty(row, 'getBoundingClientRect', {
        value: () => ({ x: 0, y: top, top, left: 0, right: 300, bottom: top + ROW_H, width: 300, height: ROW_H }) as unknown as DOMRect,
      });
    });
    const detailRow = container.querySelector('tbody tr[id]')!;
    Object.defineProperty(detailRow, 'getBoundingClientRect', {
      value: () => ({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 0, width: 300, height: 0 }) as unknown as DOMRect,
    });
    const handle = dataRows[2]!.querySelector('td')!;
    fireEvent(handle, pointer('pointerdown', 105));
    fireEvent(handle, pointer('pointermove', 75));
    fireEvent(handle, pointer('pointerup', 75));
    expect(onReorder).toHaveBeenCalledWith(['c'], 1);
  });
});
