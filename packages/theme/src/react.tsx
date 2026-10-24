import { colorLiteralToHex, type ColorSource, type Palette } from '@weasel-js/paint';
import React, { createContext, useCallback, useContext, useMemo, useRef, useLayoutEffect } from 'react';
import { isDev } from '@weasel-js/registry';
import { applyTheme } from './applyTheme';
import { themeTints, type ColorList } from './colorList';
import { colorSourceCss, colorSourceLiteral } from './colorSource';
import { fullSelection, selectionKey, type Selection } from './axes';
import { resolveTheme, themeAxes, type ResolvedTheme } from './resolveTheme';
import { weaselTheme, type Theme } from './theme';
import { useResolvedColorMode } from './useColorMode';

export {
  useColorModePreference,
  useResolvedColorMode,
  type ColorModePreferenceOptions,
  type ColorModePreferenceState,
  type ColorModeStorage,
} from './useColorMode';
export { isColorModePreference, type ColorMode, type ColorModePreference } from './colorMode';

/** What `<ThemeProvider>` publishes: the theme, the full selection in force, the
 *  fully resolved token record for that pair, and the tint list and palette in force. */
export interface ThemeContextValue {
  readonly theme: Theme;
  readonly selection: Selection;
  readonly resolved: ResolvedTheme;
  readonly tints: ColorList;
  readonly palette: Palette;
}

/** What `<ThemeProvider>` publishes. Provide `null` to hide an outer theme from a subtree, as a
 *  boundary that renders its children the way a page with no provider would. */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

const NO_PALETTE: Palette = { entries: [] };

/** Props for `<ThemeProvider>`. */
export interface ThemeProviderProps {
  readonly theme?: Theme;
  /** Axis values, e.g. `{ mode: 'light' }`. A missing axis takes its default. `mode: 'auto'`
   *  follows the OS setting, live; any other value the theme lacks takes the default, with a
   *  warning in development. */
  readonly selection?: Selection;
  /** The colors a `tint` index picks from in this subtree. Absent: the theme's own. */
  readonly tints?: ColorList;
  /** Colors a `ColorRef` names in this subtree, answered before the theme's own names. Absent: none. */
  readonly palette?: Palette;
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
  tints,
  palette = NO_PALETTE,
  className,
  style,
  children,
}: ThemeProviderProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const axes = themeAxes(theme);
  const autoMode = selection?.mode === 'auto' && !('auto' in (axes.mode?.values ?? {}));
  const systemMode = useResolvedColorMode(autoMode ? 'auto' : 'dark');
  const given = autoMode ? { ...selection, mode: systemMode } : selection;
  const full = fullSelection(axes, given);
  warnUnknownAxisValues(theme, axes, given);
  // Keyed on the selection's content: callers pass a fresh object every render.
  const key = selectionKey(axes, full);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, selection: full, resolved: resolveTheme(theme, full), tints: tints ?? themeTints(theme), palette }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, key, tints, palette],
  );

  // Applying again replaces what the element held, so only the unmount releases.
  const release = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (ref.current) release.current = applyTheme(ref.current, theme, value.selection);
  }, [theme, value]);
  useLayoutEffect(() => () => release.current?.(), []);

  const attrs = Object.fromEntries(Object.keys(axes).map((a) => [`data-wzl-${a}`, full[a]]));
  return (
    <ThemeContext.Provider value={value}>
      <div ref={ref} className={className} style={style} data-wzl-theme={theme.name} {...attrs}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

const warned = new Set<string>();

function warnUnknownAxisValues(theme: Theme, axes: ReturnType<typeof themeAxes>, selection: Selection | undefined): void {
  if (!selection || !isDev()) return;
  for (const [axis, value] of Object.entries(selection)) {
    const def = axes[axis];
    if (!def || value in def.values) continue;
    const key = `${theme.name}\0${axis}\0${value}`;
    if (warned.has(key)) continue;
    warned.add(key);
    console.warn(
      `[weasel theme] ThemeProvider: theme "${theme.name}" has no ${axis} "${value}"; using "${def.default}". Its ${axis} values: ${Object.keys(def.values).join(', ')}.`,
    );
  }
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

let defaultTints: ThemeContextValue | undefined;

/**
 * The tint list in force and what it resolves against — the nearest
 * `<ThemeProvider>`'s, else the built-in theme's at its defaults. Pass the
 * result as `colorAt`'s context.
 */
export function useTints(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return (defaultTints ??= {
    theme: weaselTheme,
    selection: fullSelection(themeAxes(weaselTheme)),
    resolved: resolveTheme(weaselTheme),
    tints: themeTints(weaselTheme),
    palette: NO_PALETTE,
  });
}

/**
 * Turns a `ColorSource` into a CSS color under the theme, tints, and palette in
 * force: `colorSourceCss` against `useTints()`. Every component that takes a
 * color writes it through this. `undefined` for no source, and for one nothing
 * answers.
 */
export function useColorCss(): (source: ColorSource | null | undefined) => string | undefined {
  const ctx = useTints();
  return useCallback((source) => (source == null ? undefined : (colorSourceCss(source, ctx) ?? undefined)), [ctx]);
}

/**
 * Turns a `ColorSource` into a hex color under the theme, tints, and palette in force, for a
 * surface drawn without the cascade, such as a scene's paint. `useColorCss` may answer
 * `var(--wzl-…)`, which only the DOM resolves; this answers the value. `undefined` for no
 * source, and for one nothing answers.
 */
export function useColorHex(): (source: ColorSource | null | undefined) => string | undefined {
  const ctx = useTints();
  return useCallback((source) => {
    if (source == null) return undefined;
    const literal = colorSourceLiteral(source, ctx);
    return (literal && colorLiteralToHex(literal)) ?? undefined;
  }, [ctx]);
}
