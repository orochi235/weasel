import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { Switch } from './Switch';

describe('Switch', () => {
  it('toggles selected state on click', () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange}>Wifi</Switch>);
    const sw = screen.getByRole('switch') as HTMLInputElement;
    expect(sw.checked).toBe(false);
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true, { alt: false });
  });

  it('says whether Alt was held as it changed', () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange}>x</Switch>);
    fireEvent.click(screen.getByRole('switch'), { altKey: true });
    expect(onChange).toHaveBeenCalledWith(true, { alt: true });
  });

  it('supports controlled value', () => {
    function Wrap() {
      const [v, setV] = useState(false);
      return <Switch isSelected={v} onChange={setV}>x</Switch>;
    }
    render(<Wrap />);
    const sw = screen.getByRole('switch') as HTMLInputElement;
    fireEvent.click(sw);
    expect(sw.checked).toBe(true);
  });

  it('marks the underlying input as disabled', () => {
    render(<Switch disabled>x</Switch>);
    expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(true);
  });

  it('renders the label children', () => {
    render(<Switch>Visible</Switch>);
    expect(screen.getByText('Visible')).toBeTruthy();
  });

  it('draws and announces a mixed state, and drops it when no longer indeterminate', () => {
    const { rerender } = render(<Switch indeterminate>Snap</Switch>);
    // A switch has no mixed state in ARIA, so a mixed one speaks as a checkbox.
    const sw = screen.getByRole('checkbox');
    expect(sw).toHaveAttribute('aria-checked', 'mixed');
    expect(sw.closest('label')).toHaveAttribute('data-indeterminate');
    rerender(<Switch>Snap</Switch>);
    expect(sw).toHaveAttribute('role', 'switch');
    expect(sw).not.toHaveAttribute('aria-checked');
    expect(sw.closest('label')).not.toHaveAttribute('data-indeterminate');
  });

  it('turns on from a click while indeterminate, whatever isSelected holds', () => {
    const onChange = vi.fn();
    render(<Switch indeterminate isSelected onChange={onChange}>Snap</Switch>);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true, { alt: false });
  });
});
