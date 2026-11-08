import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaletteLab } from './PaletteLab';
import { BUILTIN_PRESETS } from './presets';

describe('<PaletteLab> copy confirmations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const tokens = () => screen.getByRole('button', { name: /^(Copied|Copy as tokens)$/ });
  const preset = () =>
    screen.getByRole('button', { name: `Copy ${BUILTIN_PRESETS[0]!.name} as source` });

  it('a second token copy restarts the confirmation', () => {
    renderWithIcons(<PaletteLab />);
    fireEvent.click(tokens());
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(tokens());
    act(() => vi.advanceTimersByTime(1000));
    expect(tokens().textContent).toBe('Copied');
    act(() => vi.advanceTimersByTime(400));
    expect(tokens().textContent).toBe('Copy as tokens');
  });

  it('a second preset copy restarts the confirmation', () => {
    renderWithIcons(<PaletteLab />);
    fireEvent.click(preset());
    act(() => vi.advanceTimersByTime(800));
    fireEvent.click(preset());
    act(() => vi.advanceTimersByTime(800));
    expect(preset().textContent).toBe('✓');
    act(() => vi.advanceTimersByTime(400));
    expect(preset().textContent).toBe('⧉');
  });

  it('leaves no confirmation timer behind on unmount', () => {
    const { unmount } = renderWithIcons(<PaletteLab />);
    const before = vi.getTimerCount();
    fireEvent.click(tokens());
    fireEvent.click(preset());
    unmount();
    expect(vi.getTimerCount()).toBeLessThanOrEqual(before);
  });
});
