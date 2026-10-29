/**
 * `editPathEffect`'s settings form: a section per kind of effect the
 * selection holds, the values they hold, and the params a change makes.
 */
import type { ActionDeps, ActionSettings, ActionSettingsState } from '@weasel-js/routing';
import type { PrefGroup } from '@weasel-js/prefs';
import { pathEffectOf, type NodeId, type PathEffect, type Scene } from '@weasel-js/core';
import { SettingsFields } from '../settingsFields';

type Kind = PathEffect['kind'];
const KINDS: readonly Kind[] = ['blend', 'bendAlong', 'repeatAlong', 'textAlong', 'roughen', 'zigzag', 'puckerBloat'];
const COUNT: Record<Kind, string> = {
  blend: 'blends', bendAlong: 'bends', repeatAlong: 'repeats', textAlong: 'texts',
  roughen: 'roughens', zigzag: 'zigzags', puckerBloat: 'puckerBloats',
};

/** Each field's value where an effect leaves it unset, so a form never shows
 *  a default the effect does not paint with. */
const DEFAULTS: { [K in Kind]: Record<string, unknown> } = {
  blend: { steps: 4, spaceBy: 'count', distance: 10, autoAlign: true, startOffset: 0, rotate: true, orient: false },
  bendAlong: { fit: 'stretch', baseline: 0.5, flip: false, tolerance: 0.5 },
  repeatAlong: { count: 5, align: 'start', offset: 0, orient: true },
  textAlong: { align: 'start', start: 0, shift: 0, anchor: 'baseline', overflow: 'clip', side: 'auto' },
  roughen: { size: 5, detail: 4, seed: 0 },
  zigzag: { size: 5, ridges: 4, smooth: false },
  puckerBloat: { amount: 0.5 },
};

const hidden = (name: string) => ({ kind: 'number' as const, name, description: '', default: 0, hidden: true });

