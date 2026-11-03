import type { UnitScope } from '@weasel-js/quantity';
import type { NodeClip } from './types';
import type { PageInfo, PageRunInfo } from '../pages/pageNodes';

/** The plain optional fields a node or an `AddNodeSpec` may state. */
export interface StatedNodeFields {
  pickable?: boolean;
  hidden?: boolean;
  locked?: boolean;
  units?: UnitScope;
  clip?: NodeClip;
  consumesChildren?: boolean;
  page?: PageInfo;
  pageRun?: PageRunInfo;
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
  if (n.page !== undefined) out.page = n.page;
  if (n.pageRun !== undefined) out.pageRun = n.pageRun;
  return out;
}
