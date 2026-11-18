import { pref, type PrefValuesOf } from '@weasel-js/prefs-schema';

/** The rulers' settings, as a prefs group to mount in an app's schema. */
export const rulersSchema = pref.group('Rulers', {
  visible: pref.boolean('Show rulers', false, {
    description: 'Rulers along the top and left of the canvas, in the units of the frame under the pointer. Drag from one to place a guide.',
  }),
});

/** The rulers' settings: the values a {@link rulersSchema} group holds. */
export type RulersSettings = PrefValuesOf<typeof rulersSchema>;
