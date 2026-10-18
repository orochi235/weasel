import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from './react';

type Listener = (e: { matches: boolean }) => void;

function fakeSystem(light: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: light,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mq));
  return (next: boolean) => {
    mq.matches = next;
    for (const l of [...listeners]) l({ matches: next });
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const modeOf = (c: HTMLElement) => (c.firstElementChild as HTMLElement).getAttribute('data-wzl-mode');

describe('ThemeProvider mode selection', () => {
  it("resolves mode 'auto' against the OS setting and follows it", () => {
    const flip = fakeSystem(true);
    const { container } = render(<ThemeProvider selection={{ mode: 'auto' }}>x</ThemeProvider>);
    expect(modeOf(container)).toBe('light');
    act(() => flip(false));
    expect(modeOf(container)).toBe('dark');
  });

  it("warns once on a value the theme's axis does not have", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<ThemeProvider selection={{ mode: 'sepia' }}>x</ThemeProvider>);
    rerender(<ThemeProvider selection={{ mode: 'sepia' }}>y</ThemeProvider>);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/mode.*sepia/);
  });

  it('does not warn on a value the theme has', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fakeSystem(false);
    render(<ThemeProvider selection={{ mode: 'light' }}>x</ThemeProvider>);
    render(<ThemeProvider selection={{ mode: 'auto' }}>x</ThemeProvider>);
    expect(warn).not.toHaveBeenCalled();
  });
});
