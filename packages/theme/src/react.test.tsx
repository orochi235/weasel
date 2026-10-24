import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { colorAt } from './colorList';
import { ThemeProvider, useColorCss, useColorHex, useTheme, useTints } from './react';
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

  it('holds its rule while mounted, across a re-render, and lets go of it on unmount', () => {
    const sheet = (): string =>
      (document.adoptedStyleSheets ?? []).flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join('\n')
      + (document.getElementById('wzl-themes')?.textContent ?? '');
    const theme = defineTheme({ name: 'held', pins: { 'color-accent': '#0a0b0c' } });
    const view = (mode: string) => <ThemeProvider theme={theme} selection={{ mode }}>x</ThemeProvider>;
    const { rerender, unmount } = render(view('light'));
    expect(sheet()).toContain("[data-wzl-mode='light']");
    rerender(view('dark'));
    expect(sheet()).toContain("[data-wzl-mode='dark']");
    expect(sheet()).not.toContain("[data-wzl-mode='light']");
    unmount();
    expect(sheet()).not.toContain('held');
  });

  it('throws when useTheme is used outside a provider', () => {
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
  });

  it('publishes the theme’s tints, and a tints prop overrides them for its subtree', () => {
    function Tint(): React.ReactElement {
      const ctx = useTints();
      return <span data-testid="t">{colorAt(ctx.tints, 1, ctx)}</span>;
    }
    const { rerender } = render(<Tint />);
    expect(screen.getByTestId('t').textContent).toBe('#48e628');
    rerender(
      <ThemeProvider tints={['#000', '#fff']}>
        <Tint />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('t').textContent).toBe('#fff');
  });

  it('resolves a color source against the theme, the tints, and a palette prop', () => {
    function Colors(): React.ReactElement {
      const css = useColorCss();
      const all = [css({ ref: 'accent' }), css({ ref: 'tint', index: 1 }), css({ ref: 'brand' }), css(undefined)];
      return <span data-testid="c">{all.map(String).join(' ')}</span>;
    }
    const { rerender } = render(<Colors />);
    expect(screen.getByTestId('c').textContent).toBe('var(--wzl-accent) var(--wzl-swatch-green) undefined undefined');
    rerender(
      <ThemeProvider tints={['#000', '#fff']} palette={{ entries: [{ name: 'brand', color: { space: 'srgb', coords: [1, 0, 0] } }] }}>
        <Colors />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('c').textContent).toBe('var(--wzl-accent) #fff #ff0000 undefined');
  });

  it('resolves a color source to the value a canvas can draw, in the mode in force', () => {
    function Colors(): React.ReactElement {
      const hex = useColorHex();
      const all = [hex({ ref: 'surface-sunken' }), hex({ ref: 'fg' }), hex({ ref: 'no-such-token' }), hex(undefined)];
      return <span data-testid="h">{all.map(String).join(' ')}</span>;
    }
    const at = (mode: string): string => {
      const { getByTestId, unmount } = render(
        <ThemeProvider selection={{ mode }}>
          <Colors />
        </ThemeProvider>,
      );
      const text = getByTestId('h').textContent ?? '';
      unmount();
      return text;
    };
    expect(at('dark')).toBe('#0e0f12 #e6e7e9 undefined undefined');
    expect(at('light')).toBe('#c9cbcf #0e0f12 undefined undefined');
  });
});
