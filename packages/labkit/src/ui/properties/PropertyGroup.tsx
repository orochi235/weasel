import type { ReactNode } from 'react';

export interface PropertyGroupProps {
  /** Title rendered between two rules at the top of the group. */
  title: ReactNode;
  /** When true the group renders nothing — useful for conditional sections. */
  hidden?: boolean;
  children: ReactNode;
  className?: string;
  /**
   * How rows pack into the 2-column grid.
   *   - `'auto-color'` (default): only color rows pair side-by-side; everything
   *     else spans the full width.
   *   - `'pairs'`: every row auto-places into the 2-column grid two-per-row.
   */
  pack?: 'auto-color' | 'pairs';
}

/**
 * Visually-bordered group inside a PropertyList. Use to scope a set of
 * related rows under a heading (e.g. "Aqua", "Bevel", "Dome" sections
 * inside a fill effect's controls).
 */
export function PropertyGroup({ title, hidden, children, className, pack = 'auto-color' }: PropertyGroupProps) {
  if (hidden) return null;
  const packClass = pack === 'pairs' ? ' lk-property-group--pairs' : '';
  const cls = `lk-property-group${packClass}${className ? ` ${className}` : ''}`;
  return (
    <div className={cls}>
      <h3 className="lk-property-group__title">
        <hr />
        <span>{title}</span>
        <hr />
      </h3>
      <div className="lk-property-group__body">{children}</div>
    </div>
  );
}
