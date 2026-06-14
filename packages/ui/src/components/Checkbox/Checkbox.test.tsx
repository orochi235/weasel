import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('toggles selected state on click', () => {
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange}>Snap to grid</Checkbox>);
    const cb = screen.getByRole('checkbox') as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('supports controlled value', () => {
    function Wrap() {
      const [v, setV] = useState(false);
      return <Checkbox isSelected={v} onChange={setV}>x</Checkbox>;
    }
    render(<Wrap />);
    const cb = screen.getByRole('checkbox') as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
  });

  it('renders the label children', () => {
    render(<Checkbox>Visible</Checkbox>);
    expect(screen.getByText('Visible')).toBeTruthy();
  });

  it('marks the underlying input as disabled', () => {
    render(<Checkbox isDisabled>x</Checkbox>);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });

  it('sets indeterminate on the underlying input', () => {
    render(<Checkbox isIndeterminate>x</Checkbox>);
    expect((screen.getByRole('checkbox') as HTMLInputElement).indeterminate).toBe(true);
  });
});
