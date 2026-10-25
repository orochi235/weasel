import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import { DisclosureMark } from '../Disclosure';
import s from './Tree.module.css';

interface Props {
  foldBy: 'twisty' | 'leading';
  branch: boolean;
  open: boolean;
  leading: ReactNode;
  onToggle(): void;
}

/** A fold mark's click folds and does nothing else: it activates no row, and follows no link the row is. */
function fold(onToggle: () => void) {
  return (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle();
  };
}

/** What stands before a row's label: the fold mark in its gutter, and the row's `leading`. */
export function TreeRowLead({ foldBy, branch, open, leading, onToggle }: Props) {
  return (
    <>
      {foldBy === 'twisty' && (
        <span className={s.twisty} aria-hidden="true" data-tree-twisty="" onClick={branch ? fold(onToggle) : undefined}>
          {branch && <DisclosureMark open={open} />}
        </span>
      )}
      {leading != null && (foldBy === 'leading' && branch
        ? <span className={s.leading} data-tree-twisty="" data-open={open ? '' : undefined} onClick={fold(onToggle)}>{leading}</span>
        : <span className={s.leading}>{leading}</span>)}
    </>
  );
}

interface RowBoxProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  href: string | undefined;
  /** A click the row takes as its own. */
  onPress(e: MouseEvent<HTMLElement>): void;
}

/**
 * A row's box: a link when the row has an `href`, out of the tab order, which leaves a click with Cmd, Ctrl or Alt
 * to the browser. A click it takes focuses the treeitem around it, which would otherwise lose focus to the link.
 */
export function TreeRowBox({ href, onPress, draggable, ...props }: RowBoxProps) {
  if (href == null) return <div {...props} onClick={onPress} />;
  const onClick = (e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    e.currentTarget.parentElement?.focus();
    onPress(e);
  };
  return <a {...props} href={href} tabIndex={-1} draggable={draggable} onClick={onClick} />;
}