/** The path-effect settings as a prefs schema. */
export const PATH_EFFECT_SETTINGS_SCHEMA: PrefGroup = {
  name: 'Path Effect',
  children: {
    blends: hidden('Selected blends'),
    bends: hidden('Selected bends'),
    repeats: hidden('Selected repeats'),
    texts: hidden('Selected texts'),
    roughens: hidden('Selected roughens'),
    zigzags: hidden('Selected zigzags'),
    puckerBloats: hidden('Selected puckers and bloats'),
    blend: {
      name: 'Blend',
      as: 'section',
      showIf: { path: 'blends', above: 0 },
      children: {
        spaceBy: {
          kind: 'enum', name: 'Space by', description: 'Steps evenly by count, or one every distance.',
          default: 'count', control: 'toggle',
          options: [{ value: 'count', label: 'Count' }, { value: 'distance', label: 'Distance' }],
        },
        steps: {
          kind: 'number', name: 'Steps', description: 'Shapes between the two sources.', default: 4, min: 0, max: 200, step: 1,
          control: 'input', showIf: { path: 'blend.spaceBy', is: 'count' },
        },
        distance: {
          kind: 'number', name: 'Distance', description: 'From one shape’s middle to the next.', default: 10, min: 0.01, step: 1,
          control: 'input', showIf: { path: 'blend.spaceBy', is: 'distance' },
        },
        autoAlign: { kind: 'boolean', name: 'Auto-align', description: 'Match each contour’s start point to keep anchors closest.', default: true },
        startOffset: { kind: 'number', name: 'Start offset', description: 'Anchors to turn the second shape’s start by.', default: 0, step: 1, control: 'input' },
        rotate: { kind: 'boolean', name: 'Rotate', description: 'Interpolate turned sources as a turn about their middles.', default: true },
        orient: { kind: 'boolean', name: 'Orient to spine', description: 'Turn each step with the spine’s heading.', default: false },
      },
    },
    bendAlong: {
      name: 'Bend Along Path',
      as: 'section',
      showIf: { path: 'bends', above: 0 },
      children: {
        fit: {
          kind: 'enum', name: 'Fit', description: 'Stretch over the whole spine, or keep the shape’s width.',
          default: 'stretch', control: 'toggle',
          options: [{ value: 'stretch', label: 'Stretch' }, { value: 'natural', label: 'Natural' }],
        },
        baseline: { kind: 'number', name: 'Baseline', description: 'Where across the shape the spine runs: 0 top, 1 bottom.', default: 0.5, min: 0, max: 1, step: 0.05, control: 'slider' },
        flip: { kind: 'boolean', name: 'Flip', description: 'Lay the shape on the other side of the spine.', default: false },
        tolerance: { kind: 'number', name: 'Tolerance', description: 'How far the refit curves may stray, in world units.', default: 0.5, min: 0.05, max: 5, step: 0.05, control: 'slider' },
      },
    },
    repeatAlong: {
      name: 'Repeat Along Path',
      as: 'section',
      showIf: { path: 'repeats', above: 0 },
      children: {
        count: { kind: 'number', name: 'Count', description: 'How many copies.', default: 5, min: 0, max: 500, step: 1, control: 'input' },
        align: {
          kind: 'enum', name: 'Align', description: 'Where a spaced run shorter than the path sits.',
          default: 'start', control: 'toggle',
          options: [{ value: 'start', label: 'Start' }, { value: 'center', label: 'Center' }, { value: 'end', label: 'End' }],
        },
        offset: { kind: 'number', name: 'Offset', description: 'Slide every copy this far along the path.', default: 0, step: 1, control: 'input' },
        orient: { kind: 'boolean', name: 'Orient', description: 'Turn each copy to the path’s heading.', default: true },
      },
    },
    textAlong: {
      name: 'Text Along Path',
      as: 'section',
      showIf: { path: 'texts', above: 0 },
      children: {
        align: {
          kind: 'enum', name: 'Align', description: 'Which part of the text sits at Start.',
          default: 'start', control: 'toggle',
          options: [{ value: 'start', label: 'Start' }, { value: 'center', label: 'Center' }, { value: 'end', label: 'End' }],
        },
        start: { kind: 'number', name: 'Start', description: 'Where along the path the text starts, as a share of its length.', default: 0, min: 0, max: 1, step: 0.01, control: 'slider' },
        shift: { kind: 'number', name: 'Shift', description: 'Lift the text off the path by this much.', default: 0, step: 1, control: 'input' },
        anchor: {
          kind: 'enum', name: 'Anchor', description: 'Which line of the text runs on the path.',
          default: 'baseline', control: 'toggle',
          options: [{ value: 'baseline', label: 'Baseline' }, { value: 'center', label: 'Center' }],
        },
        overflow: {
          kind: 'enum', name: 'Overflow', description: 'Text longer than the path: cut off at its end, or squeezed to fit.',
          default: 'clip', control: 'toggle',
          options: [{ value: 'clip', label: 'Clip' }, { value: 'fit', label: 'Fit' }],
        },
        side: {
          kind: 'enum', name: 'Side', description: 'Which side of the path the text stands on: whichever reads upright, or a fixed one.',
          default: 'auto', control: 'toggle',
          options: [{ value: 'auto', label: 'Auto' }, { value: 'path', label: 'Path' }, { value: 'flipped', label: 'Flipped' }],
        },
      },
    },
    roughen: {
      name: 'Roughen',
      as: 'section',
      showIf: { path: 'roughens', above: 0 },
      children: {
        size: { kind: 'number', name: 'Size', description: 'The farthest a point moves on each axis.', default: 5, min: 0, step: 1, control: 'input' },
        detail: { kind: 'number', name: 'Detail', description: 'Points added to each segment before roughening.', default: 4, min: 0, max: 100, step: 1, control: 'input' },
        seed: { kind: 'number', name: 'Seed', description: 'Picks another set of random offsets.', default: 0, step: 1, control: 'input' },
      },
    },
    zigzag: {
      name: 'Zigzag',
      as: 'section',
      showIf: { path: 'zigzags', above: 0 },
      children: {
        size: { kind: 'number', name: 'Size', description: 'How far each point is pushed off the outline.', default: 5, step: 1, control: 'input' },
        ridges: { kind: 'number', name: 'Ridges', description: 'Points added to each segment.', default: 4, min: 0, max: 100, step: 1, control: 'input' },
        smooth: { kind: 'boolean', name: 'Smooth', description: 'Curve through the points instead of meeting at corners.', default: false },
      },
    },
    puckerBloat: {
      name: 'Pucker & Bloat',
      as: 'section',
      showIf: { path: 'puckerBloats', above: 0 },
      children: {
        amount: { kind: 'number', name: 'Amount', description: 'Below 0 puckers the anchors into spikes; above 0 bloats the segments outward.', default: 0.5, min: -1, max: 1, step: 0.05, control: 'slider' },
      },
    },
  },
};

/** What the form shows for the selected path effects. */
export function readPathEffectSettings(deps: ActionDeps): ActionSettingsState {
  const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
  const fields = new SettingsFields();
  const counts: Record<string, number> = Object.fromEntries(Object.values(COUNT).map((name) => [name, 0]));
  for (const id of deps.selection?.get() ?? []) {
    const effect = pathEffectOf(scene?.get(id as NodeId));
    if (!effect) continue;
    counts[COUNT[effect.kind]]!++;
    for (const [field, fallback] of Object.entries(DEFAULTS[effect.kind])) {
      fields.add(`${effect.kind}.${field}`, (effect as unknown as Record<string, unknown>)[field] ?? fallback);
    }
  }
  return fields.state(counts);
}

/** A field's change as `editPathEffect` params, reaching only effects of the
 *  kind whose section it was made in. */
export function pathEffectSettingsParams(path: string, value: unknown): Record<string, unknown> | null {
  const [kind, field] = path.split('.') as [Kind, string | undefined];
  return field !== undefined && KINDS.includes(kind) ? { kind, [field]: value } : null;
}

/** `editPathEffect`'s form. */
export const pathEffectSettingsForm: ActionSettings = {
  schema: PATH_EFFECT_SETTINGS_SCHEMA,
  read: readPathEffectSettings,
  params: pathEffectSettingsParams,
};
