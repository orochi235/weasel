import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import type { ColorModePreference } from '@weasel-js/theme';
import { renderWithIcons } from '../../testing/withIcons';
import { CycleButton, COLOR_MODE_OPTIONS, type CycleButtonOption } from './CycleButton';

function Mode({ value, onChange }: { value: ColorModePreference; onChange: (next: ColorModePreference) => void }) {
  return <CycleButton value={value} onChange={onChange} options={COLOR_MODE_OPTIONS} aria-label="Theme" />;
}

describe('CycleButton', () => {
  it('names the current option and what a click does', () => {
    renderWithIcons(<Mode value="auto" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Theme: Auto — click for Light' })).toBeTruthy();
  });

  it('shows only the current option, as a glyph', () => {
    renderWithIcons(<Mode value="dark" onChange={() => {}} />);
    const button = screen.getByRole('button', { name: /^Theme: Dark/ });
    expect(button.querySelectorAll('svg')).toHaveLength(1);
    expect(button).toHaveTextContent('');
  });

  it('rotates the color modes auto, light, dark in order', () => {
    const onChange = vi.fn();
    const { rerender } = renderWithIcons(<Mode value="auto" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenLastCalledWith('light');
    rerender(<Mode value="light" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenLastCalledWith('dark');
  });

  it('wraps from the last option back to the first', () => {
    const onChange = vi.fn();
    renderWithIcons(<Mode value="dark" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Theme: Dark — click for Auto' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith('auto');
  });

  it('rotates backwards on a shift-click, wrapping too', () => {
    const onChange = vi.fn();
    renderWithIcons(<Mode value="auto" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'), { shiftKey: true });
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('is controlled: a click reports the next value and changes nothing itself', () => {
    const onChange = vi.fn();
    const { rerender } = renderWithIcons(<Mode value="light" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(onChange.mock.calls).toEqual([['dark'], ['dark']]);
    expect(screen.getByRole('button', { name: /^Theme: Light/ })).toBeTruthy();
    rerender(<Mode value="dark" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /^Theme: Dark/ })).toBeTruthy();
  });

  it('cycles any option list, under its own name', () => {
    const options: CycleButtonOption<'a' | 'b'>[] = [
      { value: 'a', icon: <svg data-testid="a" />, label: 'Alpha' },
      { value: 'b', icon: <svg data-testid="b" />, label: 'Beta' },
    ];
    const onChange = vi.fn();
    renderWithIcons(
      <CycleButton value="b" onChange={onChange} options={options} aria-label="Palette" className="mine" />,
    );
    const button = screen.getByRole('button', { name: 'Palette: Beta — click for Alpha' });
    expect(button.querySelector('[data-testid="b"]')).not.toBeNull();
    expect(button.className).toContain('mine');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('treats a value outside the list as the first option', () => {
    const onChange = vi.fn();
    renderWithIcons(<Mode value={'sepia' as 'auto'} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Theme: Auto — click for Light' }));
    expect(onChange).toHaveBeenCalledWith('light');
  });
});
