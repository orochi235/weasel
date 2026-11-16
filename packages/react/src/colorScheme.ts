import { matchesMedia, useMediaQuery, watchMedia } from './media';

/** A color scheme the system can ask for. */
export type ColorScheme = 'light' | 'dark';

/**
 * The scheme where nothing says which: no `matchMedia`, a server render, or no
 * stated preference. Dark, the mode weasel's tokens paint at `:root`.
 */
export const DEFAULT_COLOR_SCHEME: ColorScheme = 'dark';

// Asking for light makes "no preference" fall to the default, as no `matchMedia` does.
const QUERY = '(prefers-color-scheme: light)';

/** The color scheme the system asks for, {@link DEFAULT_COLOR_SCHEME} where it says nothing. */
export function systemColorScheme(): ColorScheme {
  return matchesMedia(QUERY) ? 'light' : DEFAULT_COLOR_SCHEME;
}

/** Call `fn` whenever the system color scheme changes. Returns the stop. */
export function watchColorScheme(fn: () => void): () => void {
  return watchMedia(QUERY, fn);
}

/**
 * {@link systemColorScheme}, re-rendering when it changes. With `follow` false
 * nothing is subscribed: for a caller whose user picked a scheme of their own.
 */
export function useSystemColorScheme(follow = true): ColorScheme {
  return useMediaQuery(QUERY, { follow }) ? 'light' : DEFAULT_COLOR_SCHEME;
}
