import { useContext, type ReactNode } from 'react';
import { ThemeProvider } from '@weasel-js/theme/react';
import { SiteColorModeContext } from './colorMode';

/**
 * A theme in the demo shell's color mode, for a demo whose chrome is drawn in the canvas (the
 * hud) and so reads the mode from a theme rather than the cascade. Its wrapper takes
 * `className`, so it can be the demo's layout element.
 */
export function SiteThemeProvider({ className, children }: { className?: string; children: ReactNode }) {
  const mode = useContext(SiteColorModeContext);
  return (
    <ThemeProvider selection={{ mode }} className={className}>
      {children}
    </ThemeProvider>
  );
}
