import type { UnitScope } from '@weasel-js/quantity';

interface Stated { kind?: 'leaf' | 'container'; pickable?: boolean; units?: UnitScope }

/** The plain optional fields of a node or spec as a spread for `scene.add`:
 *  each present only when stated, so an unstated one keeps the scene's
 *  default. A leaf states no `units`. */
export const statedFields = (n: Stated): { pickable?: boolean; units?: UnitScope } => ({
  ...(n.pickable !== undefined ? { pickable: n.pickable } : {}),
  ...(n.kind === 'container' && n.units !== undefined ? { units: n.units } : {}),
});
