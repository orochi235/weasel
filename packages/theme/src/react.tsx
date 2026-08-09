import React, { createContext, useContext, useMemo, useRef, useLayoutEffect } from 'react';
import { applyTheme } from './applyTheme';
import { resolveTheme, type ResolvedTheme } from './resolveTheme';
import { weaselTheme, type Theme } from './theme';

export interface ThemeContextValue {
  readonly theme: Theme;
  readonly mode: string;
  readonly resolved: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly theme?: Theme;
  readonly mode?: string;
  readonly children: React.ReactNode;
}

/**
 * Applies a theme to a wrapper element and publishes the resolved record.
 *
 * Consumers that draw outside the DOM (the WebGL HUD) read `resolved` and
 * never touch `getComputedStyle`.
 */
export function ThemeProvider({
  theme = weaselTheme,
  mode,
  children,
}: ThemeProviderProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const effectiveMode = mode ?? theme.defaultMode;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode: effectiveMode, resolved: resolveTheme(theme, effectiveMode) }),
    [theme, effectiveMode],
  );

  useLayoutEffect(() => {
    if (ref.current) applyTheme(ref.current, theme, effectiveMode);
  }, [theme, effectiveMode]);

  return (
    <ThemeContext.Provider value={value}>
      <div ref={ref} data-wzl-theme={theme.name} data-wzl-mode={effectiveMode}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a <ThemeProvider>');
  return ctx;
}

/**
 * The theme if one is provided, `null` otherwise.
 *
 * For kit internals that should follow a theme when the app supplies one but
 * must still work in an app that never mounted a provider — `useHud` is the
 * motivating case.
 */
export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
