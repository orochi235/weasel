import type {} from '@weasel-js/react';
import { pref, type PrefValuesOf } from '@weasel-js/prefs-schema';
import { DOLLY_RATE, ORBIT_RATE } from './tools';

/** The `orbit3d` area as a prefs group whose paths are the `KitSettings` paths. */
export const kernel3dKitSettingsSchema = pref.group('3D camera', {
  orbit3d: pref.group('Orbit', {
    orbitRate: pref.number('Orbit speed', ORBIT_RATE, {
      description: 'Radians of orbit per CSS pixel of drag.', min: 0.001, max: 0.03, step: 0.001,
    }),
    dollyRate: pref.number('Dolly speed', DOLLY_RATE, {
      description: 'Dolly exponent per unit of wheel deltaY.', min: 0.0002, max: 0.01, step: 0.0001,
    }),
  }),
});

/** The `orbit3d` kit settings area: how far the camera tools move per input. */
export type Orbit3dKitSettings = PrefValuesOf<typeof kernel3dKitSettingsSchema>['orbit3d'];

declare module '@weasel-js/react' {
  interface KitSettings {
    orbit3d: Orbit3dKitSettings;
  }
}
