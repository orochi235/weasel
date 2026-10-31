import type { CSSProperties, ReactNode } from 'react';
import type { Orientation } from '../orientation';
import s from './ToolGroup.module.css';

/** Props for {@link ToolGroup}. */
export interface ToolGroupProps {
  children: ReactNode;
  /**
   * Lays children along an axis. `'vertical'` (default) stacks them in
   * a column; `'horizontal'` lays them in a row. Independent of the
   * parent toolbar's own orientation.
   */
  orientation?: Orientation;
  /** Lays children in a grid this many across, in place of `orientation`'s single line. */
  columns?: number;
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
  const { children, orientation = 'vertical', columns, groupKey, ariaLabel, className } = props;
  const cls = [s.group, columns ? s.grid : orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');
  // The column count is data, so it reaches the stylesheet as a custom property.
  const style = columns ? ({ '--wzl-tool-columns': columns } as CSSProperties) : undefined;
  return (
    <div className={cls} style={style} role="group" data-group={groupKey} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
