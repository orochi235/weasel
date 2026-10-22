import { f, meta, story } from '@weasel-js/forge';
import { loadInto } from '../../Along/lab/Presets';
import { SLIDER_ARC_DEFAULTS as D, type SliderArcConfig } from './sliderArcConfig';
import { SliderArcView } from './SliderArcView';

/** Every Slider prop on an arc, beside a straight twin given the same props and value. */
export default meta({ title: 'ui/Along/Slider on an arc', layout: 'fullscreen' });

export const Lab = story({
  config: f.schema({
    arc: f.group({
      start: f.number(D.arc.start).range(0, 359).step(1).suffix('°').label('Start'),
      end: f.number(D.arc.end).range(0, 359).step(1).suffix('°').label('End'),
      direction: f.enum(D.arc.direction, ['cw', 'ccw']).radio().label('Direction'),
      inset: f.number(D.arc.inset).range(0, 80).step(1).suffix('px').label('Inset'),
      size: f.number(D.arc.size).range(160, 420).step(10).suffix('px').label('Box'),
    }).label('Arc'),
    values: f.group({
      min: f.number(D.values.min).step(1).label('Min'),
      max: f.number(D.values.max).step(1).label('Max'),
      step: f.number(D.values.step).range(0.01, 50).step(0.01).label('Step'),
      thumbs: f.number(D.values.thumbs).range(1, 3).step(1).label('Thumbs'),
      constraint: f.enum(D.values.constraint, ['free', 'ordered']).radio().label('Constraint'),
      link: f.boolean(D.values.link).label('Twins share one value'),
    }).label('Values'),
    stops: f.group({
      set: f.enum(D.stops.set, ['none', 'quarters', 'labeled', 'uneven']).label('Stops'),
      showStops: f.boolean(D.stops.showStops).label('Show stops'),
      stopLabels: f.enum(D.stops.stopLabels, ['all', 'ends', 'none']).radio().label('Stop labels'),
      snap: f.enum(D.stops.snap, ['magnetic', 'strict']).radio().label('Snap'),
      spacing: f.enum(D.stops.spacing, ['linear', 'even']).radio().label('Spacing'),
    }).label('Stops'),
    behavior: f.group({
      trackClick: f.enum(D.behavior.trackClick, ['default', 'none', 'move-nearest']).label('Track click'),
      allowShiftAll: f.boolean(D.behavior.allowShiftAll).label('Shift-drag moves all'),
      thumbFit: f.enum(D.behavior.thumbFit, ['inside', 'overhang']).radio().label('Thumb fit'),
      endless: f.enum(D.behavior.endless, ['none', 'min', 'max', 'both']).label('Endless'),
      addRemove: f.boolean(D.behavior.addRemove).label('Add and remove thumbs'),
    }).label('Behavior'),
    look: f.group({
      trackHeight: f.number(D.look.trackHeight).range(2, 32).step(1).suffix('px').label('Track height'),
      density: f.enum(D.look.density, ['default', 'slim']).radio().label('Density'),
      readoutPlacement: f.enum(D.look.readoutPlacement, ['none', 'inline-after', 'below-thumb']).label('Readout'),
      thumbShape: f.enum(D.look.thumbShape, ['round', 'notched']).radio().label('Thumb'),
    }).label('Look'),
  }),
  render: ({ config, setConfig }) => (
    <SliderArcView config={config as SliderArcConfig} onPreset={(p) => loadInto(setConfig, p.config)} />
  ),
});
