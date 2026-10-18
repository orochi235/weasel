import type { UnitScope } from '@weasel-js/quantity';

interface Stated {
  kind?: 'leaf' | 'container'; pickable?: boolean; hidden?: boolean; locked?: boolean; units?: UnitScope;
}

/** The plain optional fields of a node or spec as a spread for `scene.add`:
 *  each present only when stated, so an unstated one keeps the scene's
 *  default. A leaf states no `units`, and a flag states only `true`. */
export const statedFields = (n: Stated): Omit<Stated, 'kind'> => ({
  ...(n.pickable !== undefined ? { pickable: n.pickable } : {}),
  ...(n.hidden === true ? { hidden: true } : {}),
  ...(n.locked === true ? { locked: true } : {}),
  ...(n.kind === 'container' && n.units !== undefined ? { units: n.units } : {}),
});
