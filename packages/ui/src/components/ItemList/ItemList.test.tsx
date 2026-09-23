import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ItemList } from './ItemList';

afterEach(() => { cleanup(); });

describe('ItemList', () => {
  it('renders a row per item, in order', () => {
    render(<ItemList rows={[{ id: 'a', label: 'One' }, { id: 'b', label: 'Two' }]} />);
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('shows the empty slot instead of rows when there are none', () => {
    render(<ItemList rows={[]} empty="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('falls back to a dash when nothing is given for empty', () => {
    render(<ItemList rows={[]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('puts leading content before the label', () => {
    render(<ItemList rows={[{
      id: 'a', label: 'Layer', leading: <span data-testid="swatch" />,
    }]} />);
    const swatch = screen.getByTestId('swatch');
    const label = screen.getByText('Layer');
    // `compareDocumentPosition` returns FOLLOWING when the argument comes after.
    expect(swatch.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('spreads a row\'s own props onto its element', () => {
    const onClick = vi.fn();
    render(<ItemList rows={[{
      id: 'a', label: 'Row', rowProps: { onClick, 'data-row-index': 3 },
    }]} />);
    const row = screen.getByText('Row').parentElement!;
    expect(row).toHaveAttribute('data-row-index', '3');
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders the overlay inside the container, before the rows', () => {
    render(<ItemList
      rows={[{ id: 'a', label: 'Row' }]}
      overlay={<div data-testid="drop" />}
    />);
    expect(screen.getByTestId('drop')).toBeInTheDocument();
  });

  it('drops the overlay when there are no rows — there is nothing to drop onto', () => {
    render(<ItemList rows={[]} overlay={<div data-testid="drop" />} />);
    expect(screen.queryByTestId('drop')).toBeNull();
  });

  describe('drop indicator', () => {
    const css = readFileSync(resolve(__dirname, 'ItemList.module.css'), 'utf8');
    const ROWS = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
    const rowOf = (label: string) => screen.getByText(label).parentElement!;
    const marks = () => ['A', 'B', 'C'].map((l) => rowOf(l).getAttribute('data-drop'));

    it('marks no row while there is no drop index', () => {
      render(<ItemList rows={ROWS} dropIndex={null} />);
      expect(marks()).toEqual([null, null, null]);
    });

    it('marks the seam above the row at the index', () => {
      render(<ItemList rows={ROWS} dropIndex={1} />);
      expect(marks()).toEqual([null, 'before', null]);
    });

    it('marks the top of the list at 0', () => {
      render(<ItemList rows={ROWS} dropIndex={0} />);
      expect(marks()).toEqual(['before', null, null]);
    });

    it('marks the seam below the last row at rows.length', () => {
      render(<ItemList rows={ROWS} dropIndex={3} />);
      expect(marks()).toEqual([null, null, 'after']);
    });

    it('adds no element to the list, so a drag measuring its rows needs no selector', () => {
      const { container } = render(<ItemList rows={ROWS} dropIndex={1} />);
      expect(container.firstElementChild!.children).toHaveLength(3);
    });

    it('draws the seam from the row itself, with no measured offset', () => {
      expect(css).toMatch(/\.row\[data-drop='before'\]\s*\{[^}]*box-shadow:[^;]*var\(--wzl-accent\)/);
      expect(css).toMatch(/\.row\[data-drop='after'\]\s*\{[^}]*box-shadow:[^;]*var\(--wzl-accent\)/);
    });

    it("dims a row that is being dragged", () => {
      render(<ItemList rows={[{ id: 'a', label: 'A', dragging: true }, { id: 'b', label: 'B' }]} />);
      expect(rowOf('A').getAttribute('data-dragging')).toBe('true');
      expect(rowOf('B').getAttribute('data-dragging')).toBeNull();
      expect(css).toMatch(/\.row\[data-dragging\]\s*\{[^}]*opacity/);
    });
  });
});
