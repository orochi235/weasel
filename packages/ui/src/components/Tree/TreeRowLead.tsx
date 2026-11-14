import { forwardRef, type HTMLAttributes, type MouseEvent, type ReactNode, type Ref } from 'react';
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
 * A row's box: a link when the row has an `href`, which leaves a click with Cmd, Ctrl or Alt to the browser. The
 * link is out of the tab order unless it is itself the row a treegrid focuses; a click it takes focuses whichever
 * element is the row, which would otherwise lose focus to the link.
 */
export const TreeRowBox = forwardRef(function TreeRowBox(
  { href, onPress, draggable, ...props }: RowBoxProps,
  ref: Ref<HTMLElement>,
) {
  if (href == null) return <div ref={ref as Ref<HTMLDivElement>} {...props} onClick={onPress} />;
  const onClick = (e: MouseEvent<HTMLElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    (props.role === 'row' ? e.currentTarget : e.currentTarget.parentElement)?.focus();
    onPress(e);
  };
  return (
    <a
      ref={ref as Ref<HTMLAnchorElement>} {...props} href={href} tabIndex={props.tabIndex ?? -1} draggable={draggable}
      onClick={onClick}
    />
  );
});
