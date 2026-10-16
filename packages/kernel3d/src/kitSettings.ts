import { pref } from '@weasel-js/prefs';
import { DOLLY_RATE, ORBIT_RATE } from './tools';

/** The `orbit3d` kit settings area: how far the camera tools move per input. */
export interface Orbit3dKitSettings {
  /** Radians of orbit per CSS pixel of drag. */
  orbitRate: number;
  /** Dolly exponent per unit of wheel `deltaY`. */
  dollyRate: number;
}

declare module '@weasel-js/react' {
  interface KitSettings {
    orbit3d: Orbit3dKitSettings;
  }
}

/** The `orbit3d` area as a prefs group whose paths are the `KitSettings` paths. */
export const kernel3dKitSettingsSchema = pref.group('3D camera', {
  orbit3d: pref.group('Orbit', {
    orbitRate: pref.number('Orbit speed', ORBIT_RATE, { min: 0.001, max: 0.03, step: 0.001 }),
    dollyRate: pref.number('Dolly speed', DOLLY_RATE, { min: 0.0002, max: 0.01, step: 0.0001 }),
  }),
});
