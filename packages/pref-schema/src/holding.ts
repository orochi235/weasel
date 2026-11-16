// Which leaf describes the value at a path, looking inside the leaves whose
// values are made of fields. What reads a condition's paths against a schema
// asks here.

import type { PrefGroup, PrefSection } from './groups';
import { isPrefLeaf, isPrefSection, prefSectionLeaves } from './helpers';
import { isBuiltinPref, type PrefEnum, type PrefLeaf, type PrefObject } from './schema';
import type { PrefUnion } from './union';

/** A value the schema says nothing about: an entry of a list, a field of an app-defined kind. */
export const UNSEEN = Symbol('unseen');

/** A union on the way to a value, and the variant the value is read under. */
export interface PrefHeldVariant {
  /** The union leaf's path. */
  at: string;
  tag: string;
  key: string;
}

/** The leaf describing a value, and the path of the `object` or `union` leaf it is a field of, when it is one. */
export interface PrefHeld {
  leaf: PrefLeaf;
  within?: string;
  /** The variants the value is a field of, outermost first: it is described by `leaf` only while each union holds its variant. */
  variants?: readonly PrefHeldVariant[];
}

type Found = PrefHeld[] | typeof UNSEEN | undefined;

const under = (at: string, key: string): string => (at === '' ? key : `${at}.${key}`);

/** `at` is the path of the leaf the fields belong to, `undefined` for a section schema's own leaves. */
function amongFields(fields: [key: string, leaf: PrefLeaf][], path: string, at: string | undefined): Found {
  const exact = fields.find(([key]) => key === path);
  if (exact) return [{ leaf: exact[1], ...(at === undefined ? {} : { within: at }) }];
  const outer = fields.find(([key]) => path.startsWith(`${key}.`));
  return outer && insideLeaf(outer[1], path.slice(outer[0].length + 1), under(at ?? '', outer[0]));
}

function insideLeaf(leaf: PrefLeaf, rest: string, at: string): Found {
  if (leaf.kind === 'object') return amongFields(prefSectionLeaves((leaf as PrefObject).children), rest, at);
  if (leaf.kind === 'union') {
    const { tag, variants } = leaf as PrefUnion;
    if (rest === tag) {
      const options = Object.keys(variants).map((value) => ({ value, label: variants[value]!.name }));
      return [{ leaf: { kind: 'enum', name: tag, description: '', default: undefined, options } as PrefEnum, within: at }];
    }
    // Variants may each describe the same field differently, so each one's is kept.
    const out: PrefHeld[] = [];
    for (const [key, variant] of Object.entries(variants)) {
      const found = amongFields(prefSectionLeaves(variant.children), rest, at);
      if (found === UNSEEN) return UNSEEN;
      for (const held of found ?? []) out.push({ ...held, variants: [{ at, tag, key }, ...(held.variants ?? [])] });
    }
    return out.length ? out : undefined;
  }
  return !isBuiltinPref(leaf) || leaf.kind === 'list' || leaf.kind === 'map' || leaf.kind === 'paint' ? UNSEEN : undefined;
}

/**
 * Every leaf describing the value at `path`, looking inside `object` and
 * `union` leaves: one, or one per variant holding the field where it sits in
 * a union.
 */
export function prefLeavesHolding(schema: PrefGroup | PrefSection, path: string): Found {
  if (isPrefSection(schema)) return amongFields(prefSectionLeaves(schema.members), path, undefined);
  const steps = path.split('.');
  let node: PrefLeaf | PrefGroup = schema;
  for (let i = 0; i < steps.length; i++) {
    if (isPrefLeaf(node)) return insideLeaf(node, steps.slice(i).join('.'), steps.slice(0, i).join('.'));
    if (!Object.hasOwn(node.children, steps[i]!)) return undefined;
    node = node.children[steps[i]!]!;
  }
  return isPrefLeaf(node) ? [{ leaf: node }] : undefined;
}

/** {@link prefLeavesHolding} inside one entry of a list or a map whose `item` this is; the empty path is the entry itself. */
export function prefLeavesHoldingIn(item: PrefLeaf, path: string): Found {
  return path === '' ? [{ leaf: item }] : insideLeaf(item, path, '');
}

/**
 * The schema that answers for the value at `path`: `schema` where a leaf of
 * it describes that value, else `over`, the schema `schema` is drawn over.
 * So a path both hold is `schema`'s. Every reader of a condition's paths
 * that takes a second schema asks here which one to read.
 */
export function prefSchemaHolding(
  schema: PrefGroup | PrefSection, path: string, over?: PrefGroup | PrefSection,
): PrefGroup | PrefSection {
  return over === undefined || prefLeavesHolding(schema, path) !== undefined ? schema : over;
}
