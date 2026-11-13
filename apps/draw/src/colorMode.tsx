import { createContext, useContext, useMemo, type ReactNode, type ReactElement } from 'react';
import {
  useResolvedColorMode,
  type ColorMode,
  type ColorModePreferenceState,
} from '@weasel-js/theme/react';
import { usePref } from './prefs';

const ColorModeContext = createContext<ColorModePreferenceState | null>(null);

/**
 * Holds the app's color-mode preference, the `ui.colorMode` pref. Separate from `ThemeProvider` because
 * the provider publishes the *current* mode but owns no way to change it.
 */
export function ColorModeProvider({
  children,
}: {
  children: (mode: ColorMode) => ReactNode;
}): ReactElement {
  const [preference, setPreference] = usePref('ui.colorMode');
  const mode = useResolvedColorMode(preference);
  const state = useMemo(() => ({ preference, setPreference, mode }), [preference, setPreference, mode]);
  return <ColorModeContext.Provider value={state}>{children(state.mode)}</ColorModeContext.Provider>;
}

/** `null` when rendered outside the provider (e.g. an isolated test mount). */
export function useColorModeControl(): ColorModePreferenceState | null {
  return useContext(ColorModeContext);
}
