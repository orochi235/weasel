// Which leaf describes the value at a path, looking inside the leaves whose
// values are made of fields. What reads a condition's paths against a schema
// asks here.

import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefSectionLeaves } from './helpers';
import { isBuiltinPref, type PrefEnum, type PrefLeaf, type PrefObject } from './schema';
import type { PrefUnion } from './union';

/** A value the schema says nothing about: an entry of a list, a field of an app-defined kind. */
export const UNSEEN = Symbol('unseen');

/** The leaf describing a value, and the path of the `object` or `union` leaf it is a field of, when it is one. */
export interface PrefHeld {
  leaf: PrefLeaf;
  within?: string;
}

const under = (at: string, key: string): string => (at === '' ? key : `${at}.${key}`);

/** `at` is the path of the leaf the fields belong to, `undefined` for a section schema's own leaves. */
function amongFields(fields: [key: string, leaf: PrefLeaf][], path: string, at: string | undefined): PrefHeld | typeof UNSEEN | undefined {
  const exact = fields.find(([key]) => key === path);
  if (exact) return { leaf: exact[1], ...(at === undefined ? {} : { within: at }) };
  const outer = fields.find(([key]) => path.startsWith(`${key}.`));
  return outer && insideLeaf(outer[1], path.slice(outer[0].length + 1), under(at ?? '', outer[0]));
}

function insideLeaf(leaf: PrefLeaf, rest: string, at: string): PrefHeld | typeof UNSEEN | undefined {
  if (leaf.kind === 'object') return amongFields(prefSectionLeaves((leaf as PrefObject).children), rest, at);
  if (leaf.kind === 'union') {
    const { tag, variants } = leaf as PrefUnion;
    if (rest === tag) {
      const options = Object.keys(variants).map((value) => ({ value, label: variants[value]!.name }));
      return { leaf: { kind: 'enum', name: tag, description: '', default: undefined, options } as PrefEnum, within: at };
    }
    for (const variant of Object.values(variants)) {
      const found = amongFields(prefSectionLeaves(variant.children), rest, at);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  return !isBuiltinPref(leaf) || leaf.kind === 'list' || leaf.kind === 'map' || leaf.kind === 'paint' ? UNSEEN : undefined;
}

/** The leaf describing the value at `path`, looking inside `object` and `union` leaves. */
export function prefLeafHolding(schema: PrefGroup | PrefSection, path: string): PrefHeld | typeof UNSEEN | undefined {
  if (isPrefSection(schema)) return amongFields(prefSectionLeaves(schema.members), path, undefined);
  const steps = path.split('.');
  let node: PrefLeaf | PrefGroup = schema;
  for (let i = 0; i < steps.length; i++) {
    if (isPrefLeaf(node)) return insideLeaf(node, steps.slice(i).join('.'), steps.slice(0, i).join('.'));
    if (!Object.hasOwn(node.children, steps[i]!)) return undefined;
    node = node.children[steps[i]!]!;
  }
  return isPrefLeaf(node) ? { leaf: node } : undefined;
}
