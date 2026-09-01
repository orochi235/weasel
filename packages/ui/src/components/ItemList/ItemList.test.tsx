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
});
