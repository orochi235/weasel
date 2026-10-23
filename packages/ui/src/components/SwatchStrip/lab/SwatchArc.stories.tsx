import { f, meta, story } from '@weasel-js/forge';
import { SWATCH_ARC_DEFAULTS as D, type SwatchArcConfig } from './swatchArcConfig';
import { SwatchArcView } from './SwatchArcView';

/** A swatch strip along an arc, each row a ring of its own, its ring geometry read back off the page. */
export default meta({ title: 'ui/Along/Swatches on an arc', layout: 'fullscreen' });

export const Lab = story({
  config: f.schema({
    swatches: f.group({
      palettes: f.enum(D.swatches.palettes, ['basic', 'standard', 'both']).radio().label('Palettes'),
      recent: f.number(D.swatches.recent).range(0, 11).step(1).label('Recent colors'),
      columns: f.number(D.swatches.columns).range(2, 16).step(1).label('Recent per ring'),
      align: f.enum(D.swatches.align, ['start', 'center', 'end']).radio().label('Align'),
    }).label('Swatches'),
    arc: f.group({
      center: f.number(D.arc.center).range(0, 359).step(1).suffix('°').label('Centered on'),
      sweep: f.number(D.arc.sweep).range(20, 359).step(1).suffix('°').label('Sweep'),
      direction: f.enum(D.arc.direction, ['cw', 'ccw']).radio().label('Direction'),
      inset: f.number(D.arc.inset).range(0, 80).step(1).suffix('px').label('Inset'),
      size: f.number(D.arc.size).range(200, 800).step(10).suffix('px').label('Box'),
    }).label('Arc'),
  }),
  render: ({ config }) => <SwatchArcView config={config as SwatchArcConfig} />,
});
