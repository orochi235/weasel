import type {} from '@weasel-js/react';
import { pref } from '@weasel-js/prefs';
import { JOINT_RADIUS_PX } from './bone/boneOverlay';
import { POINT_RADIUS_PX } from './weight/weightOverlay';

/** The rig tools' `targets` leaves: overlay dot sizes, in CSS px. */
export interface RigKitTargetSettings {
  boneJointRadiusPx: number;
  weightPointRadiusPx: number;
}

declare module '@weasel-js/react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface KitTargetSettings extends RigKitTargetSettings {}
}

const pxLeaf = (name: string, def: number) =>
  pref.number(name, def, { unit: { scale: 1, suffix: 'px' }, min: 1, max: 16, step: 0.5 });

/** The rig tools' `targets` leaves as a prefs group whose paths are the `KitSettings` paths. */
export const rigKitSettingsSchema = pref.group('Rig', {
  targets: pref.group('Targets', {
    boneJointRadiusPx: pxLeaf('Bone joint dot', JOINT_RADIUS_PX),
    weightPointRadiusPx: pxLeaf('Weight point dot', POINT_RADIUS_PX),
  }),
});
