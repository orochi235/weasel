import { f, meta, story } from '@weasel-js/forge';
import { LensRimView, type LensRimConfig } from './LensRimView';

/** A round lens with a Bar along its top rim and its zoom Slider along the bottom; presses in the middle reach the picture. */
export default meta({ title: 'ui/Along/Lens rim', layout: 'fullscreen' });

export const Lab = story({
  config: f.schema({
    size: f.number(260).range(160, 420).step(10).suffix('px').label('Size'),
    turn: f.number(0).range(0, 359).step(1).suffix('°').label('Turn'),
    actions: f.number(6).range(1, 10).step(1).label('Actions'),
    overflow: f.enum('scroll', ['scroll', 'menu']).radio().label('Overflow'),
    boxes: f.boolean(false).label('Debug: outline each item, its glyph, its spot and its up'),
  }),
  render: ({ config }) => <LensRimView config={config as LensRimConfig} />,
});
