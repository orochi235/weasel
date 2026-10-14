import type { MouseEvent, ReactNode } from 'react';
import { DisclosureMark } from '../Disclosure';
import s from './Tree.module.css';

interface Props {
  foldBy: 'twisty' | 'leading';
  branch: boolean;
  open: boolean;
  leading: ReactNode;
  onToggle(e: MouseEvent): void;
}

/** What stands before a row's label: the fold mark in its gutter, and the row's `leading`. */
export function TreeRowLead({ foldBy, branch, open, leading, onToggle }: Props) {
  return (
    <>
      {foldBy === 'twisty' && (
        <span className={s.twisty} aria-hidden="true" data-tree-twisty="" onClick={branch ? onToggle : undefined}>
          {branch && <DisclosureMark open={open} />}
        </span>
      )}
      {leading != null && (foldBy === 'leading' && branch
        ? <span className={s.leading} data-tree-twisty="" data-open={open ? '' : undefined} onClick={onToggle}>{leading}</span>
        : <span className={s.leading}>{leading}</span>)}
    </>
  );
}
