import { createContext, useLayoutEffect } from 'react';
import { useColorModePreference, type ColorMode, type ColorModePreferenceState } from '@weasel-js/theme/react';

/** Where the demo shell remembers a reader's color mode. */
export const MODE_STORAGE_KEY = 'ckd-mode';

/** The demo shell's mode until a reader chooses one. */
const DEFAULT_MODE: ColorMode = 'dark';

/** The mode the demo shell shows, which `SiteThemeProvider` turns into the theme every demo draws under. */
export const SiteColorModeContext = createContext<ColorMode>(DEFAULT_MODE);

/**
 * The demo shell's color mode: a reader's choice, dark until they make one, written to the
 * document element so the page behind the shell follows it too. The attribute comes off with
 * the shell, which leaves the front page to the theme it pins itself.
 */
export function useSiteColorMode(): ColorModePreferenceState {
  const state = useColorModePreference({ storageKey: MODE_STORAGE_KEY, defaultPreference: DEFAULT_MODE });
  const { mode } = state;
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-wzl-mode', mode);
    return () => root.removeAttribute('data-wzl-mode');
  }, [mode]);
  return state;
}
