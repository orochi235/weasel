import type { ReactNode } from 'react';
import { type Motif, MotifFrame } from '../MotifFrame';
import type { AppearanceProps } from '../appearance';
import { type CollapseProps, foldTitle, foldTwisty, useCollapse } from './collapse';
import s from './Properties.module.css';
import { holdScope, useDisabled, type HoldProps } from '../Disabled';
import { type PropertyMetricProps, propertyMetricClass } from './metrics';

/** Props for `<Subpanel>`. */
export interface SubpanelProps extends PropertyMetricProps, AppearanceProps, CollapseProps, HoldProps {
  title: ReactNode;
  /** How the subpanel draws its title and edge. Defaults to the `subpanel` `<DefaultMotif>`, `divider()` unless one is set. */
  motif?: Motif;
  /** Before the title: a drag handle, an ordinal. */
  leading?: ReactNode;
  /** After the title: a summary of the rows' value, a reset button. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A divider inside a property list: in the default `divider` motif, a small
 *  title trailed by a rule. Use `<PropertyGroup>` for a bordered section. A
 *  stance, grade, or tint colors the title and rule. */
export function Subpanel(props: SubpanelProps) {
  const {
    title,
    motif,
    leading,
    actions,
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
  } = props;
  // Its title dims while what it holds is disabled; what sits beside the title does not.
  const { disabled } = useDisabled(props);
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
        {holdScope(props, children)}
      </div>
    </MotifFrame>
  );
}
