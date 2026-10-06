import { type ConfigSchema, type ConfigShape, isConfigBranch, valueAtPath } from '@weasel-js/labkit/config';
import { isPlainObject } from '../csf/isPlainObject';
import { stableStringify } from '../protocol/messages';

/**
 * Forge's URL, as pure functions: `#/<story id>?<params>`. The story and its params share the hash, so the page's
 * own query string stays the host's. A param is a knob — a story arg, addressed by its dotted config path
 * (`look.px`) — unless its name is reserved for the workshop itself.
 */

/** The param a paused playhead is held in, in seconds. */
export const PLAYHEAD_PARAM = 't';

/** Param names that are never knobs. */
export const RESERVED_PARAMS: ReadonlySet<string> = new Set([PLAYHEAD_PARAM]);

/** Config keys forge keeps for itself, such as the `$globals` pins, start with this and never reach the URL. */
const INTERNAL_PREFIX = '$';

/** What a forge hash holds: the story it names, and every param after it, knobs and reserved alike, in order. */
export interface ForgeRoute {
  story: string | null;
  params: Readonly<Record<string, string>>;
}

/** Reads a hash (`location.hash`, with or without its `#`). Anything not in the `#/<id>` form names no story. */
export function parseRoute(hash: string): ForgeRoute {
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!body.startsWith('/')) return { story: null, params: {} };
  const at = body.indexOf('?');
  const path = at === -1 ? body.slice(1) : body.slice(1, at);
  let story: string | null;
  try {
    story = decodeURIComponent(path) || null;
  } catch {
    story = null;
  }
  const params: Record<string, string> = {};
  if (at !== -1) for (const [key, value] of new URLSearchParams(body.slice(at + 1))) params[key] = value;
  return { story, params };
}

/** The hash for `route`, with its leading `#`. The inverse of `parseRoute`. */
export function formatRoute(route: ForgeRoute): string {
  const query = new URLSearchParams(Object.entries(route.params)).toString();
  return `#/${encodeURIComponent(route.story ?? '')}${query ? `?${query}` : ''}`;
}

/** Whether a param name can be a knob: not reserved and not one of forge's own config keys. */
export function isKnobParam(name: string): boolean {
  return name !== '' && !RESERVED_PARAMS.has(name) && !name.startsWith(INTERNAL_PREFIX);
}

/** The params that are knobs, with the reserved ones left out. */
export function knobParams(params: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([name]) => isKnobParam(name)));
}

/** The params that are not knobs. Kept as they are when the knobs are rewritten. */
export function reservedParams(params: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([name]) => !isKnobParam(name)));
}

/** What a knob's value is decoded against: its schema leaf's declared kind, its default, and its choices. */
export interface KnobLeaf {
  kind: string | null;
  default: unknown;
  annotations?: { options?: readonly { value: string }[] };
}

type Codec = 'number' | 'boolean' | 'string' | 'enum' | 'json';

/** How a leaf's value travels: by its declared kind first, then by the type of its default. */
function codecOf(leaf: KnobLeaf): Codec | null {
  switch (leaf.kind) {
    case 'number':
    case 'boolean':
    case 'string':
    case 'enum':
      return leaf.kind;
    case 'color':
      return 'string';
    case 'list':
    case 'json':
      return 'json';
  }
  const d = leaf.default;
  if (typeof d === 'number' || typeof d === 'boolean' || typeof d === 'string') return typeof d as Codec;
  return Array.isArray(d) || isPlainObject(d) ? 'json' : null;
}

/** A value as one param. Undefined for a value no param can carry, such as a function. */
export function encodeKnob(value: unknown): string | undefined {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
      return String(value);
    case 'object':
      return value !== null && (Array.isArray(value) || isPlainObject(value)) ? JSON.stringify(value) : undefined;
    default:
      return undefined;
  }
}

/** Whether `value` is something a leaf of codec `codec` could hold, so a well-formed param of the wrong type is refused. */
function fits(codec: Codec, value: unknown, leaf: KnobLeaf): boolean {
  if (codec !== 'json') return true;
  const d = leaf.default;
  if (Array.isArray(d)) {
    if (!Array.isArray(value)) return false;
    return leaf.kind !== 'list' || value.every((item) => typeof item === 'string');
  }
  if (isPlainObject(d)) return isPlainObject(value);
  return true;
}

