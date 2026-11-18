import type { PrefValuesOf } from '@weasel-js/prefs-schema';
import type { KitSettingsStore } from '@weasel-js/react';
import type { GestureKitSettings } from '@weasel-js/routing';
import type { coreKitSettingsSchema } from './kitSettingsSchema';

export type { GestureKitSettings };

/** Core's `targets` leaves: hit radii and overlay dot sizes, in CSS px. */
export type CoreKitTargetSettings = PrefValuesOf<typeof coreKitSettingsSchema>['targets'];

/** Core's `view` area. */
export type ViewKitSettings = PrefValuesOf<typeof coreKitSettingsSchema>['view'];

declare module '@weasel-js/react' {
  interface KitSettings {
    targets: KitTargetSettings;
    view: ViewKitSettings;
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface KitTargetSettings extends CoreKitTargetSettings {}
}

declare module '@weasel-js/routing' {
  interface DepSchema {
    /** The kit settings of the provider above `<SceneCanvas>`, for an action
     *  to read a threshold or radius at the moment it uses one. */
    kitSettings?: KitSettingsStore;
  }
}
