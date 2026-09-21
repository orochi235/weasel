import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { colorAt } from './colorList';
import { ThemeProvider, useTheme, useTones } from './react';
import { defineTheme } from './theme';

function Probe(): React.ReactElement {
  const { resolved, selection, theme } = useTheme();
  return <span data-testid="p">{`${theme.name}/${selection.mode}/${resolved['--wzl-surface']}`}</span>;
}

describe('ThemeProvider', () => {
  it('provides the resolved theme to descendants', () => {
    render(
      <ThemeProvider selection={{ mode: 'light' }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('weasel/light/#f5f5f6');
  });

  it('applies to its own wrapper element', () => {
    const { container } = render(
      <ThemeProvider selection={{ mode: 'light' }}>
        <span />
      </ThemeProvider>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('carries a custom theme through', () => {
    const acme = defineTheme({ name: 'acme', pins: { surface: '#123456' } });
    render(
      <ThemeProvider theme={acme} selection={{ mode: 'dark' }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('acme/dark/#123456');
  });

  it('defaults to the built-in theme and its default mode', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('weasel/dark/#181a1e');
  });

  it('throws when useTheme is used outside a provider', () => {
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
  });

  it('publishes the theme’s tones, and a tones prop overrides them for its subtree', () => {
    function Tone(): React.ReactElement {
      const ctx = useTones();
      return <span data-testid="t">{colorAt(ctx.tones, 1, ctx)}</span>;
    }
    const { rerender } = render(<Tone />);
    expect(screen.getByTestId('t').textContent).toBe('#48e628');
    rerender(
      <ThemeProvider tones={['#000', '#fff']}>
        <Tone />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('t').textContent).toBe('#fff');
  });
});
