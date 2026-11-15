import { f, meta, story } from '@weasel-js/forge';
import { BUTTON_LAB_DEFAULTS as D, type ButtonLabConfig } from './buttonLabConfig';
import { ButtonLabView } from './ButtonLabView';

export default meta({ title: 'ui/Button', layout: 'fullscreen', tags: ['lab'] });

const knob = (def: number, min: number, max: number, step: number) => f.number(def).range(min, max).step(step);

/** The glass look's custom properties, tuned live on a button or a segmented bar against a chosen backdrop, with the
 *  rule that ships the tuned look as the default. */
export const Lab = story({
  config: f.schema({
    target: f.enum(D.target, ['segmented', 'button']).radio().label('Component'),
    variant: f.enum(D.variant, ['confirm', 'solid', 'ghost']).radio().label('Variant'),
    label: f.string(D.label).label('Label'),
    accent: f.color(D.accent).label('Accent'),
    shape: f.group({
      radius: knob(D.shape.radius, 0, 999, 1).suffix('px').label('Radius'),
      height: knob(D.shape.height, 16, 64, 1).suffix('px').label('Height'),
      padx: knob(D.shape.padx, 0, 32, 1).suffix('px').label('Pad x'),
      fontsize: knob(D.shape.fontsize, 10, 24, 0.5).suffix('px').label('Font size'),
      fontweight: f.enum(D.shape.fontweight, ['200', '300', '400']).radio().label('Weight'),
    }).label('Shape & type'),
    body: f.group({
      topAlpha: knob(D.body.topAlpha, 0, 100, 1).suffix('%').label('Top α'),
      upperAlpha: knob(D.body.upperAlpha, 0, 100, 1).suffix('%').label('Upper α'),
      equator: knob(D.body.equator, 15, 85, 1).suffix('%').label('Equator y'),
      equatorSpread: knob(D.body.equatorSpread, 1, 40, 1).suffix('%').label('Equator soft'),
      equatorTint: knob(D.body.equatorTint, 50, 100, 1).suffix('%').label('Equator tint'),
      baseTint: knob(D.body.baseTint, 20, 100, 1).suffix('%').label('Base tint'),
      blur: knob(D.body.blur, 0, 20, 0.5).suffix('px').label('Blur'),
      saturate: knob(D.body.saturate, 0.5, 2.5, 0.05).label('Saturate'),
    }).label('Glass body'),
    gloss: f.group({
      top: knob(D.gloss.top, 0, 1, 0.02).label('Top α'),
      mid: knob(D.gloss.mid, 0, 1, 0.02).label('Mid α'),
      bottom: knob(D.gloss.bottom, 0, 90, 1).suffix('%').label('Ends at'),
    }).label('Specular gloss'),
    depth: f.group({
      rim: knob(D.depth.rim, 0, 0.8, 0.02).label('Rim'),
      dropNear: knob(D.depth.dropNear, 0, 0.8, 0.02).label('Drop near'),
      dropFar: knob(D.depth.dropFar, 0, 0.8, 0.02).label('Drop far'),
      insetHi: knob(D.depth.insetHi, 0, 1, 0.02).label('Inset top'),
      insetLo: knob(D.depth.insetLo, 0, 1, 0.02).label('Inset bottom'),
      textShadow: knob(D.depth.textShadow, 0, 1, 0.02).label('Text shadow'),
      textInset: knob(D.depth.textInset, 0, 1, 0.02).label('Text inset α'),
      textInsetAngle: knob(D.depth.textInsetAngle, 0, 360, 1).suffix('°').label('Text inset angle'),
      textInsetDist: knob(D.depth.textInsetDist, 0, 4, 0.25).suffix('px').label('Text inset distance'),
    }).label('3D depth'),
    view: f.group({
      zoom: knob(D.view.zoom, 1, 6, 0.1).suffix('×').label('Zoom'),
      backdrop: f.enum(D.view.backdrop, ['panel', 'glass', 'gradient', 'photo', 'grid']).radio().label('Behind'),
    }).label('View'),
  }),
  render: ({ config }) => <ButtonLabView config={config as ButtonLabConfig} />,
});
