import { f, meta, story } from '@weasel-js/forge';
import { RADIO_ARC_DEFAULTS as D, RadioArcView, type RadioArcConfig } from './RadioArcView';

/** Radio groups along an arc: one over the top of a circle and one under it, each with its label leading. */
export default meta({ title: 'ui/Along/RadioGroup on an arc', layout: 'fullscreen' });

export const Lab = story({
  config: f.schema({
    choices: f.number(D.choices).range(1, 6).step(1).label('Choices'),
    sweep: f.number(D.sweep).range(40, 340).step(5).suffix('°').label('Sweep'),
    inset: f.number(D.inset).range(0, 80).step(1).suffix('px').label('Inset'),
    size: f.number(D.size).range(200, 480).step(10).suffix('px').label('Box'),
    invalid: f.boolean(D.invalid).label('Invalid'),
  }),
  render: ({ config }) => <RadioArcView config={config as RadioArcConfig} />,
});
