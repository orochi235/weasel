import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { AnchorFieldValues } from '@weasel-js/core';
import { AnchorFields } from './AnchorFields';

function setup(values: AnchorFieldValues) {
  const write = vi.fn();
  render(<AnchorFields fields={{ values, write }} accepts={{ pt: 1, in: 72 }} emptyState={<em>No anchors</em>} />);
  const type = (name: string, text: string) => {
    const field = screen.getByRole('spinbutton', { name });
    fireEvent.change(field, { target: { value: text } });
    fireEvent.blur(field);
  };
  return { write, type };
}

describe('AnchorFields', () => {
  it('shows its empty state with no anchor selected', () => {
    setup({});
    expect(screen.getByText('No anchors')).toBeInTheDocument();
  });

  it('reads a field the anchors disagree on as Mixed, and takes a value or an offset for all of them', () => {
    const { write, type } = setup({ x: 40, y: null });
    expect(screen.getByRole('spinbutton', { name: 'X' })).toHaveValue('40');
    expect(screen.getByRole('spinbutton', { name: 'Y' })).toHaveAttribute('placeholder', 'Mixed');
    type('Y', '1in');
    expect(write).toHaveBeenLastCalledWith('y', { to: 72 });
    type('Y', '-=6');
    expect(write).toHaveBeenLastCalledWith('y', { by: -6 });
  });

  it("shows a lone anchor's handles as points, or as angle and length", () => {
    const { write, type } = setup({ x: 0, y: 0, outX: 10, outY: 0, outAngle: 0, outLength: 10 });
    expect(screen.getByRole('spinbutton', { name: 'Out X' })).toHaveValue('10');
    expect(screen.queryByRole('spinbutton', { name: 'In X' })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Angle / length' }));
    type('Out angle', '+=15');
    expect(write).toHaveBeenLastCalledWith('outAngle', { by: 15 });
  });
});
