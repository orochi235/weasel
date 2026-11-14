import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';
import { RowScope } from './rowScope';

const slider = (readout?: string) => {
  const onChange = vi.fn();
  render(
    <RowScope auto={readout !== undefined} onAutoChange={() => {}}>
      <PropertyField
        kind="number"
        control="slider"
        label="Gap"
        value={12}
        min={0}
        max={48}
        onChange={onChange}
        readout={readout}
      />
    </RowScope>,
  );
  return onChange;
};

describe('an auto row draws its control live', () => {
  it('hands a slider the tab stop while its readout is a word, and edits it from there', () => {
    const onChange = slider('auto');
    const track = screen.getByRole('slider', { name: 'Gap' });
    expect(track).not.toHaveAttribute('tabindex', '-1');
    fireEvent.change(track, { target: { value: '30' } });
    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('leaves the tab stop with the editable readout on a pinned slider', () => {
    slider();
    expect(screen.getByRole('slider', { name: 'Gap' })).toHaveAttribute('tabindex', '-1');
  });
});
