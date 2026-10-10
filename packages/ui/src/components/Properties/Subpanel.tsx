import { type ReactNode, useId } from 'react';
import { Disclosure } from '../Disclosure';
import { type StanceProps, useStance } from '../stance';
import { type CollapseProps, foldTitle, twistyClass, useCollapse } from './collapse';
import s from './Properties.module.css';
import { type PropertyMetricProps, propertyMetricClass } from './PropertyPanel';

/** Props for `<Subpanel>`. */
export interface SubpanelProps extends PropertyMetricProps, StanceProps, CollapseProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A typographic divider inside a property list: a small title flanked by a
 *  rule. Purely a heading — use `<PropertyGroup>` for a bordered section. A
 *  stance or tone colors the title and rule. */
export function Subpanel({
  title,
  children,
  className,
  density,
  align,
  stance,
  tone,
  collapsible,
  defaultCollapsed,
  collapsed,
  onCollapsedChange,
  twisty,
}: SubpanelProps) {
  const cls = propertyMetricClass(s.subpanel, { density, align }, className);
  const bodyId = useId();
  const fold = useCollapse({ collapsible, defaultCollapsed, collapsed, onCollapsedChange, twisty });
  const { folds, folded, toggle } = fold;
  return (
    <div className={cls} {...useStance({ stance, tone })}>
      {/* The twisty is a sibling of the heading, so it stays out of its accessible name. */}
      <div className={s.subpanelTitle}>
        {folds && (
          <Disclosure
            className={twistyClass(fold)}
            open={!folded}
            onToggle={toggle}
            label={typeof title === 'string' ? title : 'this section'}
            controls={bodyId}
          />
        )}
        <h4>{foldTitle(title, fold)}</h4>
        <hr />
      </div>
      {folds ? (
        <div id={bodyId} className={s.subpanelBody} hidden={folded}>
          {children}
        </div>
      ) : children}
    </div>
  );
}
