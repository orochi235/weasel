import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataGrid } from './DataGrid';

// jsdom omits PointerEvent.
if (typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
  class PolyfillPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  (globalThis as { PointerEvent?: unknown }).PointerEvent = PolyfillPointerEvent;
}

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
