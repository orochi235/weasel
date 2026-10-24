import type { UnitScope } from '@weasel-js/quantity';
import type { NodeClip } from './types';

/** The plain optional fields a node or an `AddNodeSpec` may state. */
export interface StatedNodeFields {
  pickable?: boolean;
  hidden?: boolean;
  locked?: boolean;
  units?: UnitScope;
  clip?: NodeClip;
}

/** The plain optional fields of a node or spec as a spread for `scene.add`:
 *  each present only when stated, so an unstated one keeps the scene's
 *  default, and a flag states only `true`. What a copy of a node carries over
 *  besides its kind, layer, pose, data and functions. */
export const statedFields = (n: StatedNodeFields & { kind?: string }): StatedNodeFields => ({
  ...(n.pickable !== undefined ? { pickable: n.pickable } : {}),
  ...(n.hidden === true ? { hidden: true } : {}),
  ...(n.locked === true ? { locked: true } : {}),
  ...(n.units !== undefined ? { units: n.units } : {}),
  ...(n.clip !== undefined ? { clip: n.clip } : {}),
});
