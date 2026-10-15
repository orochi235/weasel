import type { ReactNode } from 'react';
import s from './Packages.module.css';

/** Draws `children` once `value` has loaded, and says so when it could not. */
export function Loading<T>({ value, what, children }: {
  value: T | null | 'failed';
  /** What is being loaded, as the subject of "could not be loaded". */
  what: string;
  children: (loaded: T) => ReactNode;
}) {
  if (value === 'failed') {
    return <p className={s.note} role="status">{what} could not be loaded. Reload the page to try again.</p>;
  }
  if (value === null) return <div className={s.loading} />;
  return <>{children(value)}</>;
}
