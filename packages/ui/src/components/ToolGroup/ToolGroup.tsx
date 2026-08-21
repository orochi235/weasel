import type { ReactNode } from 'react';
import s from './ToolGroup.module.css';

/** Props for {@link ToolGroup}. */
export interface ToolGroupProps {
  children: ReactNode;
  /**
   * Lays children along an axis. `'vertical'` (default) stacks them in
   * a column; `'horizontal'` lays them in a row. Independent of the
   * parent toolbar's own orientation.
   */
  orientation?: 'vertical' | 'horizontal';
  /**
   * Optional `data-group` attribute — useful for parents that want to
   * select the group from CSS or tests by name.
   */
  groupKey?: string;
  /** Accessible name for the group (rendered as `aria-label`). */
  ariaLabel?: string;
  className?: string;
}

/**
 * Generic toolbar group — a `role="group"` flex container that arranges
 * `<ToolButton>`s (or any children) along a chosen axis. No visual chrome
 * beyond layout; theming lives on the buttons.
 */
export function ToolGroup(props: ToolGroupProps) {
  const { children, orientation = 'vertical', groupKey, ariaLabel, className } = props;
  const cls = [s.group, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');
  return (
    <div className={cls} role="group" data-group={groupKey} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
