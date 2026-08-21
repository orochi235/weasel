import type { ReactNode } from 'react';

/** Props for `<StatusBar>`. */
export interface StatusBarProps {
  children: ReactNode;
}

/** A footer strip for readouts. Fill it with `<StatusBar.Section>`. */
export function StatusBar({ children }: StatusBarProps) {
  return <div className="lk-status-bar">{children}</div>;
}

interface SectionProps {
  children: ReactNode;
}
function Section({ children }: SectionProps) {
  return <span className="lk-status-bar-section">{children}</span>;
}

/** One readout within a status bar. */
StatusBar.Section = Section;
