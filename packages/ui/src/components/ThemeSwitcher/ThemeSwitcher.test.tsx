import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSwitcher, type ThemeSwitcherOption } from './ThemeSwitcher';

describe('ThemeSwitcher', () => {
  it('names the current mode and what a click does', () => {
    render(<ThemeSwitcher value="auto" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Theme: Auto — click for Light' })).toBeTruthy();
  });

  it('shows only the current option, as a glyph', () => {
    render(<ThemeSwitcher value="dark" onChange={() => {}} />);
    const button = screen.getByRole('button', { name: /^Theme: Dark/ });
    expect(button.querySelectorAll('svg')).toHaveLength(1);
    expect(button).toHaveTextContent('');
  });

  it('rotates auto, light, dark in order', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ThemeSwitcher value="auto" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenLastCalledWith('light');
    rerender(<ThemeSwitcher value="light" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenLastCalledWith('dark');
  });

  it('wraps from the last option back to the first', () => {
    const onChange = vi.fn();
    render(<ThemeSwitcher value="dark" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Theme: Dark — click for Auto' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith('auto');
  });

  it('rotates backwards on a shift-click, wrapping too', () => {
    const onChange = vi.fn();
    render(<ThemeSwitcher value="auto" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'), { shiftKey: true });
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('is controlled: a click reports the next value and changes nothing itself', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ThemeSwitcher value="light" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(onChange.mock.calls).toEqual([['dark'], ['dark']]);
    expect(screen.getByRole('button', { name: /^Theme: Light/ })).toBeTruthy();
    rerender(<ThemeSwitcher value="dark" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /^Theme: Dark/ })).toBeTruthy();
  });

  it('cycles any option list, under its own name', () => {
    const options: ThemeSwitcherOption<'a' | 'b'>[] = [
      { value: 'a', icon: <svg data-testid="a" />, label: 'Alpha' },
      { value: 'b', icon: <svg data-testid="b" />, label: 'Beta' },
    ];
    const onChange = vi.fn();
    render(
      <ThemeSwitcher value="b" onChange={onChange} options={options} ariaLabel="Palette" className="mine" />,
    );
    const button = screen.getByRole('button', { name: 'Palette: Beta — click for Alpha' });
    expect(button.querySelector('[data-testid="b"]')).not.toBeNull();
    expect(button.className).toContain('mine');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('treats a value outside the list as the first option', () => {
    const onChange = vi.fn();
    render(<ThemeSwitcher value={'sepia' as 'auto'} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Theme: Auto — click for Light' }));
    expect(onChange).toHaveBeenCalledWith('light');
  });
});
