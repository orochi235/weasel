import type { UnitScope } from '@weasel-js/quantity';
import type { NodeClip } from './types';

/** The plain optional fields a node or an `AddNodeSpec` may state. */
export interface StatedNodeFields {
  pickable?: boolean;
  hidden?: boolean;
  locked?: boolean;
  units?: UnitScope;
  clip?: NodeClip;
  consumesChildren?: boolean;
}

/** The plain optional fields of a node or spec as a spread for `scene.add`:
 *  each present only when stated, so an unstated one keeps the scene's
 *  default, and a flag states only `true`. What a copy of a node carries over
 *  besides its kind, layer, pose, data and functions. */
export function statedFields(n: StatedNodeFields & { kind?: string }): StatedNodeFields {
  const out: StatedNodeFields = {};
  if (n.pickable !== undefined) out.pickable = n.pickable;
  if (n.hidden === true) out.hidden = true;
  if (n.locked === true) out.locked = true;
  if (n.units !== undefined) out.units = n.units;
  if (n.clip !== undefined) out.clip = n.clip;
  if (n.consumesChildren === true) out.consumesChildren = true;
  return out;
}
