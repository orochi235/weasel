import type { UnitScope } from '@weasel-js/quantity';
import type { NodeClip } from './types';

interface Stated {
  kind?: 'mark' | 'group'; pickable?: boolean; hidden?: boolean; locked?: boolean; units?: UnitScope;
  clip?: NodeClip;
}

/** The plain optional fields of a node or spec as a spread for `scene.add`:
 *  each present only when stated, so an unstated one keeps the scene's
 *  default. A leaf states no `units`, and a flag states only `true`. */
export const statedFields = (n: Stated): Omit<Stated, 'kind'> => ({
  ...(n.pickable !== undefined ? { pickable: n.pickable } : {}),
  ...(n.hidden === true ? { hidden: true } : {}),
  ...(n.locked === true ? { locked: true } : {}),
  ...(n.units !== undefined ? { units: n.units } : {}),
  ...(n.clip !== undefined ? { clip: n.clip } : {}),
});
