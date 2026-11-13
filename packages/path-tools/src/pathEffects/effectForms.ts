/**
 * Each path effect's settings as a form: what making one takes as params, what the last-operation panel shows
 * after it is made, and the section `editPathEffect`'s settings form shows for it. Each setting's default is
 * stated here once: the value a new effect is made with and the one an effect leaving it unset paints with.
 */
import { pref, prefLeaves, type PrefGroup } from '@weasel-js/prefs';
import type { PathEffect } from '@weasel-js/core';

type Kind = PathEffect['kind'];

const ALIGN = [{ value: 'start', label: 'Start' }, { value: 'center', label: 'Center' }, { value: 'end', label: 'End' }];

/** Each kind of path effect's settings, as a form. */
export const PATH_EFFECT_PARAMS: { readonly [K in Kind]: PrefGroup } = {
  blend: pref.group('Blend', {
    spaceBy: pref.enum('Space by', 'count', [{ value: 'count', label: 'Count' }, { value: 'distance', label: 'Distance' }], {
      description: 'Steps evenly by count, or one every distance.', control: 'toggle',
    }),
    steps: pref.number('Steps', 4, {
      description: 'Shapes between the two sources.', min: 0, max: 200, step: 1, control: 'input',
      showIf: { path: 'spaceBy', is: 'count' },
    }),
    distance: pref.number('Distance', 10, {
      description: 'From one shape’s middle to the next.', min: 0.01, max: 1000, step: 1, control: 'input',
      showIf: { path: 'spaceBy', is: 'distance' },
    }),
    autoAlign: pref.boolean('Auto-align', true, { description: 'Match each contour’s start point to keep anchors closest.' }),
    startOffset: pref.number('Start offset', 0, {
      description: 'Anchors to turn the second shape’s start by.', min: -100, max: 100, step: 1, control: 'input',
    }),
    rotate: pref.boolean('Rotate', true, { description: 'Interpolate turned sources as a turn about their middles.' }),
    orient: pref.boolean('Orient to spine', false, { description: 'Turn each step with the spine’s heading.' }),
  }),
  bendAlong: pref.group('Bend Along Path', {
    fit: pref.enum('Fit', 'stretch', [{ value: 'stretch', label: 'Stretch' }, { value: 'natural', label: 'Natural' }], {
      description: 'Stretch over the whole spine, or keep the shape’s width.', control: 'toggle',
    }),
    baseline: pref.number('Baseline', 0.5, {
      description: 'Where across the shape the spine runs: 0 top, 1 bottom.', min: 0, max: 1, step: 0.05, control: 'slider',
    }),
    flip: pref.boolean('Flip', false, { description: 'Lay the shape on the other side of the spine.' }),
    tolerance: pref.number('Tolerance', 0.5, {
      description: 'How far the refit curves may stray, in world units.', min: 0.05, max: 5, step: 0.05, control: 'slider',
    }),
  }),
  repeatAlong: pref.group('Repeat Along Path', {
    count: pref.number('Count', 5, { description: 'How many copies.', min: 0, max: 500, step: 1, control: 'input' }),
    align: pref.enum('Align', 'start', ALIGN, { description: 'Where a spaced run shorter than the path sits.', control: 'toggle' }),
    offset: pref.number('Offset', 0, {
      description: 'Slide every copy this far along the path.', min: -1000, max: 1000, step: 1, control: 'input',
    }),
    orient: pref.boolean('Orient', true, { description: 'Turn each copy to the path’s heading.' }),
  }),
  textAlong: pref.group('Text Along Path', {
    align: pref.enum('Align', 'start', ALIGN, { description: 'Which part of the text sits at Start.', control: 'toggle' }),
    start: pref.number('Start', 0, {
      description: 'Where along the path the text starts, as a share of its length.', min: 0, max: 1, step: 0.01, control: 'slider',
    }),
    shift: pref.number('Shift', 0, { description: 'Lift the text off the path by this much.', min: -1000, max: 1000, step: 1, control: 'input' }),
    anchor: pref.enum('Anchor', 'baseline', [{ value: 'baseline', label: 'Baseline' }, { value: 'center', label: 'Center' }], {
      description: 'Which line of the text runs on the path.', control: 'toggle',
    }),
    overflow: pref.enum('Overflow', 'clip', [{ value: 'clip', label: 'Clip' }, { value: 'fit', label: 'Fit' }], {
      description: 'Text longer than the path: cut off at its end, or squeezed to fit.', control: 'toggle',
    }),
    side: pref.enum('Side', 'auto', [{ value: 'auto', label: 'Auto' }, { value: 'path', label: 'Path' }, { value: 'flipped', label: 'Flipped' }], {
      description: 'Which side of the path the text stands on: whichever reads upright, or a fixed one.', control: 'toggle',
    }),
  }),
  roughen: pref.group('Roughen', {
    size: pref.number('Size', 5, { description: 'The farthest a point moves on each axis.', min: 0, max: 1000, step: 1, control: 'input' }),
    detail: pref.number('Detail', 4, { description: 'Points added to each segment before roughening.', min: 0, max: 100, step: 1, control: 'input' }),
    seed: pref.number('Seed', 0, { description: 'Picks another set of random offsets.', min: 0, max: 9999, step: 1, control: 'input' }),
  }),
  zigzag: pref.group('Zigzag', {
    size: pref.number('Size', 5, { description: 'How far each point is pushed off the outline.', min: -1000, max: 1000, step: 1, control: 'input' }),
    ridges: pref.number('Ridges', 4, { description: 'Points added to each segment.', min: 0, max: 100, step: 1, control: 'input' }),
    smooth: pref.boolean('Smooth', false, { description: 'Curve through the points instead of meeting at corners.' }),
  }),
  puckerBloat: pref.group('Pucker & Bloat', {
    amount: pref.number('Amount', 0.5, {
      description: 'Below 0 puckers the anchors into spikes; above 0 bloats the segments outward.', min: -1, max: 1, step: 0.05, control: 'slider',
    }),
  }),
};

/** Each setting of a `kind` effect and its default, by name. */
export function effectSettingDefaults(kind: Kind): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, leaf] of prefLeaves(PATH_EFFECT_PARAMS[kind])) out[path] = leaf.default;
  return out;
}
