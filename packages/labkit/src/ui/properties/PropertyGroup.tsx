import type { ReactNode } from 'react';

export interface PropertyGroupProps {
  /** Title rendered between two rules at the top of the group. */
  title: ReactNode;
  /** When true the group renders nothing — useful for conditional sections. */
  hidden?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Visually-bordered group inside a PropertyList. Use to scope a set of
 * related rows under a heading (e.g. "Aqua", "Bevel", "Dome" sections
 * inside a fill effect's controls).
 */
export function PropertyGroup({ title, hidden, children, className }: PropertyGroupProps) {
  if (hidden) return null;
  const cls = className ? `lk-property-group ${className}` : 'lk-property-group';
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
