import { type ReactNode, useId, useState } from 'react';
import { DisclosureRow } from '../Disclosure';
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
  /**
   * Give the title a twisty that folds the rows away. Implied by any of the
   * three props below, so it is only needed for a group that starts open and
   * keeps its own state.
   */
  collapsible?: boolean;
  /** Start folded. Read once; the group owns the state from then on. */
  defaultCollapsed?: boolean;
  /**
   * Folded or not, as the consumer holds it. Given, the group keeps no state
   * of its own and every toggle arrives at `onCollapsedChange` instead — which
   * is what a panel that remembers its sections past a reload needs.
   */
  collapsed?: boolean;
  onCollapsedChange?: (next: boolean) => void;
  children: ReactNode;
  className?: string;
  /** How rows pack into the 2-column grid — see `<PropertyList pack>`. */
  pack?: PropertyListPack;
}

/**
 * Visually-bordered group inside a PropertyList. Use to scope a set of
 * related rows under a heading (e.g. "Aqua", "Bevel", "Dome" sections
 * inside a fill effect's controls).
 *
 * A collapsible group keeps its rows mounted and hides them, so a control's
 * local state survives being folded away.
 */
export function PropertyGroup({
  title,
  hidden,
  collapsible,
  defaultCollapsed,
  collapsed,
  onCollapsedChange,
  children,
  className,
  pack = 'auto-color',
  density,
  align,
}: PropertyGroupProps) {
  const bodyId = useId();
  const [own, setOwn] = useState(defaultCollapsed ?? false);
  if (hidden) return null;

  const folds =
    collapsible ??
    (defaultCollapsed !== undefined || collapsed !== undefined || onCollapsedChange !== undefined);
  const folded = folds && (collapsed ?? own);
  const toggle = () => {
    if (collapsed === undefined) setOwn(!folded);
    onCollapsedChange?.(!folded);
  };

  const base = `${s.group}${pack === 'pairs' ? ` ${s.groupPairs}` : pack === 'one-up' ? ` ${s.groupOneUp}` : ''}`;
  const cls = propertyMetricClass(base, { density, align }, className);
  const heading = (
    <h3 className={s.groupTitle}>
      <hr />
      <span>{title}</span>
      <hr />
    </h3>
  );
  return (
    <div className={cls}>
      {folds ? (
        <DisclosureRow
          className={s.groupHead}
          open={!folded}
          onToggle={toggle}
          label={typeof title === 'string' ? title : 'this section'}
          controls={bodyId}
        >
          {heading}
        </DisclosureRow>
      ) : (
        heading
      )}
      <div id={bodyId} className={s.groupBody} hidden={folded}>
        {children}
      </div>
    </div>
  );
}
