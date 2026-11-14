import { Children, type ReactNode } from 'react';
import { useRun } from '../Run';
import { tiling } from '../../tiling';
import { withDensity, type DensityProps } from '../Density';
import s from './ToolGroup.module.css';
import { holdScope, type HoldProps } from '../Disabled';

/** Props for {@link ToolGroup}. */
export interface ToolGroupProps extends DensityProps, HoldProps {
  children: ReactNode;
  /** Lays children in a grid this many across, in place of the run's single line. */
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
 * `<ToolButton>`s (or any children) along the run it sits in: a column in a
 * vertical one, a row otherwise. No visual chrome beyond layout; theming
 * lives on the buttons.
 */
export function ToolGroup(props: ToolGroupProps) {
  const { children, columns, groupKey, 'aria-label': ariaLabel, size, className } = props;
  const { orientation } = useRun();
  const tiles = columns ? tiling(Children.count(children), { columns }) : null;
  const cls = [s.group, tiles ? tiles.className : orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');
  const style = tiles?.style;
  return (
    <div className={cls} style={style} role="group" data-group={groupKey} aria-label={ariaLabel}>
      {holdScope(props, withDensity(size, children))}
    </div>
  );
}
