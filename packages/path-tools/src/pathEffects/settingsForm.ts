/**
 * `editPathEffect`'s settings form: a section per kind of effect the
 * selection holds, the values they hold, and the params a change makes.
 */
import type { ActionDeps, ActionSettingsOf, ActionSettingsState } from '@weasel-js/routing';
import { mapPrefConditionPaths, type PrefGroup } from '@weasel-js/prefs';
import { pathEffectOf, type NodeId, type PathEffect, type AnyScene } from '@weasel-js/core';
import { SettingsFields } from '../settingsFields';
import { effectSettingDefaults, PATH_EFFECT_PARAMS } from './effectForms';
import { effectSettings } from './params';
import type { EditPathEffectParams } from '../actionParamSchema';

type Kind = PathEffect['kind'];
const KINDS: readonly Kind[] = ['tween', 'bendAlong', 'repeatAlong', 'textAlong', 'roughen', 'zigzag', 'puckerBloat'];
const COUNT: Record<Kind, string> = {
  tween: 'tweens', bendAlong: 'bends', repeatAlong: 'repeats', textAlong: 'texts',
  roughen: 'roughens', zigzag: 'zigzags', puckerBloat: 'puckerBloats',
};
const COUNT_NAME: Record<Kind, string> = {
  tween: 'Selected tweens', bendAlong: 'Selected bends', repeatAlong: 'Selected repeats', textAlong: 'Selected texts',
  roughen: 'Selected roughens', zigzag: 'Selected zigzags', puckerBloat: 'Selected puckers and bloats',
};

/** Each field's value where an effect leaves it unset, so a form never shows
 *  a default the effect does not paint with. */
const DEFAULTS = Object.fromEntries(KINDS.map((kind) => [kind, effectSettingDefaults(kind)])) as Record<Kind, Record<string, unknown>>;

const hidden = (name: string) => ({ kind: 'number' as const, name, description: '', default: 0, hidden: true });

/** `kind`'s form as a section: shown while the selection holds one, its conditions reading its leaves under
 *  its key. */
function section(kind: Kind): PrefGroup {
  const form = PATH_EFFECT_PARAMS[kind];
  const children = Object.fromEntries(Object.entries(form.children).map(([key, leaf]) => [
    key,
    leaf.showIf ? { ...leaf, showIf: mapPrefConditionPaths(leaf.showIf, (path) => `${kind}.${path}`) } : leaf,
  ]));
  return { ...form, as: 'section', showIf: { path: COUNT[kind], above: 0 }, children } as PrefGroup;
}

/** The path-effect settings as a prefs schema. */
export const PATH_EFFECT_SETTINGS_SCHEMA: PrefGroup = {
  name: 'Path Effect',
  children: {
    ...Object.fromEntries(KINDS.map((kind) => [COUNT[kind], hidden(COUNT_NAME[kind])])),
    ...Object.fromEntries(KINDS.map((kind) => [kind, section(kind)])),
  },
};

/** What the form shows for the selected path effects. */
export function readPathEffectSettings(deps: ActionDeps): ActionSettingsState {
  const scene = deps.scene as AnyScene | undefined;
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
 *  kind whose section it was made in; a value of the wrong type sets nothing. */
export function pathEffectSettingsParams(path: string, value: unknown): EditPathEffectParams | null {
  const [kind, field] = path.split('.') as [Kind, string | undefined];
  return field !== undefined && KINDS.includes(kind) ? { ...effectSettings(kind, { [field]: value }), kind } : null;
}

/** `editPathEffect`'s form. */
export const pathEffectSettingsForm: ActionSettingsOf<EditPathEffectParams> = {
  schema: PATH_EFFECT_SETTINGS_SCHEMA,
  read: readPathEffectSettings,
  params: pathEffectSettingsParams,
};
