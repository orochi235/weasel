import { type ReactNode, useEffect } from 'react';
import type { LabMode } from '../state/types';
import { LabRoot } from './LabRoot';
import type { LabPage } from './LabSwitcher';
import { LabSwitcher } from './LabSwitcher';

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
  /** The project's other labs. Given two or more, the title becomes the way
   *  to reach them; given none, it stays a plain heading. */
  pages?: readonly LabPage[];
  /** The path the switcher reads to mark the open page. Defaults to the
   *  current location. */
  path?: string;
  /** Set as `document.title` while the shell is mounted, and the previous
   *  title restored after. Omitted, the document's title is left alone. */
  documentTitle?: string;
}

/** Page frame for a lab: a titled header, a body, and an optional footer,
 *  themed for the resolved color mode. Presentational only — use `<Lab>` when
 *  the trial runtime is wanted too. */
export function LabShell({
  title,
  children,
  header,
  footer,
  mode = 'auto',
  pages,
  path,
  documentTitle,
}: LabShellProps) {
  useEffect(() => {
    if (documentTitle === undefined) return;
    const previous = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previous;
    };
  }, [documentTitle]);

  return (
    <LabRoot mode={mode} className="lk-shell">
      <header className="lk-shell-header">
        {pages && pages.length > 0 ? (
          <LabSwitcher title={title} pages={pages} path={path} className="lk-shell-title" />
        ) : (
          <h1 className="lk-shell-title">{title}</h1>
        )}
        {header && <div className="lk-shell-header-actions">{header}</div>}
      </header>
      <main className="lk-shell-body">{children}</main>
      {footer && <footer className="lk-shell-footer">{footer}</footer>}
    </LabRoot>
  );
}
