/**
 * The boolean group: a mark whose shape is a boolean of its children's
 * outlines, recomputed whenever one of them changes, while the children stay
 * nodes the user can enter the group to edit.
 *
 * It is built from general node fields rather than a kind of its own: it
 * consumes its children (`consumesChildren`), derives its path from them
 * (`dependsOn: 'children'` with `booleanOfChildren`) and its pose as their
 * envelope (`unionOfChildren`), and paints that path with its own
 * `data.fill` and `data.stroke`. `data.boolean` names the operation.
 */
import { booleanOfChildren } from './booleanOfChildren';
import { unionOfChildren } from './kitRegistry';
import type { AddNodeSpec } from './types';

/**
 * The fields that make a node a boolean group, for `scene.add` beside its
 * layer, pose, parent and `data`. Its children are added under it as usual;
 * its pose follows theirs, so the one it is added with is a placeholder.
 */
export function booleanGroupFields<TPose>(): Pick<
  AddNodeSpec<unknown, string, TPose>, 'kind' | 'consumesChildren' | 'dependsOn' | 'derivePath' | 'derivePose'
> {
  return {
    kind: 'mark',
    consumesChildren: true,
    dependsOn: 'children',
    derivePath: booleanOfChildren as never,
    derivePose: unionOfChildren as never,
  };
}
