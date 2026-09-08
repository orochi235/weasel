import { ThemeProvider, useThemeOptional } from '@weasel-js/theme/react';
import type { ReactNode } from 'react';
import type { LabMode } from '../state/types';
import { interstellarTheme } from '../theme/interstellar';
import { useResolvedMode } from './useSystemMode';

/** Props for `<LabShell>`. */
export interface LabShellProps {
  title: string;
  children: ReactNode;
  /** Optional content rendered into the header (e.g., action buttons). */
  header?: ReactNode;
  /** Optional content rendered into the footer. */
  footer?: ReactNode;
  /** Color mode. "auto" (default) follows prefers-color-scheme. */
  mode?: LabMode;
}

/** Page frame for a lab: a titled header, a body, and an optional footer,
 *  themed for the resolved color mode. Presentational only — use `<Lab>` when
 *  the trial runtime is wanted too. */
export function LabShell({ title, children, header, footer, mode = 'auto' }: LabShellProps) {
  const resolved = useResolvedMode(mode);
  const outer = useThemeOptional();

  const shell = (
    // Overlays portal here rather than to the themed wrapper above: `.lk-root`
    // carries the element defaults a lab's bare markup is styled by.
    <div className="lk-root lk-shell" data-wzl-portal-host="">
      <header className="lk-shell-header">
        <h1 className="lk-shell-title">{title}</h1>
        {header && <div className="lk-shell-header-actions">{header}</div>}
      </header>
      <main className="lk-shell-body">{children}</main>
      {footer && <footer className="lk-shell-footer">{footer}</footer>}
    </div>
  );

  // Inside <Lab> the theme is already applied on `.lk-lab`; wrapping again
  // would only add a div.
  return outer ? (
    shell
  ) : (
    <ThemeProvider theme={interstellarTheme} mode={resolved}>
      {shell}
    </ThemeProvider>
  );
}
