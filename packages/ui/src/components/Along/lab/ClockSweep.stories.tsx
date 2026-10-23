import { f, meta, story } from '@weasel-js/forge';
import { ClockSweepView, type ClockSweepConfig } from './ClockSweepView';

export default meta({ title: 'ui/Along', layout: 'fullscreen', tags: ['lab'] });

/** A bar and a slider on an arc centered on every hour, and finely around 3 and 9 o'clock. */
export const ClockSweep = story({
  config: f.schema({
    span: f.number(90).range(20, 300).step(5).suffix('°').label('Arc span'),
    size: f.number(220).range(140, 320).step(10).suffix('px').label('Dial size'),
    fineRange: f.number(10).range(2, 30).step(1).suffix('°').label('Fine sweep, each side'),
    fineStep: f.number(2).range(0.5, 10).step(0.5).suffix('°').label('Fine step'),
    show: f.enum('both', ['both', 'bar', 'slider']).radio().label('Show'),
  }),
  render: ({ config }) => <ClockSweepView config={config as ClockSweepConfig} />,
});
