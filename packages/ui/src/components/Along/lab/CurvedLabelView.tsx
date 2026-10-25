import type { CSSProperties, ReactElement } from 'react';
import { CurvedLabel, type AlongArc } from '@weasel-js/ui/components/Along';
import lab from './lab.stories.module.css';
import s from './CurvedLabel.stories.module.css';

/** The knobs the lab reads. */
export interface CurvedLabelConfig {
  text: string;
  size: number;
  align: 'start' | 'center' | 'end';
}

/** The two arcs a label is laid on: across the top and across the bottom, both reading left to right. */
const LABEL_ARCS: Record<'top' | 'bottom', AlongArc> = {
  top: { start: 270, end: 90, inset: 20 },
  bottom: { start: 270, end: 90, direction: 'ccw', inset: 20 },
};

/** The lab: one label on a top arc and the same on a bottom arc. */
export function CurvedLabelView({ config }: { config: CurvedLabelConfig }): ReactElement {
  return (
    <div className={lab.lab}>
      {(['top', 'bottom'] as const).map((name) => (
        <div key={name} className={s.box} style={{ '--box': `${config.size}px` } as CSSProperties}>
          <CurvedLabel text={config.text} arc={LABEL_ARCS[name]} align={config.align} />
        </div>
      ))}
    </div>
  );
}
