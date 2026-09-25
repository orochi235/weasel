import type { ReactNode } from 'react';
import { type StanceProps, useStance } from '../stance';
import s from './Properties.module.css';
import { type PropertyMetricProps, propertyMetricClass } from './PropertyPanel';

/** Props for `<Subpanel>`. */
export interface SubpanelProps extends PropertyMetricProps, StanceProps {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A typographic divider inside a property list: a small title flanked by a
 *  rule. Purely a heading — use `<PropertyGroup>` for a bordered section. A
 *  stance or tone colors the title and rule. */
export function Subpanel({ title, children, className, density, align, stance, tone }: SubpanelProps) {
  const cls = propertyMetricClass(s.subpanel, { density, align }, className);
  return (
    <div className={cls} {...useStance({ stance, tone })}>
      <h4 className={s.subpanelTitle}>
        <span>{title}</span>
        <hr />
      </h4>
      {children}
    </div>
  );
}
