import { isPrefLeaf, isPrefSection, type PrefLeaf } from '@weasel-js/prefs';
import { setAtPath } from '../SelectionPanel';
import { childrenOf, joinPath, replaceNode, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** A value and where it is stored: the steps of its path, as a form or a node holds it. */
export type DefaultEdit = readonly [valuePath: readonly string[], value: unknown];

/** The leaf whose value holds `valuePath`: its tree path, and the steps left inside that value. */
function leafHolding(node: SchemaNode, valuePath: readonly string[], at: string | null): { path: string; rest: readonly string[] } | undefined {
  for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
    const path = joinPath(at, key);
    if (isPrefSection(child)) {
      const found = leafHolding(child, valuePath, path);
      if (found) return found;
      continue;
    }
    const steps = key.split('.');
    if (steps.length > valuePath.length || steps.some((step, i) => step !== valuePath[i])) continue;
    const rest = valuePath.slice(steps.length);
    return isPrefLeaf(child) ? { path, rest } : leafHolding(child, rest, path);
  }
  return undefined;
}

/** Make each value the default of the leaf that describes it, or a part of that default when its path runs
 *  into the leaf's value. An edit no leaf describes is dropped. */
export function setDefaults<R extends SchemaRoot>(root: R, edits: readonly DefaultEdit[]): R {
  let next = root;
  for (const [valuePath, value] of edits) {
    const found = leafHolding(next, valuePath, null);
    if (!found) continue;
    next = replaceNode(next, found.path, (node) => {
      const leaf = node as PrefLeaf;
      const held = found.rest.length === 0 ? value : setAtPath((leaf.default ?? {}) as object, found.rest, value);
      return { ...leaf, default: held } as SchemaNode;
    });
  }
  return next;
}