/**
 * One param read as `leaf`'s type: `{ value }`, or undefined for a param that does not parse as one — a number that
 * is not a number, an option the enum does not list, malformed JSON. A bare boolean param (`?dark`) reads as true.
 */
export function decodeKnob(raw: string, leaf: KnobLeaf): { value: unknown } | undefined {
  const codec = codecOf(leaf);
  switch (codec) {
    case 'number': {
      const n = raw.trim() === '' ? Number.NaN : Number(raw);
      return Number.isNaN(n) ? undefined : { value: n };
    }
    case 'boolean':
      if (raw === '' || raw === 'true' || raw === '1') return { value: true };
      if (raw === 'false' || raw === '0') return { value: false };
      return undefined;
    case 'string':
      return { value: raw };
    case 'enum': {
      const options = leaf.annotations?.options;
      return !options || options.some((o) => o.value === raw) ? { value: raw } : undefined;
    }
    case 'json': {
      try {
        const value: unknown = JSON.parse(raw);
        return fits(codec, value, leaf) ? { value } : undefined;
      } catch {
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

/** One leaf a URL can address: its dotted path, and what its value decodes against. */
export interface KnobPath {
  path: string;
  leaf: KnobLeaf;
}

/** Every leaf of `schema` a param can carry, in schema order, with branches flattened into dotted paths. */
export function knobPaths(schema: Pick<ConfigSchema<unknown>, 'nodes'>): KnobPath[] {
  const out: KnobPath[] = [];
  const walk = (shape: ConfigShape, at: string): void => {
    for (const [key, entry] of Object.entries(shape)) {
      if (key.startsWith(INTERNAL_PREFIX) || key.includes('.')) continue;
      const path = at === '' ? key : `${at}.${key}`;
      if (isConfigBranch(entry)) walk(entry.children, path);
      else if (codecOf(entry) !== null) out.push({ path, leaf: entry });
    }
  };
  walk(schema.nodes, '');
  return out;
}

/** Whether two knob values are the same value, compared as data. */
export function sameKnob(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || stableStringify(a) === stableStringify(b);
}

/**
 * The knob params for `config`: one per leaf whose value differs from its default, keyed by dotted path, in schema
 * order. A leaf absent from `config` is at its default.
 */
export function knobsToParams(schema: Pick<ConfigSchema<unknown>, 'nodes'>, config: unknown): Record<string, string> {
  const params: Record<string, string> = {};
  for (const { path, leaf } of knobPaths(schema)) {
    const value = valueAtPath(config, path);
    if (value === undefined || sameKnob(value, leaf.default)) continue;
    const encoded = encodeKnob(value);
    if (encoded !== undefined) params[path] = encoded;
  }
  return params;
}

/**
 * The knob values `params` sets, by dotted path, each coerced to its leaf's type. A param naming no leaf, a reserved
 * param, and one that does not parse as its leaf's type are left out rather than failing the rest.
 */
export function paramsToKnobs(
  schema: Pick<ConfigSchema<unknown>, 'nodes'>,
  params: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const knobs: Record<string, unknown> = {};
  for (const { path, leaf } of knobPaths(schema)) {
    const raw = params[path];
    if (raw === undefined || !isKnobParam(path)) continue;
    const decoded = decodeKnob(raw, leaf);
    if (decoded) knobs[path] = decoded.value;
  }
  return knobs;
}

/**
 * A link to a story at a given state, for a host that has no schema to hand: each knob is a dotted path and a value,
 * encoded by its own type. `params` adds workshop params, such as `t`.
 */
export function storyHref(
  story: string,
  knobs: Readonly<Record<string, unknown>> = {},
  params: Readonly<Record<string, string>> = {},
): string {
  const encoded: Record<string, string> = {};
  for (const [path, value] of Object.entries(knobs)) {
    const raw = encodeKnob(value);
    if (raw !== undefined && isKnobParam(path)) encoded[path] = raw;
  }
  return formatRoute({ story, params: { ...encoded, ...reservedParams(params) } });
}
