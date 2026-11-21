import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { UnitField } from './UnitField';

describe('UnitField wheel', () => {
  function wheel(field: HTMLElement, deltaY: number): boolean {
    const e = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    act(() => { field.dispatchEvent(e); });
    return e.defaultPrevented;
  }

  it('leaves the page to scroll when the focused field cannot step', () => {
    const onChange = vi.fn();
    const { rerender } = render(<UnitField value={5} readOnly onChange={onChange} aria-label="Width" />);
    const field = screen.getByRole('spinbutton', { name: 'Width' });
    field.focus();
    expect(wheel(field, -1)).toBe(false);
    rerender(<UnitField value={10} maxValue={10} onChange={onChange} aria-label="Width" />);
    expect(wheel(field, -1)).toBe(false);
    expect(wheel(field, 1)).toBe(true);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(9);
  });
});
