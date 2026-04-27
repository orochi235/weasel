import type { ReactNode } from 'react';

export type LabTheme = 'auto' | 'light' | 'dark';

export interface LabShellProps {
  title: string;
  children: ReactNode;
  /** Optional content rendered into the header (e.g., action buttons). */
  header?: ReactNode;
  /** Optional content rendered into the footer. */
  footer?: ReactNode;
  /** Theme override. "auto" (default) follows prefers-color-scheme. */
  theme?: LabTheme;
}

export function LabShell({ title, children, header, footer, theme = 'auto' }: LabShellProps) {
  const themeClass =
    theme === 'light' ? ' lk-theme-light' : theme === 'dark' ? ' lk-theme-dark' : '';
  return (
    <div className={`lk-root lk-shell${themeClass}`}>
      <header className="lk-shell-header">
        <h1 className="lk-shell-title">{title}</h1>
        {header && <div className="lk-shell-header-actions">{header}</div>}
      </header>
      <main className="lk-shell-body">{children}</main>
      {footer && <footer className="lk-shell-footer">{footer}</footer>}
    </div>
  );
}
