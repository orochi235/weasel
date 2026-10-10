import { type ReactNode, useId } from 'react';
import { Disclosure } from '../Disclosure';
import { type Motif, MotifFrame } from '../MotifFrame';
import type { StanceProps } from '../stance';
import { type CollapseProps, useCollapse } from './collapse';
import s from './Properties.module.css';
import {
  type PropertyListPack,
  type PropertyMetricProps,
  PropertyNote,
  propertyMetricClass,
} from './PropertyPanel';

/** Props for `<PropertyGroup>`. */
export interface PropertyGroupProps extends PropertyMetricProps, StanceProps, CollapseProps {
  /** The group's title, which `motif` places. */
  title: ReactNode;
  /** How the group draws its title and edge (`motifs.stereo()`, `motifs.notch()`, …). Defaults to `rule()`, a title between two rules. */
  motif?: Motif;
  /** Before the title: a drag handle, an ordinal. Clicks here do not fold the group. */
  leading?: ReactNode;
  /** After the title: a summary of the group's value, a remove button. Clicks here do not fold the group. */
  actions?: ReactNode;
  /** Help text for the whole group, drawn under the title and above the
   *  rows. `<PropertyRow description>` covers the per-row case. */
  description?: ReactNode;
  /** When true the group renders nothing — useful for conditional sections. */
  hidden?: boolean;
  children: ReactNode;
  className?: string;
  /** Take the whole width of a packed grid, like `<PropertyRow span>`: a group
   *  lays its own rows out, so half a column leaves them overlapping. */
  span?: boolean;
  /** How rows pack into the 2-column grid — see `<PropertyList pack>`. */
  pack?: PropertyListPack;
}

/**
 * Visually-bordered group inside a PropertyList. Use to scope a set of
 * related rows under a heading (e.g. "Aqua", "Bevel", "Dome" sections
 * inside a fill effect's controls).
 *
 * A collapsible group keeps its rows mounted and hides them, so a control's
 * local state survives being folded away. It draws itself as a `<MotifFrame>`
 * in `motif`. `stance` and `tone` work as on `<PropertyPanel>`; in the default
 * `rule` motif a tone also draws the group's leading edge, which is how a list
 * of like groups — effects, tails — tells its members apart.
 * `leading` and `actions` put a handle and controls in the title row, and the
 * groups of a `<PropertyList>` reorder with `useReorderDragList`.
 */
export function PropertyGroup({
  title,
  motif,
  leading,
  actions,
  description,
  hidden,
  collapsible,
  defaultCollapsed,
  collapsed,
  onCollapsedChange,
  children,
  className,
  span,
  pack = 'auto-color',
  density,
  align,
  stance,
  tone,
}: PropertyGroupProps) {
  const bodyId = useId();
  const { folds, folded, toggle } = useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange });
  if (hidden) return null;

  const base = `${s.group}${pack === 'pairs' ? ` ${s.groupPairs}` : pack === 'one-up' ? ` ${s.groupOneUp}` : ''}`;
  const cls = propertyMetricClass(span ? `${base} ${s.span}` : base, { density, align }, className);
  return (
    <MotifFrame
      title={title}
      motif={motif}
      leading={leading}
      actions={actions}
      twisty={
        folds ? (
          <Disclosure
            open={!folded}
            onToggle={toggle}
            label={typeof title === 'string' ? title : 'this section'}
            controls={bodyId}
          />
        ) : undefined
      }
      className={cls}
      stance={stance}
      tone={tone}
    >
      {description !== undefined && description !== '' && <PropertyNote>{description}</PropertyNote>}
      <div id={bodyId} className={s.groupBody} hidden={folded}>
        {children}
      </div>
    </MotifFrame>
  );
}
