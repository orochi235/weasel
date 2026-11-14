import { Children, type ReactNode } from 'react';
import type { Orientation } from '../orientation';
import { tiling } from '../../tiling';
import { withDensity, type DensityProps } from '../Density';
import s from './ToolGroup.module.css';

/** Props for {@link ToolGroup}. */
export interface ToolGroupProps extends DensityProps {
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
  'aria-label'?: string;
  className?: string;
}

/**
 * Generic toolbar group — a `role="group"` flex container that arranges
 * `<ToolButton>`s (or any children) along a chosen axis. No visual chrome
 * beyond layout; theming lives on the buttons.
 */
export function ToolGroup(props: ToolGroupProps) {
  const { children, orientation = 'vertical', columns, groupKey, 'aria-label': ariaLabel, size, className } = props;
  const tiles = columns ? tiling(Children.count(children), { columns }) : null;
  const cls = [s.group, tiles ? tiles.className : orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');
  const style = tiles?.style;
  return (
    <div className={cls} style={style} role="group" data-group={groupKey} aria-label={ariaLabel}>
      {withDensity(size, children)}
    </div>
  );
}
