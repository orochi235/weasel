import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyField } from './PropertyField';

describe('PropertyField color with an apart alpha, after a canceled drag', () => {
  it('commits only the half the next gesture moved', () => {
    const onChange = vi.fn();
    const onAlphaChange = vi.fn();
    const onCancel = vi.fn();
    render(
      <PropertyField
        kind="color"
        label="Tint"
        value="#336699"
        alpha={0.5}
        onInput={() => {}}
        onChange={onChange}
        onCancel={onCancel}
        onAlphaInput={() => {}}
        onAlphaChange={onAlphaChange}
      />,
    );
    const track = screen.getByRole('slider', { name: 'Tint opacity' });
    fireEvent.input(track, { target: { value: '25' } });
    fireEvent.keyDown(track, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    const swatch = screen.getByLabelText('Tint', { selector: 'input[type="color"]' });
    fireEvent.input(swatch, { target: { value: '#00ff00' } });
    act(() => { swatch.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(onChange.mock.calls).toEqual([['#00ff00']]);
    expect(onAlphaChange).not.toHaveBeenCalled();
  });
});
