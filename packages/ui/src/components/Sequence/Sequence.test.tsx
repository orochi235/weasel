import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rangeSweep, sweepUntil, valuesSweep } from '@weasel-js/ui-input';
import { Sequence } from './Sequence';

describe('Sequence', () => {
  it('renders a cell per step, captioned with the sweep’s label', () => {
    render(
      <Sequence aria-label="Digits" sweep={rangeSweep({ from: 0, to: 9, step: 1 })}>
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
      <Sequence aria-label="Sizes" sweep={valuesSweep(['sm', 'lg'])} caption={(v) => `size ${v}`}>
        {() => <i />}
      </Sequence>,
    );
    expect(screen.getAllByRole('figure')[1]!.querySelector('figcaption')).toHaveTextContent('size lg');
    rerender(
      <Sequence aria-label="Sizes" sweep={valuesSweep(['sm', 'lg'])} caption={false}>
        {() => <i />}
      </Sequence>,
    );
    expect(document.querySelector('figcaption')).toBeNull();
  });

  it('caps a sweep that does not end, and says so', () => {
    render(
      <Sequence aria-label="Evens" sweep={rangeSweep({ from: 0, to: Infinity, step: 2 })} cap={4}>
        {(n) => n}
      </Sequence>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('Showing the first 4 steps.')).toBeInTheDocument();
  });

  it('ends where `sweepUntil` says, with no cap note', () => {
    render(
      <Sequence aria-label="Squares" sweep={sweepUntil(rangeSweep({ from: 0, to: 9, step: 1 }), (n) => n * n > 10)}>
        {(n) => n * n}
      </Sequence>,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryByText(/Showing the first/)).toBeNull();
  });

  it('lays two sweeps out as a grid of every pairing, rows and columns labeled', () => {
    render(
      <Sequence aria-label="Pairs" sweep={valuesSweep(['a', 'b'])} across={rangeSweep({ from: 1, to: 3, step: 1 })}>
        {(row, col) => `${row}${col}`}
      </Sequence>,
    );
    const grid = screen.getByRole('table', { name: 'Pairs' });
    expect(within(grid).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['1', '2', '3']);
    expect(within(grid).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['a', 'b']);
    expect(within(grid).getAllByRole('cell').map((c) => c.textContent)).toContain('b3');
  });
});
