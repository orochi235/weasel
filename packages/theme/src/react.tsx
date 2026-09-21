import React, { createContext, useContext, useMemo, useRef, useLayoutEffect } from 'react';
import { applyTheme } from './applyTheme';
import { themeTones, type ColorList } from './colorList';
import { fullSelection, selectionKey, type Selection } from './axes';
import { resolveTheme, themeAxes, type ResolvedTheme } from './resolveTheme';
import { weaselTheme, type Theme } from './theme';

/** What `<ThemeProvider>` publishes: the theme, the full selection in force, the
 *  fully resolved token record for that pair, and the tone list in force. */
export interface ThemeContextValue {
  readonly theme: Theme;
  readonly selection: Selection;
  readonly resolved: ResolvedTheme;
  readonly tones: ColorList;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Props for `<ThemeProvider>`. */
export interface ThemeProviderProps {
  readonly theme?: Theme;
  /** Axis values, e.g. `{ mode: 'light' }`. A missing axis takes its default. */
  readonly selection?: Selection;
  /** The colors a `tone` index picks from in this subtree. Absent: the theme's own. */
  readonly tones?: ColorList;
  /** Applied to the wrapper element, so it can be the layout element too. */
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly children: React.ReactNode;
}

/**
 * Applies a theme to a wrapper element and publishes the resolved record.
 *
 * Consumers that draw outside the DOM (the WebGL HUD) read `resolved` and
 * never touch `getComputedStyle`.
 *
 * The wrapper is a real element in the layout. Pass `className` rather than
 * nesting your own div inside — an anonymous div between a flex parent and
 * its child breaks percentage heights.
 */
export function ThemeProvider({
  theme = weaselTheme,
  selection,
  tones,
  className,
  style,
  children,
}: ThemeProviderProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const axes = themeAxes(theme);
  const full = fullSelection(axes, selection);
  // Keyed on the selection's content: callers pass a fresh object every render.
  const key = selectionKey(axes, full);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, selection: full, resolved: resolveTheme(theme, full), tones: tones ?? themeTones(theme) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, key, tones],
  );

  useLayoutEffect(() => {
    if (ref.current) applyTheme(ref.current, theme, value.selection);
  }, [theme, value]);

  const attrs = Object.fromEntries(Object.keys(axes).map((a) => [`data-wzl-${a}`, full[a]]));
  return (
    <ThemeContext.Provider value={value}>
      <div ref={ref} className={className} style={style} data-wzl-theme={theme.name} {...attrs}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/** The theme in force. Throws outside a `<ThemeProvider>`; use
 *  `useThemeOptional` where the provider is not guaranteed. */
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

let defaultTones: ThemeContextValue | undefined;

/**
 * The tone list in force and what it resolves against — the nearest
 * `<ThemeProvider>`'s, else the built-in theme's at its defaults. Pass the
 * result as `colorAt`'s context.
 */
export function useTones(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return (defaultTones ??= {
    theme: weaselTheme,
    selection: fullSelection(themeAxes(weaselTheme)),
    resolved: resolveTheme(weaselTheme),
    tones: themeTones(weaselTheme),
  });
}
