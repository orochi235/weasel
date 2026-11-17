import { WHEEL_RATE } from '@weasel-js/loupe';
import { pref, type PrefValuesOf } from '@weasel-js/prefs';
import type {} from '@weasel-js/react';

/** labkit's kit settings as a prefs group whose paths are the `KitSettings` paths. */
export const labkitKitSettingsSchema = pref.group('Lab', {
  loupe: pref.group('Loupe', {
    wheelRate: pref.number('Wheel speed', WHEEL_RATE, {
      description: 'How far one unit of wheel deltaY walks the magnification, as an exponent.',
      min: 0.0005, max: 0.01, step: 0.0005,
    }),
  }),
});

/** The `loupe` kit settings area. */
export type LoupeKitSettings = PrefValuesOf<typeof labkitKitSettingsSchema>['loupe'];

declare module '@weasel-js/react' {
  interface KitSettings {
    loupe: LoupeKitSettings;
  }
}
