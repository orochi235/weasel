import type { ReactNode } from 'react';

export interface StatusBarProps {
  children: ReactNode;
}

export function StatusBar({ children }: StatusBarProps) {
  return <div className="lk-status-bar">{children}</div>;
}

interface SectionProps {
  children: ReactNode;
}
function Section({ children }: SectionProps) {
  return <span className="lk-status-bar-section">{children}</span>;
}

StatusBar.Section = Section;
