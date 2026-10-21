import { useContext, type ReactNode } from 'react';
import { ThemeProvider } from '@weasel-js/theme/react';
import { SiteColorModeContext } from './colorMode';

/**
 * A theme in the demo shell's color mode. The shell puts every demo under one, so whatever a demo
 * draws in its canvas (the hud, a scene color through `useColorCss`) follows the reader's mode
 * the way its DOM follows the cascade.
 */
export function SiteThemeProvider({ className, children }: { className?: string; children: ReactNode }) {
  const mode = useContext(SiteColorModeContext);
  return (
    <ThemeProvider selection={{ mode }} className={className}>
      {children}
    </ThemeProvider>
  );
}
