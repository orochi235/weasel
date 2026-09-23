import { createContext, useContext, type ReactNode, type ReactElement } from 'react';
import {
  useColorModePreference,
  type ColorMode,
  type ColorModePreferenceState,
} from '@weasel-js/theme/react';

const ColorModeContext = createContext<ColorModePreferenceState | null>(null);

/**
 * Holds the app's color-mode preference. Separate from `ThemeProvider` because
 * the provider publishes the *current* mode but owns no way to change it.
 */
export function ColorModeProvider({
  children,
}: {
  children: (mode: ColorMode) => ReactNode;
}): ReactElement {
  const state = useColorModePreference({ storageKey: 'wd-mode' });
  return <ColorModeContext.Provider value={state}>{children(state.mode)}</ColorModeContext.Provider>;
}

/** `null` when rendered outside the provider (e.g. an isolated test mount). */
export function useColorModeControl(): ColorModePreferenceState | null {
  return useContext(ColorModeContext);
}
