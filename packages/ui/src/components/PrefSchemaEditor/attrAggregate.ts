import { isPrefLeaf } from '@weasel-js/prefs';
import { attributeSchema, type AttributeSchema, type CustomKinds, type KindAttrs } from './kindSchemas';
import type { SchemaNode } from './schemaEdit';

/** Whether two attribute values hold the same thing. Functions and class instances compare by identity. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  // By tag: a value from another realm fails `instanceof`.
  const tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) return false;
  if (tag === '[object Array]') {
    const [x, y] = [a as unknown[], b as unknown[]];
    return x.length === y.length && x.every((v, i) => sameValue(v, y[i]));
  }
  if (tag !== '[object Object]') return false;
  const [x, y] = [a as Record<string, unknown>, b as Record<string, unknown>];
  const keys = Object.keys(x);
  return keys.length === Object.keys(y).length && keys.every((k) => Object.hasOwn(y, k) && sameValue(x[k], y[k]));
}

/** Attribute kinds whose control shows one whole value, so several that disagree are listed and not edited. */
export const WHOLE: ReadonlySet<string> = new Set(['list', 'map', 'object', 'union']);

/** Several nodes' attributes as one form. */
export interface AttributeAggregate {
  /** The attributes every node has, each with one definition. */
  schema: AttributeSchema;
  /** Each agreed attribute's value. A mixed one has no entry. */
  values: Record<string, unknown>;
  /** The attributes in `schema` whose values disagree. */
  mixed: ReadonlySet<string>;
  /** Attributes every node has whose values disagree and cannot be edited together. */
  apart: readonly string[];
  /** The leaf kind every node has; `null` when all are leaves of differing kinds; `undefined` when any is not a leaf. */
  kind: string | null | undefined;
}

/**
 * The attributes `nodes` share, as {@link attributeSchema} gives them for one. `drawsMixed` says whether an
 * attribute kind's control has a mixed state; one that does not is left out when its values disagree.
 */
export function aggregateAttributes(
  nodes: readonly SchemaNode[], custom: CustomKinds = {}, drawsMixed: (kind: string) => boolean = (k) => !WHOLE.has(k),
  actions?: ReadonlyArray<{ key: string; label: string }>,
): AttributeAggregate {
  const [first, ...rest] = nodes.map((n) => attributeSchema(n, custom, actions));
  const held = nodes.map((n) => n as unknown as Record<string, unknown>);
  const values: Record<string, unknown> = {};
  const mixed = new Set<string>();
  const apart: string[] = [];
  const common = (part: 'shared' | 'own' | 'auto'): KindAttrs => {
    const out: KindAttrs = {};
    for (const [key, def] of Object.entries(first![part])) {
      if (!rest.every((s) => sameValue(s[part][key], def))) continue;
      if (held.every((h) => sameValue(h[key], held[0]![key]))) {
        out[key] = def;
        if (held[0]![key] !== undefined) values[key] = held[0]![key];
      } else if (drawsMixed(def.kind)) {
        out[key] = def;
        mixed.add(key);
      } else {
        apart.push(key);
      }
    }
    return out;
  };
  const schema: AttributeSchema = {
    shared: common('shared'),
    own: common('own'),
    auto: common('auto'),
    // What a list or a map holds is edited one node at a time.
    entry: rest.length === 0 ? first!.entry : {},
    readOnly: first!.readOnly.filter(([k, v]) => rest.every((s) => s.readOnly.some(([k2, v2]) => k2 === k && sameValue(v2, v)))),
  };
  const kinds = nodes.map((n) => (isPrefLeaf(n) ? n.kind : undefined));
  const kind = kinds.includes(undefined) ? undefined : kinds.every((k) => k === kinds[0]) ? kinds[0]! : null;
  return { schema, values, mixed, apart, kind };
}
