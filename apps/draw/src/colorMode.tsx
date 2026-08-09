import { createContext, useContext, type ReactNode, type ReactElement } from 'react';
import { useColorMode, type ColorMode } from './useColorMode';

interface ColorModeValue {
  readonly mode: ColorMode;
  readonly toggle: () => void;
}

const ColorModeContext = createContext<ColorModeValue | null>(null);

/**
 * Holds the app's color mode. Separate from `ThemeProvider` because the
 * provider publishes the *current* mode but owns no way to change it — the
 * toggle belongs to the app, not the kit.
 */
export function ColorModeProvider({
  children,
}: {
  children: (mode: ColorMode) => ReactNode;
}): ReactElement {
  const [mode, toggle] = useColorMode();
  return (
    <ColorModeContext.Provider value={{ mode, toggle }}>{children(mode)}</ColorModeContext.Provider>
  );
}

/** `null` when rendered outside the provider (e.g. an isolated test mount). */
export function useColorModeControl(): ColorModeValue | null {
  return useContext(ColorModeContext);
}
