import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { range, until, values } from '@weasel-js/ui-input';
import { Sequence } from './Sequence';

describe('Sequence', () => {
  it('renders a cell per step, captioned with the sweep’s label', () => {
    render(
      <Sequence label="Digits" sweep={range({ from: 0, to: 9, step: 1 })}>
        {(d) => <span data-digit={d}>{d}</span>}
      </Sequence>,
    );
    const list = screen.getByRole('list', { name: 'Digits' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(10);
    expect(items[3]!.querySelector('[data-digit="3"]')).not.toBeNull();
    expect(items[3]!.querySelector('figcaption')).toHaveTextContent('3');
  });

  it('takes its own caption, or none', () => {
    const { rerender } = render(
      <Sequence label="Sizes" sweep={values(['sm', 'lg'])} caption={(v) => `size ${v}`}>
        {() => <i />}
      </Sequence>,
    );
    expect(screen.getAllByRole('figure')[1]!.querySelector('figcaption')).toHaveTextContent('size lg');
    rerender(
      <Sequence label="Sizes" sweep={values(['sm', 'lg'])} caption={false}>
        {() => <i />}
      </Sequence>,
    );
    expect(document.querySelector('figcaption')).toBeNull();
  });

  it('caps a sweep that does not end, and says so', () => {
    render(
      <Sequence label="Evens" sweep={range({ from: 0, to: Infinity, step: 2 })} cap={4}>
        {(n) => n}
      </Sequence>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Showing the first 4 steps.')).toBeInTheDocument();
  });

  it('ends where `until` says, with no cap note', () => {
    render(
      <Sequence label="Squares" sweep={until(range({ from: 0, to: 9, step: 1 }), (n) => n * n > 10)}>
        {(n) => n * n}
      </Sequence>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByText(/Showing the first/)).toBeNull();
  });

  it('lays two sweeps out as a grid of every pairing, rows and columns labeled', () => {
    render(
      <Sequence label="Pairs" sweep={values(['a', 'b'])} across={range({ from: 1, to: 3, step: 1 })}>
        {(row, col) => `${row}${col}`}
      </Sequence>,
    );
    const grid = screen.getByRole('table', { name: 'Pairs' });
    expect(within(grid).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['1', '2', '3']);
    expect(within(grid).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['a', 'b']);
    expect(within(grid).getAllByRole('cell').map((c) => c.textContent)).toContain('b3');
  });
});
