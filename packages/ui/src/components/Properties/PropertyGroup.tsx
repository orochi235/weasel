import type { ReactNode } from 'react';
import s from './Properties.module.css';
import {
  type PropertyListPack,
  type PropertyMetricProps,
  propertyMetricClass,
} from './PropertyPanel';

/** Props for `<PropertyGroup>`. */
export interface PropertyGroupProps extends PropertyMetricProps {
  /** Title rendered between two rules at the top of the group. */
  title: ReactNode;
  /** When true the group renders nothing — useful for conditional sections. */
  hidden?: boolean;
  children: ReactNode;
  className?: string;
  /** How rows pack into the 2-column grid — see `<PropertyList pack>`. */
  pack?: PropertyListPack;
}

/**
 * Visually-bordered group inside a PropertyList. Use to scope a set of
 * related rows under a heading (e.g. "Aqua", "Bevel", "Dome" sections
 * inside a fill effect's controls).
 */
export function PropertyGroup({
  title,
  hidden,
  children,
  className,
  pack = 'auto-color',
  density,
  align,
}: PropertyGroupProps) {
  if (hidden) return null;
  const base = `${s.group}${pack === 'pairs' ? ` ${s.groupPairs}` : pack === 'one-up' ? ` ${s.groupOneUp}` : ''}`;
  const cls = propertyMetricClass(base, { density, align }, className);
  return (
    <div className={cls}>
      <h3 className={s.groupTitle}>
        <hr />
        <span>{title}</span>
        <hr />
      </h3>
      <div className={s.groupBody}>{children}</div>
    </div>
  );
}
