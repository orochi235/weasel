import { type ConfigSchema, type ConfigShape, isConfigBranch, configValueAt, hasConfigPath } from '@weasel-js/labkit/config';
import { isPlainObject } from '@weasel-js/core';
import { type PrefLeaf, type PrefNumber, type PrefObject, prefClampNumber, prefSectionLeaves } from '@weasel-js/prefs-schema';
import type { StoryGlobals } from '../protocol/messages';
import { setOwn, getOwn } from '@weasel-js/registry';
import { GLOBALS_KEY } from '../shell/globals';

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
  const params: Record<string, string> = at === -1 ? {} : Object.fromEntries(new URLSearchParams(body.slice(at + 1)));
  return { story, params };
}

/** The hash for `route`, with its leading `#`. The inverse of `parseRoute`. A lone surrogate, which no URL can
 *  carry, is written as U+FFFD, as `URLSearchParams` writes one in a param. */
export function formatRoute(route: ForgeRoute): string {
  const query = new URLSearchParams(Object.entries(route.params)).toString();
  return `#/${encodeURIComponent((route.story ?? '').replace(/\p{Cs}/gu, '\uFFFD'))}${query ? `?${query}` : ''}`;
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

/** What a knob's value is decoded against: its schema leaf's declared kind, its default, and below its kind an
 *  enum's choices and the leaves a list, a map, an object or a union holds. */
export interface KnobLeaf {
  kind: string | null;
  default: unknown;
  annotations?: {
    options?: readonly { value: string }[];
    item?: PrefLeaf;
    children?: PrefObject['children'];
    tag?: string;
    variants?: Readonly<Record<string, PrefObject>>;
    /** The leaf may be unset; an empty param carries it so. */
    clearable?: boolean;
  };
}

type KnobParts = NonNullable<KnobLeaf['annotations']>;

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
    case 'map':
    case 'object':
    case 'union':
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

/** Whether `value` is something a leaf of kind `kind` holding `parts` could hold. A leaf of a kind it does not know
 *  holds anything; an object's or a union's field left out is at its default. */
function holds(kind: unknown, parts: KnobParts, value: unknown): boolean {
  switch (kind) {
    case 'number':
    case 'boolean':
      return typeof value === kind;
    case 'string':
    case 'color':
      return typeof value === 'string';
    case 'enum':
      return typeof value === 'string' && (!parts.options || parts.options.some((o) => o.value === value));
    case 'list':
      // A list given no item holds strings, as `f.list` makes one.
      return Array.isArray(value) && value.every((entry) => (parts.item ? nestedHolds(parts.item, entry) : typeof entry === 'string'));
    case 'map':
      return isPlainObject(value) && (!parts.item || Object.values(value).every((entry) => nestedHolds(parts.item!, entry)));
    case 'object':
      return isPlainObject(value) && fieldsHold(parts.children, value);
    case 'union': {
      if (!isPlainObject(value)) return false;
      if (parts.tag === undefined || !parts.variants) return true;
      const name = getOwn(value, parts.tag);
      const variant = typeof name === 'string' ? getOwn(parts.variants, name) : undefined;
      return variant !== undefined && fieldsHold(variant.children, value, parts.tag);
    }
    default:
      return true;
  }
}

/** A nested leaf with an `encoding` stores whatever its encoding writes, so only its own reader can judge it. */
const nestedHolds = (leaf: PrefLeaf, value: unknown): boolean =>
  'encoding' in leaf || holds(leaf.kind, leaf as KnobParts, value);

function fieldsHold(children: KnobParts['children'], value: Record<string, unknown>, tag?: string): boolean {
  if (!children) return true;
  return prefSectionLeaves(children).every(
    ([key, child]) => key === tag || getOwn(value, key) === undefined || nestedHolds(child, getOwn(value, key)),
  );
}

/** Whether `value` is something a leaf of codec `codec` could hold, so a well-formed param of the wrong type is refused. */
function fits(codec: Codec, value: unknown, leaf: KnobLeaf): boolean {
  if (codec !== 'json') return true;
  if (leaf.kind === 'list' || leaf.kind === 'map' || leaf.kind === 'object' || leaf.kind === 'union') {
    return holds(leaf.kind, leaf.annotations ?? {}, value);
  }
  const d = leaf.default;
  if (Array.isArray(d)) return Array.isArray(value);
  if (isPlainObject(d)) return isPlainObject(value);
  return true;
}

/**
 * One param read as `leaf`'s type: `{ value }`, or undefined for a param that does not parse as one — a number that
 * is not a number, an option the enum does not list, malformed JSON. A bare boolean param (`?dark`) reads as true.
 * A number is held to its leaf's range, nested ones included, as a stored trial's is.
 */
export function decodeKnob(raw: string, leaf: KnobLeaf): { value: unknown } | undefined {
  const decoded = parsedKnob(raw, leaf);
  return decoded && { value: clamped(leaf.kind, leaf.annotations ?? {}, decoded.value) };
}

/** `value`, which `holds` for its leaf, with each number in it held to its own leaf's range. */
function clamped(kind: unknown, parts: KnobParts, value: unknown): unknown {
  const nested = (leaf: PrefLeaf, v: unknown) => ('encoding' in leaf ? v : clamped(leaf.kind, leaf as KnobParts, v));
  const fields = (children: KnobParts['children'], v: Record<string, unknown>) => {
    if (!children) return v;
    const out = { ...v };
    for (const [key, child] of prefSectionLeaves(children)) {
      if (getOwn(v, key) !== undefined) setOwn(out, key, nested(child, getOwn(v, key)));
    }
    return out;
  };
  switch (kind) {
    case 'number':
      return typeof value === 'number' ? prefClampNumber(parts as PrefNumber, value) : value;
    case 'list':
      return Array.isArray(value) && parts.item ? value.map((entry) => nested(parts.item!, entry)) : value;
    case 'map':
      return isPlainObject(value) && parts.item
        ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, nested(parts.item!, entry)]))
        : value;
    case 'object':
      return isPlainObject(value) ? fields(parts.children, value) : value;
    case 'union': {
      if (!isPlainObject(value) || parts.tag === undefined || !parts.variants) return value;
      const name = getOwn(value, parts.tag);
      const variant = typeof name === 'string' ? getOwn(parts.variants, name) : undefined;
      return variant ? fields(variant.children, value) : value;
    }
    default:
      return value;
  }
}

