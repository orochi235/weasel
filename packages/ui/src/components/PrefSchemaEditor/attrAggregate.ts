import { isPrefLeaf, prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { deepEqual } from '@weasel-js/registry';
import { attrValue, attributeSchema, type AttributeSchema, type CustomKinds, type KindAttrs } from './kindSchemas';
import type { RegisteredAction } from './registeredActionAttrs';
import { nodeAt, setAttribute, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** Attribute kinds whose control shows one whole value. Several that disagree are listed and not edited, but for an object, which is split by field. */
export const WHOLE: ReadonlySet<string> = new Set(['list', 'map', 'object', 'union']);

const fieldsOf = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/**
 * An object attribute whose values disagree, field by field: the fields every value agrees on, and the path under
 * `at` of each that they do not. Null when a field that disagrees has a control with no mixed state.
 */
function splitObject(
  def: PrefObject, each: readonly unknown[], at: string, drawsMixed: (kind: string) => boolean,
): { agreed: Record<string, unknown>; mixed: string[] } | null {
  const agreed: Record<string, unknown> = {};
  const mixed: string[] = [];
  for (const [key, field] of prefSectionLeaves(def.children)) {
    const held = each.map((value) => fieldsOf(value)[key]);
    if (held.every((value) => deepEqual(value, held[0]))) {
      if (held[0] !== undefined) agreed[key] = held[0];
    } else if (field.kind === 'object') {
      const inner = splitObject(field as PrefObject, held, `${at}.${key}`, drawsMixed);
      if (inner === null) return null;
      agreed[key] = inner.agreed;
      mixed.push(...inner.mixed);
    } else if (drawsMixed(field.kind)) {
      mixed.push(`${at}.${key}`);
    } else {
      return null;
    }
  }
  return { agreed, mixed };
}

/** `held` with `value` at the field `keys` name, a field holding nothing left out. */
function withObjectField(held: unknown, keys: readonly string[], value: unknown): Record<string, unknown> {
  const [key, ...rest] = keys;
  const next = { ...fieldsOf(held) };
  const inner = rest.length === 0 ? value : withObjectField(next[key!], rest, value);
  if (inner === undefined) delete next[key!];
  else next[key!] = inner;
  return next;
}

/** Whether `attr` names a field inside an object attribute of `schema`, as `frame.edge` does, and not an attribute. */
export function isObjectField(schema: AttributeSchema, attr: string): boolean {
  const top = attr.split('.')[0]!;
  return top !== attr && (schema.shared[top] ?? schema.own[top] ?? schema.auto[top])?.kind === 'object';
}

/** The field `attr` names set on the node at each of `paths`, inside that node's own object, as one edit. */
export function setObjectField<R extends SchemaRoot>(root: R, paths: ReadonlyArray<string | null>, attr: string, value: unknown): R {
  const [top, ...field] = attr.split('.');
  return paths.reduce<R>((next, path) => {
    const holds = (nodeAt(next, path) as unknown as Record<string, unknown>)[top!];
    return setAttribute(next, path, top!, withObjectField(holds, field, value));
  }, root);
}

/** Several nodes' attributes as one form. */
export interface AttributeAggregate {
  /** The attributes every node has, each with one definition. */
  schema: AttributeSchema;
  /** Each agreed attribute's value. A mixed one has no entry. */
  values: Record<string, unknown>;
  /** The attributes in `schema` whose values disagree, and under an object attribute the path of each field that does. */
  mixed: ReadonlySet<string>;
  /** Attributes every node has whose values disagree and cannot be edited together. */
  apart: readonly string[];
  /** The leaf kind every node has; `null` when all are leaves of differing kinds; `undefined` when any is not a leaf. */
  kind: string | null | undefined;
}

/**
 * The attributes `nodes` share, as {@link attributeSchema} gives them for one. `drawsMixed` says whether an
 * attribute kind's control has a mixed state; one that does not is left out when its values disagree, but for an
 * object, which is kept field by field where every field that disagrees has one.
 */
export function aggregateAttributes(
  nodes: readonly SchemaNode[], custom: CustomKinds = {}, drawsMixed: (kind: string) => boolean = (k) => !WHOLE.has(k),
  actions?: readonly RegisteredAction[],
): AttributeAggregate {
  const [first, ...rest] = nodes.map((n) => attributeSchema(n, custom, actions));
  const fields = nodes.map((n) => n as unknown as Record<string, unknown>);
  const values: Record<string, unknown> = {};
  const mixed = new Set<string>();
  const apart: string[] = [];
  const common = (part: 'shared' | 'own' | 'auto'): KindAttrs => {
    const out: KindAttrs = {};
    for (const [key, def] of Object.entries(first![part])) {
      if (!rest.every((s) => deepEqual(s[part][key], def))) continue;
      const held = fields.map((f) => attrValue(f, key));
      if (held.every((h) => deepEqual(h, held[0]))) {
        out[key] = def;
        if (held[0] !== undefined) values[key] = held[0];
      } else if (drawsMixed(def.kind)) {
        out[key] = def;
        mixed.add(key);
      } else {
        const split = def.kind === 'object' ? splitObject(def as PrefLeaf as PrefObject, held, key, drawsMixed) : null;
        if (split === null) {
          apart.push(key);
          continue;
        }
        out[key] = def;
        values[key] = split.agreed;
        for (const at of split.mixed) mixed.add(at);
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
    readOnly: first!.readOnly.filter(([k, v]) => rest.every((s) => s.readOnly.some(([k2, v2]) => k2 === k && deepEqual(v2, v)))),
  };
  const kinds = nodes.map((n) => (isPrefLeaf(n) ? n.kind : undefined));
  const kind = kinds.includes(undefined) ? undefined : kinds.every((k) => k === kinds[0]) ? kinds[0]! : null;
  return { schema, values, mixed, apart, kind };
}

/** What a node of the action catalog offers to edit: what a pref dragged out of it takes along. */
const CATALOG_ATTRS: ReadonlySet<string> = new Set(['name', 'description', 'icon', 'label', 'control']);

/** `all` as the action catalog shows it: the attributes a catalog's node offers, and the action its prefs fire listed with what is not edited. */
export function catalogAttributes(all: AttributeAggregate): AttributeAggregate {
  const offered = (part: KindAttrs): KindAttrs => Object.fromEntries(Object.entries(part).filter(([name]) => CATALOG_ATTRS.has(name)));
  const fires = all.values.action;
  const readOnly: Array<[string, unknown]> = [...(fires === undefined ? [] : [['action', fires] as [string, unknown]]), ...all.schema.readOnly];
  return { ...all, schema: { shared: offered(all.schema.shared), own: offered(all.schema.own), auto: {}, entry: {}, readOnly } };
}
