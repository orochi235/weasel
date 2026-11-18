import { always, never, type VisibilityRules } from '@weasel-js/core';
import { pref, type PrefValuesOf } from '@weasel-js/prefs-schema';
import { PATH_COMB_CHROME_ID } from '../comb/comb';
import { PATH_FILLETS_CHROME_ID } from '../fillet/filletWidgets';
import { PATH_DIRECTION_CHROME_ID } from '../pathStructure/directionMarks';
import { PATH_POISE_CHROME_ID } from '../poise/poiseMarks';

/** What path edit draws over the path it is editing, as a prefs group to mount in an app's schema. */
export const pathEditAidsSchema = pref.group('Path editing', {
  direction: pref.boolean('Show path direction', false, {
    description: 'While editing a path, draw an arrow on each segment the way the path runs, and a ring on its start.',
  }),
  comb: pref.boolean('Show curvature comb', false, {
    description: 'While editing a path, draw its curvature comb: a tooth on each curve as long as the curve is tight there.',
  }),
  poise: pref.boolean('Show poise lines', false, {
    description: "While editing a path, draw a line between each curve's handle tips, with a grip that drags both handles at once.",
  }),
  fillets: pref.boolean('Show fillet widgets', true, {
    description: 'While editing a path, draw a widget inside each corner that rounds it as you drag.',
  }),
});

/** Which of path edit's aids are drawn: the values a {@link pathEditAidsSchema} group holds. */
export type PathEditAids = PrefValuesOf<typeof pathEditAidsSchema>;

/** The chrome id each of path edit's aids is drawn under, by its setting. */
export const PATH_EDIT_AID_CHROME_IDS: Readonly<Record<keyof PathEditAids, string>> = {
  direction: PATH_DIRECTION_CHROME_ID,
  comb: PATH_COMB_CHROME_ID,
  poise: PATH_POISE_CHROME_ID,
  fillets: PATH_FILLETS_CHROME_ID,
};

/** The chrome rules that show the aids `aids` turns on and hide the rest, for a canvas's `chromeVisibility`. */
export function pathEditAidsVisibility(aids: PathEditAids): VisibilityRules {
  const rules: VisibilityRules = {};
  for (const [key, id] of Object.entries(PATH_EDIT_AID_CHROME_IDS)) rules[id] = aids[key as keyof PathEditAids] ? always : never;
  return rules;
}
