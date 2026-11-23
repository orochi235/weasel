import { createRef } from 'react';
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

  it('renders disabled under its own name when the rotation is empty', () => {
    const onChange = vi.fn();
    renderWithIcons(<CycleButton value="a" onChange={onChange} options={[]} aria-label="Palette" />);
    const button = screen.getByRole('button', { name: 'Palette' });
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-disabled') === 'true' || (button as HTMLButtonElement).disabled).toBe(true);
  });

  it("runs a caller's onClick first, and a prevented one keeps the value", () => {
    const onChange = vi.fn();
    const { rerender } = renderWithIcons(
      <CycleButton value="auto" onChange={onChange} options={COLOR_MODE_OPTIONS} aria-label="Theme" onClick={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledOnce();
    rerender(
      <CycleButton value="auto" onChange={onChange} options={COLOR_MODE_OPTIONS} aria-label="Theme" onClick={(e) => e.preventDefault()} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('passes native attributes through and forwards its ref', () => {
    const ref = createRef<HTMLButtonElement>();
    renderWithIcons(
      <CycleButton ref={ref} value="auto" onChange={() => {}} options={COLOR_MODE_OPTIONS} aria-label="Theme" tabIndex={-1} aria-describedby="hint" />,
    );
    const button = screen.getByRole('button');
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute('tabindex', '-1');
    expect(button).toHaveAttribute('aria-describedby', 'hint');
    // @ts-expect-error the rotation draws the face
    void (<CycleButton value="auto" onChange={() => {}} options={COLOR_MODE_OPTIONS} aria-label="Theme">x</CycleButton>);
  });

  it('names no option as current for a value outside options, warns, and a click goes to the first', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = vi.fn();
    renderWithIcons(<CycleButton value={'stale' as ColorModePreference} onChange={onChange} options={COLOR_MODE_OPTIONS} aria-label="Theme" />);
    const button = screen.getByRole('button', { name: 'Theme — click for Auto' });
    expect(button.querySelectorAll('svg')).toHaveLength(0);
    fireEvent.click(button);
    expect(onChange).toHaveBeenLastCalledWith('auto');
    fireEvent.click(button, { shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith('dark');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"stale"'));
    warn.mockRestore();
  });

  it('stays quiet about a value outside options given allowUnlistedValue', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithIcons(<CycleButton value={'mixed' as ColorModePreference} onChange={() => {}} options={COLOR_MODE_OPTIONS} aria-label="Theme" allowUnlistedValue />);
    expect(screen.getByRole('button', { name: 'Theme — click for Auto' })).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
