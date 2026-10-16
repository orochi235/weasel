import { pref } from '@weasel-js/prefs';
import type {} from '@weasel-js/react';
import { WHEEL_RATE } from './loupe/loupeActions';

/** The `loupe` kit settings area. */
export interface LoupeKitSettings {
  /** How far one unit of wheel `deltaY` walks the magnification, as an exponent. */
  wheelRate: number;
}

declare module '@weasel-js/react' {
  interface KitSettings {
    loupe: LoupeKitSettings;
  }
}

/** labkit's kit settings as a prefs group whose paths are the `KitSettings` paths. */
export const labkitKitSettingsSchema = pref.group('Lab', {
  loupe: pref.group('Loupe', {
    wheelRate: pref.number('Wheel speed', WHEEL_RATE, { min: 0.0005, max: 0.01, step: 0.0005 }),
  }),
});
