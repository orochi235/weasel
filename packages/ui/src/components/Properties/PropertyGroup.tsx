import type { MouseEventHandler, ReactNode } from 'react';
import { type Motif, MotifFrame } from '../MotifFrame';
import type { AppearanceProps } from '../appearance';
import { type CollapseProps, foldTitle, foldTwisty, useCollapse } from './collapse';
import s from './Properties.module.css';
import { type PropertyListPack, PropertyNote } from './PropertyList';
import { type PropertyMetricProps, propertyMetricClass } from './metrics';

/** Props for `<PropertyGroup>`. */
export interface PropertyGroupProps extends PropertyMetricProps, AppearanceProps, CollapseProps {
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
  /** What the group holds takes no input: its title dims, and what sits beside it does not. */
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  /** Take the whole width of a packed grid, like `<PropertyRow span>`: a group
   *  lays its own rows out, so half a column leaves them overlapping. */
  span?: boolean;
  /** How rows pack into the 2-column grid — see `<PropertyList pack>`. */
  pack?: PropertyListPack;
  /** A right-click anywhere on the group. */
  onContextMenu?: MouseEventHandler;
}

/**
 * Visually-bordered group inside a PropertyList. Use to scope a set of
 * related rows under a heading.
 *
 * A collapsible group keeps its rows mounted and hides them, so a control's
 * local state survives being folded away. The appearance props work as on
 * `<PropertyPanel>`; in the default `rule` motif a tint also draws the group's leading edge, which is how a list
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
  disabled,
  collapsible,
  defaultCollapsed,
  collapsed,
  onCollapsedChange,
  twisty,
  children,
  className,
  span,
  pack = 'auto-color',
  density,
  align,
  stance,
  grade,
  emphasis,
  tint,
  onContextMenu,
}: PropertyGroupProps) {
  const fold = useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty });
  if (hidden) return null;

  const base = `${s.group}${pack === 'pairs' ? ` ${s.groupPairs}` : pack === 'one-up' ? ` ${s.groupOneUp}` : ''}`;
  const cls = propertyMetricClass(span ? `${base} ${s.span}` : base, { density, align }, className);
  return (
    <MotifFrame
      title={foldTitle(title, fold)}
      motif={motif}
      leading={leading}
      actions={actions}
      twisty={foldTwisty(fold, title)}
      className={cls}
      disabled={disabled}
      stance={stance}
      grade={grade}
      emphasis={emphasis}
      tint={tint}
      onContextMenu={onContextMenu}
    >
      {description !== undefined && description !== '' && <PropertyNote>{description}</PropertyNote>}
      <div className={s.groupBody} {...fold.body}>
        {children}
      </div>
    </MotifFrame>
  );
}
