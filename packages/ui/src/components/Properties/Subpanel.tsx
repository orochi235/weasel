import type { ReactNode } from 'react';
import { type Motif, MotifFrame } from '../MotifFrame';
import type { AppearanceProps } from '../appearance';
import { type CollapseProps, foldTitle, foldTwisty, useCollapse } from './collapse';
import s from './Properties.module.css';
import { type PropertyMetricProps, propertyMetricClass } from './metrics';

/** Props for `<Subpanel>`. */
export interface SubpanelProps extends PropertyMetricProps, AppearanceProps, CollapseProps {
  title: ReactNode;
  /** How the subpanel draws its title and edge. Defaults to the `subpanel` `<DefaultMotif>`, `divider()` unless one is set. */
  motif?: Motif;
  /** Before the title: a drag handle, an ordinal. */
  leading?: ReactNode;
  /** After the title: a summary of the rows' value, a reset button. */
  actions?: ReactNode;
  /** What the subpanel holds takes no input: its title dims, and what sits beside it does not. */
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

/** A divider inside a property list: in the default `divider` motif, a small
 *  title trailed by a rule. Use `<PropertyGroup>` for a bordered section. A
 *  stance, grade, or tint colors the title and rule. */
export function Subpanel({
  title,
  motif,
  leading,
  actions,
  disabled,
  children,
  className,
  density,
  align,
  stance,
  grade,
  emphasis,
  tint,
  collapsible,
  defaultCollapsed,
  collapsed,
  onCollapsedChange,
  twisty,
}: SubpanelProps) {
  const fold = useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty });
  return (
    <MotifFrame
      kind="subpanel"
      title={foldTitle(title, fold)}
      motif={motif}
      leading={leading}
      actions={actions}
      twisty={foldTwisty(fold, title)}
      className={propertyMetricClass(s.subpanel, { density, align }, className)}
      disabled={disabled}
      stance={stance}
      grade={grade}
      emphasis={emphasis}
      tint={tint}
    >
      <div className={s.subpanelBody} {...fold.body}>
        {children}
      </div>
    </MotifFrame>
  );
}
