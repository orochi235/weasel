import { isPrefLeaf, isPrefSection, type PrefLeaf } from '@weasel-js/prefs';
import { setAtPath } from '../SelectionPanel';
import { childrenOf, joinPath, replaceNode, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** A value and where it is stored: the steps of its path, as a form or a node holds it. */
export type DefaultEdit = readonly [valuePath: readonly string[], value: unknown];

interface Holder {
  path: string;
  /** The steps left inside the leaf's value. */
  rest: readonly string[];
}

/** The leaves whose value holds `valuePath`, by tree path. One, but in a schema that came holding a value path twice. */
function leavesHolding(node: SchemaNode, valuePath: readonly string[], at: string | null): Holder[] {
  return Object.entries(childrenOf(node) ?? {}).flatMap(([key, child]): Holder[] => {
    const path = joinPath(at, key);
    if (isPrefSection(child)) return leavesHolding(child, valuePath, path);
    const steps = key.split('.');
    if (steps.length > valuePath.length || steps.some((step, i) => step !== valuePath[i])) return [];
    const rest = valuePath.slice(steps.length);
    return isPrefLeaf(child) ? [{ path, rest }] : leavesHolding(child, rest, path);
  });
}

/** Make each value the default of the leaf that describes it, or a part of that default when its path runs
 *  into the leaf's value. An edit no leaf describes is dropped. */
export function setDefaults<R extends SchemaRoot>(root: R, edits: readonly DefaultEdit[]): R {
  let next = root;
  for (const [valuePath, value] of edits) {
    for (const found of leavesHolding(next, valuePath, null)) {
      next = replaceNode(next, found.path, (node) => {
        const leaf = node as PrefLeaf;
        const held = found.rest.length === 0 ? value : setAtPath((leaf.default ?? {}) as object, found.rest, value);
        return { ...leaf, default: held } as SchemaNode;
      });
    }
  }
  return next;
}
