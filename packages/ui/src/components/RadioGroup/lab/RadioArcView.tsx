import { useState, type CSSProperties, type ReactElement } from 'react';
import { Along, type AlongArc } from '@weasel-js/ui/components/Along';
import { Radio, RadioGroup } from '@weasel-js/ui/components/RadioGroup';
import { Readouts } from '../../Along/lab/Readouts';
import lab from '../../Along/lab/lab.stories.module.css';
import s from './RadioArc.stories.module.css';

/** The knobs the lab reads. */
export interface RadioArcConfig {
  choices: number;
  sweep: number;
  inset: number;
  size: number;
  invalid: boolean;
}

export const RADIO_ARC_DEFAULTS: RadioArcConfig = { choices: 3, sweep: 160, inset: 24, size: 320, invalid: false };

const SIZES = ['Small', 'Medium', 'Large', 'Huge', 'Vast', 'Tiny'];

/** The arc over the top of the box and the one under its bottom, both reading left to right. */
export function radioArcs({ sweep, inset }: Pick<RadioArcConfig, 'sweep' | 'inset'>): { top: AlongArc; bottom: AlongArc } {
  const span = `${sweep}deg` as const;
  return { top: { at: 0, span, inset }, bottom: { at: 180, span, direction: 'ccw', inset } };
}

/** One group along an arc: its label leading, its description and any error one row in toward the middle. */
function Group({ arc, name, value, onChange, choices, invalid }: { arc: AlongArc; name: string; value: string; onChange: (v: string) => void; choices: number; invalid: boolean }) {
  return (
    <Along arc={arc}>
      <RadioGroup label={name} description="Pick one size" value={value} onChange={onChange} isInvalid={invalid} errorMessage="Not in stock">
        {SIZES.slice(0, choices).map((size) => <Radio key={size} value={size}>{size}</Radio>)}
      </RadioGroup>
    </Along>
  );
}

/** A radio group along the top of a circle and another along its bottom, so the inward side shows on both. */
export function RadioArcView({ config }: { config: RadioArcConfig }): ReactElement {
  const { top, bottom } = radioArcs(config);
  const [upper, setUpper] = useState(SIZES[0]!);
  const [lower, setLower] = useState(SIZES[1]!);
  const box = { '--box': `${config.size}px` } as CSSProperties;
  return (
    <div className={lab.lab}>
      <section className={lab.section} aria-label="Radio groups">
        <h3 className={lab.sectionTitle}>Radio groups along the top and the bottom</h3>
        <div className={s.box} style={box} data-lab-box="radios">
          <Group arc={top} name="Top" value={upper} onChange={setUpper} choices={config.choices} invalid={config.invalid} />
          <Group arc={bottom} name="Bottom" value={lower} onChange={setLower} choices={config.choices} invalid={config.invalid} />
        </div>
      </section>
      <div className={`${lab.stack} ${lab.side}`}>
        <Readouts title="State" rows={[{ id: 'top', label: 'top', value: upper }, { id: 'bottom', label: 'bottom', value: lower }]} />
        <p className={lab.note}>Arrow keys move along each group in reading order. The description, and the error when invalid, sit inside the bend.</p>
      </div>
    </div>
  );
}
