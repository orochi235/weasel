import { f, meta, story } from '@weasel-js/forge';
import { CurvedLabelView, type CurvedLabelConfig } from './CurvedLabelView';

/** A text label laid along an arc, one span per grapheme placed with geom's placeAlongRun: across the top and across the bottom. */
export default meta({ title: 'ui/Along/Curved label', layout: 'fullscreen' });

export const Lab = story({
  config: f.schema({
    text: f.string('Text along a curve').label('Text'),
    size: f.number(300).range(160, 480).step(10).suffix('px').label('Size'),
    align: f.enum('center', ['start', 'center', 'end']).radio().label('Align'),
  }),
  render: ({ config }) => <CurvedLabelView config={config as CurvedLabelConfig} />,
});
