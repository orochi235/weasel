import { useState } from 'react';

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
}

/** Whether a container folds, whether it is folded now, and the toggle its twisty calls. */
export function useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange }: CollapseProps): {
  folds: boolean;
  folded: boolean;
  toggle: () => void;
} {
  const [own, setOwn] = useState(defaultCollapsed ?? false);
  const folds =
    collapsible ??
    (defaultCollapsed !== undefined || collapsed !== undefined || onCollapsedChange !== undefined);
  const folded = folds && (collapsed ?? own);
  const toggle = (): void => {
    if (collapsed === undefined) setOwn(!folded);
    onCollapsedChange?.(!folded);
  };
  return { folds, folded, toggle };
}
