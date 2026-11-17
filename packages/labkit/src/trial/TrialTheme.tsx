import type { ColorModePreference } from '@weasel-js/theme';
import { ThemeProvider, useThemeOptional } from '@weasel-js/theme/react';
import type { ReactNode } from 'react';

/** A trial's content under the lab's theme in the trial's own color mode. `'auto'` keeps the lab's selection.
 *  It wraps whatever the mode, so switching it never remounts the instrument. */
export function TrialTheme({ mode, children }: { mode: ColorModePreference; children: ReactNode }) {
  const lab = useThemeOptional();
  if (!lab) return children;
  return (
    <ThemeProvider
      theme={lab.theme}
      selection={mode === 'auto' ? lab.selection : { ...lab.selection, mode }}
      tints={lab.tints}
      palette={lab.palette}
      className="lk-trial__themed"
    >
      {children}
    </ThemeProvider>
  );
}
