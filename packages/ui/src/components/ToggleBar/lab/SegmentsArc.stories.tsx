import { f, meta, story } from '@weasel-js/forge';
import { SEGMENTS_ARC_DEFAULTS as D, SegmentsArcView, type SegmentsArcConfig } from './SegmentsArcView';

export default meta({ title: 'ui/Foundations/ToggleBar', layout: 'fullscreen', tags: ['lab'] });

/** ToggleBar, OptionsBar and ButtonBar along the arcs of one circle, in each variant and size. */
export const OnAnArc = story({
  config: f.schema({
    variant: f.enum(D.variant, ['default', 'flat', 'minimal']).radio().label('Variant'),
    size: f.enum(D.size, ['md', 'sm']).radio().label('Size'),
    count: f.number(D.count).range(1, 8).step(1).label('Top bar segments'),
    sweep: f.number(D.sweep).range(30, 300).step(5).suffix('°').label('Sweep'),
    direction: f.enum(D.direction, ['cw', 'ccw']).radio().label('Direction'),
    box: f.number(D.box).range(200, 520).step(10).suffix('px').label('Box'),
  }),
  render: ({ config }) => <SegmentsArcView config={config as SegmentsArcConfig} />,
});
