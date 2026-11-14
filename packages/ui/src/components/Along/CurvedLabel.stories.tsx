import { f, meta, story } from '@weasel-js/forge';
import type { CSSProperties } from 'react';
import { Along, CurvedLabel, type AlongArc, type RunAlign } from '@weasel-js/ui/components/Along';
import s from './CurvedLabel.stories.module.css';

/** A line of text laid along the arc of the `Along` it sits in. */
export default meta({ title: 'ui/CurvedLabel' });

interface CurvedLabelConfig {
  text: string;
  at: number;
  span: number;
  direction: 'cw' | 'ccw';
  inset: number;
  align: RunAlign;
  offset: number;
  shift: number;
  size: number;
}

export const Default = story({
  config: f.schema({
    text: f.string('Text along a curve').label('Text'),
    at: f.number(0).range(0, 359).step(1).suffix('°').label('Centered on'),
    span: f.number(180).range(10, 360).step(5).suffix('°').label('Span'),
    direction: f.enum('cw', ['cw', 'ccw']).radio().label('Direction'),
    inset: f.number(16).range(0, 80).step(1).suffix('px').label('Inset'),
    align: f.enum('center', ['start', 'center', 'end']).radio().label('Align'),
    offset: f.number(0).range(-200, 200).step(1).suffix('px').label('Offset'),
    shift: f.number(0).range(-40, 40).step(1).suffix('px').label('Shift'),
    size: f.number(280).range(160, 480).step(10).suffix('px').label('Box'),
  }),
  render: ({ config }) => {
    const c = config as CurvedLabelConfig;
    const arc: AlongArc = { at: c.at, span: `${c.span}deg`, direction: c.direction, inset: c.inset };
    return (
      <div className={s.box} style={{ '--box': `${c.size}px` } as CSSProperties}>
        <Along arc={arc} align={c.align}>
          <CurvedLabel text={c.text} offset={c.offset} shift={c.shift} />
        </Along>
      </div>
    );
  },
});
