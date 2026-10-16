import { createContext, useLayoutEffect } from 'react';
import { useColorModePreference, type ColorMode, type ColorModePreferenceState } from '@weasel-js/theme/react';

/** Where the demo shell remembers a reader's color mode. */
export const MODE_STORAGE_KEY = 'ckd-mode';

/** The mode the demo shell shows, for a demo whose chrome is drawn in the canvas and cannot read the cascade. */
export const SiteColorModeContext = createContext<ColorMode>('dark');

/**
 * The demo shell's color mode: a reader's choice, dark until they make one, written to the
 * document element so the page behind the shell follows it too. The attribute comes off with
 * the shell, which leaves the front page to the theme it pins itself.
 */
export function useSiteColorMode(): ColorModePreferenceState {
  const state = useColorModePreference({ storageKey: MODE_STORAGE_KEY, defaultPreference: 'dark' });
  const { mode } = state;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-wzl-mode', mode);
    return () => root.removeAttribute('data-wzl-mode');
  }, [mode]);
  return state;
}
