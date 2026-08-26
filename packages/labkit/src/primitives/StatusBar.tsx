import type { ReactNode } from 'react';

/** Props for `<StatusBar>`. */
export interface StatusBarProps {
  children: ReactNode;
}

/** A footer strip for readouts. Fill it with `<StatusBar.Section>`. */
export function StatusBar({ children }: StatusBarProps) {
  return <div className="lk-status-bar">{children}</div>;
}

/** Props for `<StatusBar.Section>`. */
export interface StatusBarSectionProps {
  children: ReactNode;
  /** Pushes this section, and everything after it, to the far end. */
  end?: boolean;
}
function Section({ children, end }: StatusBarSectionProps) {
  return (
    <span className={`lk-status-bar-section${end ? ' lk-status-bar-section--end' : ''}`}>
      {children}
    </span>
  );
}

/** One readout within a status bar. */
StatusBar.Section = Section;
