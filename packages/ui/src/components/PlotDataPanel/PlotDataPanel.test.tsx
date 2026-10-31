import type { PieData, PlotData, TimelineData } from '@weasel-js/plot';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PlotDataPanel } from './PlotDataPanel';

function Host({ initial, onChange }: { initial: PlotData; onChange?: (next: PlotData, label: string) => void }) {
  const [data, setData] = useState(initial);
  return <PlotDataPanel data={data} onChange={(next, label) => { setData(next); onChange?.(next, label); }} />;
}

const PIE: PieData = { kind: 'pie', slices: [{ label: 'Dogs', value: 3 }, { label: 'Cats', value: 2 }] };

describe('PlotDataPanel', () => {
  it('authors a pie from nothing: adds slices and names them', () => {
    const onChange = vi.fn();
    render(<Host initial={{ kind: 'pie', slices: [] }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add slice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add slice' }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'pie', slices: [{ label: 'Slice 1', value: 1 }, { label: 'Slice 2', value: 1 }] }, 'Add slice');
    const label = screen.getByRole('textbox', { name: 'Label of Slice 2' });
    fireEvent.change(label, { target: { value: 'Fish' } });
    fireEvent.blur(label);
    expect(onChange.mock.lastCall![0].slices[1]).toEqual({ label: 'Fish', value: 1 });
  });

  it('removes a row and sets a chart field', () => {
    const onChange = vi.fn();
    render(<Host initial={PIE} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Dogs' }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'pie', slices: [{ label: 'Cats', value: 2 }] }, 'Remove slice');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show values' }));
    expect(onChange.mock.lastCall![0]).toMatchObject({ showData: true });
  });

  it('opens a row onto the tables it holds', () => {
    const onChange = vi.fn();
    const timeline: TimelineData = { kind: 'timeline', sections: [{ name: 'Early', periods: [{ label: '2001', events: [] }] }] };
    render(<Host initial={timeline} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add period' }));
    expect(onChange.mock.lastCall![0].sections[0].periods).toEqual([{ label: '2001', events: [] }, { label: 'Period 2', events: [] }]);
  });
});
