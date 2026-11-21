import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeDemo } from '../ThemeDemo';

afterEach(cleanup);

const token = (name: string) => screen.getByRole('rowheader', { name }).nextElementSibling!.textContent;

describe('ThemeDemo', () => {
  it('pins the whole accent ramp, so the hover shade follows the picked accent too', () => {
    render(<ThemeDemo />);
    expect(token('--wzl-accent')).toBe('#e0457b');
    expect(token('--wzl-accent-hover')).toContain('#e0457b');
  });

  it('resolves its tokens again when the mode changes', () => {
    const { container } = render(<ThemeDemo />);
    expect(container.querySelector('[data-wzl-mode="light"]')).not.toBeNull();
    const light = token('--wzl-surface');
    fireEvent.click(screen.getByRole('radio', { name: 'dark' }));
    expect(container.querySelector('[data-wzl-mode="dark"]')).not.toBeNull();
    expect(token('--wzl-surface')).not.toBe(light);
  });
});
