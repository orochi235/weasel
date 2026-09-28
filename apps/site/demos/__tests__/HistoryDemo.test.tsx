import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HistoryDemo } from '../HistoryDemo';

afterEach(cleanup);

describe('HistoryDemo', () => {
  it('shows a merged recolor as one entry with its push count, in the main stack and in a session', () => {
    render(<HistoryDemo />);
    const slider = screen.getByRole('slider');
    for (const hue of [40, 60, 80]) fireEvent.change(slider, { target: { value: String(hue) } });
    expect(screen.getAllByText('Recolor c1')).toHaveLength(1);
    expect(screen.getByText('×3')).toBeTruthy();

    fireEvent.click(screen.getByText('Begin edit session'));
    for (const hue of [100, 120]) fireEvent.change(slider, { target: { value: String(hue) } });
    expect(screen.getByText('×2')).toBeTruthy();
  });

  it('re-renders on undo through the subscription', () => {
    render(<HistoryDemo />);
    fireEvent.click(screen.getByText('Add'));
    expect(screen.getByText('Add c5')).toBeTruthy();
    fireEvent.click(screen.getByText('Undo'));
    expect(screen.getByText('nothing to undo')).toBeTruthy();
  });
});
