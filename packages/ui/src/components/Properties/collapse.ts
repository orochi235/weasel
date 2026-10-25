import { createElement, useId, useState, type ReactNode } from 'react';
import { Disclosure } from '../Disclosure';
import s from './Properties.module.css';

/** The props every container in the family folds by. */
export interface CollapseProps {
  /**
   * Give the title a twisty that folds the contents away. Implied by any of
   * the three props below, so it is only needed for a container that starts
   * open and keeps its own state.
   */
  collapsible?: boolean;
  /** Start folded. Read once; the container owns the state from then on. */
  defaultCollapsed?: boolean;
  /**
   * Folded or not, as the consumer holds it. Given, the container keeps no
   * state of its own and every toggle arrives at `onCollapsedChange` instead —
   * which is what a panel that remembers its sections past a reload needs.
   */
  collapsed?: boolean;
  onCollapsedChange?: (next: boolean) => void;
  /**
   * When the twisty shows. `'folded'` hides it while the contents are open:
   * a press on the title folds them, and the twisty is still reached by
   * keyboard, showing while it holds focus. A panel's trails its header and
   * holds no room while hidden, so the title never moves; a section's or a
   * group's stays where its heading puts it and keeps its room. Default
   * `'always'`.
   */
  twisty?: 'always' | 'folded';
}

/** Whether a container folds, whether it is folded now, and the toggle its twisty calls. */
export function useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty }: CollapseProps): Fold {
  const id = useId();
  const [own, setOwn] = useState(defaultCollapsed ?? false);
  const folds =
    collapsible ??
    (defaultCollapsed !== undefined || collapsed !== undefined || onCollapsedChange !== undefined);
  const folded = folds && (collapsed ?? own);
  const toggle = (): void => {
    if (collapsed === undefined) setOwn(!folded);
    onCollapsedChange?.(!folded);
  };
  return {
    folds,
    folded,
    toggle,
    quiet: folds && !folded && twisty === 'folded',
    control: { 'aria-expanded': !folded, 'aria-controls': id, onClick: toggle },
    body: { id, hidden: folded },
  };
}

/** What `useCollapse` answers: whether the container folds, its state, and its toggle. */
export interface Fold {
  folds: boolean;
  folded: boolean;
  toggle: () => void;
  /** The twisty is hidden for now, and the title folds in its place. */
  quiet: boolean;
  /** For a `<button>` that folds the container: its state for a screen reader, and the toggle. */
  control: { 'aria-expanded': boolean; 'aria-controls': string; onClick: () => void };
  /** For the element holding the contents: the id `control` names, and whether it is hidden. */
  body: { id: string; hidden: boolean };
}

/** The class a container's twisty takes. */
export function twistyClass(fold: Fold): string {
  return fold.quiet ? `${s.foldTwisty} ${s.foldTwistyQuiet}` : s.foldTwisty;
}

/** A container's title, pressable while its twisty is hidden. */
export function foldTitle(title: ReactNode, fold: Fold): ReactNode {
  return fold.quiet ? createElement('span', { className: s.foldTitle, onClick: fold.toggle }, title) : title;
}

/**
 * A folding container's twisty, or nothing for one that does not fold. Named
 * by `title` when it is text, else by `fallback`.
 */
export function foldTwisty(fold: Fold, title: ReactNode, fallback = 'this section', className?: string): ReactNode {
  if (!fold.folds) return undefined;
  return createElement(Disclosure, {
    className: className ? `${twistyClass(fold)} ${className}` : twistyClass(fold),
    open: !fold.folded,
    onToggle: fold.toggle,
    label: typeof title === 'string' ? title : fallback,
    controls: fold.body.id,
  });
}
