import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from './react';
import { defineTheme } from './theme';

function Probe(): React.ReactElement {
  const { resolved, mode, theme } = useTheme();
  return <span data-testid="p">{`${theme.name}/${mode}/${resolved['--wzl-surface']}`}</span>;
}

describe('ThemeProvider', () => {
  it('provides the resolved theme to descendants', () => {
    render(
      <ThemeProvider mode="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('weasel/light/#f5f5f6');
  });

  it('applies to its own wrapper element', () => {
    const { container } = render(
      <ThemeProvider mode="light">
        <span />
      </ThemeProvider>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('carries a custom theme through', () => {
    const acme = defineTheme({ name: 'acme', tokens: { surface: '#123456' }, modes: {} });
    render(
      <ThemeProvider theme={acme} mode="dark">
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
});