function parsedKnob(raw: string, leaf: KnobLeaf): { value: unknown } | undefined {
  const codec = codecOf(leaf);
  if (raw === '' && leaf.annotations?.clearable && (codec === 'number' || codec === 'enum')) return { value: undefined };
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

/** Every leaf of `schema` a param can carry, in schema order, reserved names and keys a dotted path cannot address
 *  (empty, or holding a dot) left out, with branches flattened into dotted paths. */
export function knobPaths(schema: Pick<ConfigSchema<unknown>, 'nodes'>): KnobPath[] {
  const out: KnobPath[] = [];
  const walk = (shape: ConfigShape, at: string): void => {
    for (const [key, entry] of Object.entries(shape)) {
      // An empty key's path would read as its parent's, so like a dotted one it has no param.
      if (key === '' || key.startsWith(INTERNAL_PREFIX) || key.includes('.')) continue;
      const path = at === '' ? key : `${at}.${key}`;
      if (isConfigBranch(entry)) walk(entry.children, path);
      else if (codecOf(entry) !== null && isKnobParam(path)) out.push({ path, leaf: entry });
    }
  };
  walk(schema.nodes, '');
  return out;
}

/** Whether two knob values are the same value, compared as data: `NaN` is itself, and `0` is `-0`, which no param tells
 *  apart. */
export function sameKnob(a: unknown, b: unknown): boolean {
  // Pairs already being compared hold unless something else differs, so a cycle compares as the tree it unrolls to.
  const open = new Map<object, Set<object>>();
  const same = (x: unknown, y: unknown): boolean => {
    if (x === y || (Number.isNaN(x) && Number.isNaN(y))) return true;
    const array = Array.isArray(x);
    if (array ? !Array.isArray(y) : !isPlainObject(x) || !isPlainObject(y) || Array.isArray(y)) return false;
    const xo = x as Record<string, unknown>;
    const yo = y as Record<string, unknown>;
    const against = open.get(xo) ?? new Set<object>();
    if (against.has(yo)) return true;
    open.set(xo, against.add(yo));
    const keys = Object.keys(xo).filter((key) => xo[key] !== undefined);
    const others = Object.keys(yo).filter((key) => yo[key] !== undefined);
    return keys.length === others.length && keys.every((key) => Object.hasOwn(yo, key) && same(xo[key], yo[key]));
  };
  return same(a, b);
}

/** Whether `config` holds `leaf` at `path` cleared: a clearable leaf set to `undefined`, which its default is not. */
export function isClearedKnob(config: unknown, path: string, leaf: KnobLeaf): boolean {
  return leaf.annotations?.clearable === true && leaf.default !== undefined && hasConfigPath(config, path) && configValueAt(config, path) === undefined;
}

/**
 * The knob params for `config`: one per leaf whose value differs from its default, keyed by dotted path, in schema
 * order. A leaf absent from `config` is at its default; a cleared one is an empty param.
 */
export function knobsToParams(schema: Pick<ConfigSchema<unknown>, 'nodes'>, config: unknown): Record<string, string> {
  const params: Record<string, string> = {};
  for (const { path, leaf } of knobPaths(schema)) {
    if (isClearedKnob(config, path, leaf)) {
      setOwn(params, path, '');
      continue;
    }
    const value = configValueAt(config, path);
    if (value === undefined || sameKnob(value, leaf.default)) continue;
    const encoded = encodeKnob(value);
    if (encoded !== undefined) setOwn(params, path, encoded);
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
    const raw = getOwn(params, path);
    if (raw === undefined) continue;
    const decoded = decodeKnob(raw, leaf);
    if (decoded) setOwn(knobs, path, decoded.value);
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
    if (raw !== undefined && isKnobParam(path)) setOwn(encoded, path, raw);
  }
  return formatRoute({ story, params: { ...encoded, ...reservedParams(params) } });
}

/** A param pinning one of the trial's globals is named by the pin's config path, `$globals.<key>`. */
const PIN_PREFIX = `${GLOBALS_KEY}.`;

/** The params pinning a trial's globals to `globals`. Not knobs: they are read once, as the story opens, and dropped. */
export function pinParams(globals: StoryGlobals): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(globals)) if (typeof value === 'string') params[`${PIN_PREFIX}${key}`] = value;
  return params;
}

/** `params` without the ones pinning globals. */
export function withoutPins(params: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).filter(([name]) => !name.startsWith(PIN_PREFIX)));
}

/** The pins `params` sets, by config path: each a value its global's leaf in `schema` offers; any other is left out. */
export function paramsToPins(
  schema: Pick<ConfigSchema<unknown>, 'nodes'>,
  params: Readonly<Record<string, string>>,
): Record<string, string> {
  const group = (schema.nodes as ConfigShape)[GLOBALS_KEY];
  if (!group || !isConfigBranch(group)) return {};
  const pins: Record<string, string> = {};
  for (const [key, leaf] of Object.entries(group.children)) {
    const raw = params[`${PIN_PREFIX}${key}`];
    if (raw === undefined || isConfigBranch(leaf)) continue;
    const decoded = decodeKnob(raw, leaf);
    if (typeof decoded?.value === 'string') pins[`${PIN_PREFIX}${key}`] = decoded.value;
  }
  return pins;
}
