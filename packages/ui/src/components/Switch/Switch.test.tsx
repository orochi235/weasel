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
    expect(onChange).toHaveBeenCalledWith(true);
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
    render(<Switch isDisabled>x</Switch>);
    expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(true);
  });

  it('renders the label children', () => {
    render(<Switch>Visible</Switch>);
    expect(screen.getByText('Visible')).toBeTruthy();
  });
});
