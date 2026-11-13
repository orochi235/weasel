import type { ReactNode } from 'react';
import s from './Properties.module.css';

/** A caption naming one control among several in a `group` row, in the row label's face. */
export function PropertyCaption({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className ? `${s.caption} ${className}` : s.caption}>{children}</span>;
}
