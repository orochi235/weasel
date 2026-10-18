import type {} from '@weasel-js/react';
import { pref } from '@weasel-js/prefs';
import { DEFAULT_GUIDE_TOLERANCE_PX } from './strategies/guides';

declare module '@weasel-js/react' {
  interface KitSettings {
    targets: KitTargetSettings;
  }
  interface KitTargetSettings {
    /** How near a guide line, in screen px, a snap to it reaches. */
    guideSnapPx: number;
  }
}

/** guides' kit settings as a prefs group whose paths are the `KitSettings` paths. */
export const guidesKitSettingsSchema = pref.group('Guides', {
  targets: pref.group('Targets', {
    guideSnapPx: pref.number('Guide snap reach', DEFAULT_GUIDE_TOLERANCE_PX, {
      unit: { scale: 1, suffix: 'px' }, min: 0, max: 48, step: 0.5,
    }),
  }),
});
