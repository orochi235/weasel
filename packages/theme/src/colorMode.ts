/** A color mode the theme's `mode` axis resolves. */
export type ColorMode = 'light' | 'dark';

/**
 * What a user chose: a mode, or `'auto'` — follow the OS, live. `'auto'` is
 * not a mode; resolve it with `useResolvedColorMode` before handing it to a
 * `ThemeProvider` selection.
 */
export type ColorModePreference = 'auto' | ColorMode;

/** Whether a value — say, one read back from storage — is a preference. */
export function isColorModePreference(v: unknown): v is ColorModePreference {
  return v === 'auto' || v === 'light' || v === 'dark';
}
