import { useState, type CSSProperties, type ReactElement } from 'react';
import { Along } from '@weasel-js/ui/components/Along';
import { ButtonBar } from '@weasel-js/ui/components/ButtonBar';
import { OptionsBar } from '@weasel-js/ui/components/OptionsBar';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import s from './SegmentsArc.stories.module.css';

/** The knobs the segmented-controls-on-an-arc lab reads. */
export interface SegmentsArcConfig {
  variant: 'default' | 'flat' | 'minimal';
  size: 'md' | 'sm';
  sweep: number;
  direction: 'cw' | 'ccw';
  count: number;
  box: number;
}

export const SEGMENTS_ARC_DEFAULTS: SegmentsArcConfig = { variant: 'default', size: 'md', sweep: 120, direction: 'cw', count: 4, box: 320 };

const WORDS = ['Move', 'Scale', 'Rotate', 'Skew', 'Warp', 'Bend', 'Twist', 'Shear'];

/**
 * The three segmented controls laid on one circle: a `ToggleBar` on its top arc, a multiple-mode one with a mixed
 * segment on its bottom arc, a `ButtonBar` down its right side and an `OptionsBar` down its left.
 */
export function SegmentsArcView({ config }: { config: SegmentsArcConfig }): ReactElement {
  const { variant, size, sweep, direction, count, box } = config;
  const words = WORDS.slice(0, count);
  const [tool, setTool] = useState<string | null>(words[1] ?? null);
  const [styles, setStyles] = useState<string[]>(['Bold']);
  const [pressed, setPressed] = useState('—');
  const span = `${sweep}deg` as const;
  const common = { variant: variant === 'default' ? undefined : variant, size: size === 'md' ? undefined : size } as const;

  return (
    <div className={s.page}>
      <div className={s.box} style={{ '--box': `${box}px` } as CSSProperties}>
        <Along arc={{ at: 0, span, direction, inset: 24 }}>
          <ToggleBar ariaLabel="Tool" items={words.map((w) => ({ value: w, label: w }))} value={tool} onChange={setTool} {...common} />
        </Along>
        <Along arc={{ at: 180, span, direction, inset: 24 }}>
          <ToggleBar
            mode="multiple"
            ariaLabel="Style"
            items={['Bold', 'Italic', 'Under'].map((w) => ({ value: w, label: w }))}
            value={styles}
            mixedValues={['Italic']}
            onChange={setStyles}
            {...common}
          />
        </Along>
        <Along arc={{ at: 90, span: `${Math.min(sweep, 100)}deg`, direction, inset: 24 }}>
          <ButtonBar ariaLabel="Edit" items={['Cut', 'Copy', 'Paste'].map((w) => ({ value: w, label: w, onAction: () => setPressed(w) }))} {...common} />
        </Along>
        <Along arc={{ at: 270, span: `${Math.min(sweep, 100)}deg`, direction, inset: 24 }}>
          <OptionsBar ariaLabel="Snap" items={[{ value: 'grid', label: 'Grid', selected: true, onChange: () => {} }, { value: 'guides', label: 'Guides', selected: false, onChange: () => {} }]} {...common} />
        </Along>
      </div>
      <p data-readout="pressed">Pressed: {pressed}</p>
    </div>
  );
}
