import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorModeControl } from './ColorModeControl';

describe('ColorModeControl', () => {
  it('is a radiogroup named "Color mode" with Auto, Light and Dark', () => {
    render(<ColorModeControl value="auto" onChange={() => {}} />);
    const group = screen.getByRole('radiogroup', { name: 'Color mode' });
    const radios = group.querySelectorAll('[role="radio"]');
    expect([...radios].map((r) => r.getAttribute('aria-label'))).toEqual(['Auto', 'Light', 'Dark']);
  });

  it('draws each segment as its mode glyph', () => {
    render(<ColorModeControl value="auto" onChange={() => {}} />);
    for (const name of ['Auto', 'Light', 'Dark']) {
      expect(screen.getByRole('radio', { name }).querySelector('svg')).not.toBeNull();
    }
  });

  it('checks the current preference', () => {
    render(<ColorModeControl value="dark" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Auto' }).getAttribute('aria-checked')).toBe('false');
  });

  it('reports the chosen preference, auto included', () => {
    const onChange = vi.fn();
    render(<ColorModeControl value="dark" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(onChange).toHaveBeenCalledWith('auto');
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('takes its own accessible name and a className', () => {
    const { container } = render(
      <ColorModeControl value="auto" onChange={() => {}} ariaLabel="Theme" className="mine" />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    expect(container.querySelector('.mine')).not.toBeNull();
  });
});
