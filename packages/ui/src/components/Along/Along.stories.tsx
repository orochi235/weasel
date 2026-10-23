import { f, meta, story } from '@weasel-js/forge';
import { useState, type CSSProperties } from 'react';
import { Along, type AlongArc, type RunAlign } from '@weasel-js/ui/components/Along';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import s from './Along.stories.module.css';

/** A control laid along an arc of its box: move the arc, change its reach, or run it the other way. */
export default meta({ title: 'ui/Along', component: Along });

const ITEMS = ['Left', 'Center', 'Right', 'Justify'].map((label) => ({ value: label.toLowerCase(), label }));

interface AlongConfig {
  at: number;
  span: number;
  unit: 'deg' | 'px';
  direction: 'cw' | 'ccw';
  inset: number;
  align: RunAlign;
  size: number;
}

function AlongDemo({ config: c }: { config: AlongConfig }) {
  const [value, setValue] = useState('left');
  const arc: AlongArc = { at: c.at, span: `${c.span}${c.unit}`, direction: c.direction, inset: c.inset };
  return (
    <div className={s.box} style={{ '--box': `${c.size}px` } as CSSProperties}>
      <Along arc={arc} align={c.align}>
        <ToggleBar items={ITEMS} value={value} onChange={setValue} ariaLabel="Alignment" />
      </Along>
    </div>
  );
}

export const Default = story({
  config: f.schema({
    at: f.number(0).range(0, 359).step(1).suffix('°').label('Centered on'),
    span: f.number(180).range(10, 720).step(5).label('Span'),
    unit: f.enum('deg', ['deg', 'px']).radio().label('Span in'),
    direction: f.enum('cw', ['cw', 'ccw']).radio().label('Direction'),
    inset: f.number(0).range(0, 80).step(1).suffix('px').label('Inset'),
    align: f.enum('center', ['start', 'center', 'end']).radio().label('Align'),
    size: f.number(280).range(160, 480).step(10).suffix('px').label('Box'),
  }),
  render: ({ config }) => <AlongDemo config={config as AlongConfig} />,
});
