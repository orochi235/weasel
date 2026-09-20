import { ThemeProvider, useThemeOptional } from '@weasel-js/theme/react';
import type { ReactNode } from 'react';
import type { LabMode } from '../state/types';
import { interstellarTheme } from '../theme/interstellar';
import { useResolvedMode } from './useSystemMode';

/** Props for `<LabRoot>`. */
export interface LabRootProps {
  children: ReactNode;
  /** Color mode. "auto" (default) follows prefers-color-scheme. */
  mode?: LabMode;
  /** Added after `lk-root` on the same element. */
  className?: string;
}

/** The element every labkit component expects above it: `.lk-root`, which
 *  carries the design tokens, the font stack, the box-sizing reset and the
 *  element defaults a lab's bare markup is styled by, plus a theme when the
 *  app has not already applied one.
 *
 *  `<LabShell>` and `<Lab>` render this themselves. Mount it by hand around a
 *  labkit piece used on its own — a bare `<Workspace>` or `<ControlPanel>` —
 *  or those components inherit whatever the host page happens to define.
 *  Pair it with `import '@weasel-js/labkit/styles.css'`, which is what defines
 *  the rules this element scopes. */
export function LabRoot({ children, mode = 'auto', className }: LabRootProps) {
  const resolved = useResolvedMode(mode);
  const outer = useThemeOptional();

  // Overlays portal here rather than to the themed wrapper above: `.lk-root`
  // carries the element defaults a lab's bare markup is styled by.
  const root = (
    <div className={className ? `lk-root ${className}` : 'lk-root'} data-wzl-portal-host="">
      {children}
    </div>
  );

  // Inside <Lab> the theme is already applied on `.lk-lab`; wrapping again
  // would only add a div.
  return outer ? (
    root
  ) : (
    <ThemeProvider theme={interstellarTheme} selection={{ mode: resolved }}>
      {root}
    </ThemeProvider>
  );
}
