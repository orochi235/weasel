/**
 * Tool options kept in a prefs store: the schema a host's prefs hold them
 * under, and the `toolOptionValues` that reads and writes them there.
 */
import { repairPrefValue, type PrefEnum, type PrefGroup, type PrefLeaf, type PrefNumber, type PrefString } from '@weasel-js/prefs-schema';
import { deepEqual, getOwn, setOwn } from '@weasel-js/registry';
import { checkToolOptionOwner, SHARED_TOOL_OPTIONS, toolOptionSlot, type ToolOptionsSpec, type ToolOptionValues } from './toolOptions';

/** A tool as these read it: its id and its options. */
export interface OptionedTool {
  readonly id: string;
  readonly options?: ToolOptionsSpec;
}

/** The part of a `PrefsStore` {@link prefsToolOptionValues} uses. */
export interface ToolOptionPrefsStore {
  values(): Record<string, unknown>;
  set(path: string, value: unknown): void;
  subscribe(listener: () => void): () => void;
}

/** How {@link toolOptionsPrefs} names its group, and the host's defaults for shared keys. */
export interface ToolOptionsPrefsSpec {
  name?: string;
  description?: string;
  /** A shared key's default where the host decides it: the fill a new shape takes before anyone picks one. A key
   *  left out defaults as the first tool naming it declares. */
  shared?: Readonly<Record<string, unknown>>;
}

const isNumber = (leaf: PrefLeaf | PrefGroup): leaf is PrefNumber => 'kind' in leaf && leaf.kind === 'number';

const isEnum = (leaf: PrefLeaf | PrefGroup): leaf is PrefEnum => 'kind' in leaf && leaf.kind === 'enum';
const isString = (leaf: PrefLeaf | PrefGroup): leaf is PrefString => 'kind' in leaf && leaf.kind === 'string';

const endsOf = (e: PrefNumber['endless']) => ({ lo: e === 'min' || e === 'both', hi: e === 'max' || e === 'both' });

/** `held` widened to take every value `next` does, so a store repairing against it keeps what any tool may write.
 *  Throws where the two are not one kind, as no leaf takes both. */
function widened(key: string, held: PrefLeaf | PrefGroup, next: PrefLeaf | PrefGroup): PrefLeaf | PrefGroup {
  const kindOf = (n: PrefLeaf | PrefGroup) => ('kind' in n ? n.kind : 'group');
  if (kindOf(held) !== kindOf(next)) {
    throw new Error(`toolOptionsPrefs: the shared option "${key}" is of kind "${kindOf(held)}" for one tool and "${kindOf(next)}" for another`);
  }
  if (isNumber(held) && isNumber(next)) return widenedNumber(held, next);
  if (isEnum(held) && isEnum(next)) {
    const have = new Set(held.options.map((o) => o.value));
    return { ...held, options: [...held.options, ...next.options.filter((o) => !have.has(o.value))] } as PrefEnum;
  }
  if (isString(held) && isString(next)) {
    const { maxLength: _maxLength, ...rest } = held;
    const maxLength = held.maxLength === undefined || next.maxLength === undefined ? undefined : Math.max(held.maxLength, next.maxLength);
    return { ...rest, ...(maxLength === undefined ? {} : { maxLength }) } as PrefString;
  }
  if (!deepEqual(repairShape(held), repairShape(next))) {
    throw new Error(`toolOptionsPrefs: the shared option "${key}" is a ${kindOf(held)} declared differently by two tools, and only a number, an enum or a string widens to take both`);
  }
  return held;
}

// What a leaf shows or labels, which no repair reads, so two tools may word a shared option each their own way.
const PRESENTATION = new Set([
  'name', 'description', 'default', 'tags', 'meta', 'hidden', 'showIf', 'enableIf', 'disabledReason', 'block', 'heading',
  'icon', 'pair', 'short', 'control', 'placeholder',
]);

/** `node` less what only presents it, down through every child it holds. */
function repairShape(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(repairShape);
  if (!node || typeof node !== 'object') return node;
  return Object.fromEntries(Object.entries(node).filter(([k]) => !PRESENTATION.has(k)).map(([k, v]) => [k, repairShape(v)]));
}

function widenedNumber(held: PrefNumber, next: PrefNumber): PrefNumber {
  const {
    min: _min, max: _max, endless: _endless, step: _step, scale: _scale, stops: _stops, minAt: _minAt, maxAt: _maxAt,
    clearable: _clearable, ...rest
  } = held;
  const min = held.min === undefined || next.min === undefined ? undefined : Math.min(held.min, next.min);
  const max = held.max === undefined || next.max === undefined ? undefined : Math.max(held.max, next.max);
  const a = endsOf(held.endless);
  const b = endsOf(next.endless);
  const lo = a.lo || b.lo;
  const hi = a.hi || b.hi;
  const endless = lo && hi ? 'both' : lo ? 'min' : hi ? 'max' : undefined;
  // A constraint only one tool holds would refuse or misdraw the other's values, so it is kept only where both agree.
  const step = held.step === next.step ? held.step : undefined;
  const scale = held.scale === next.scale && (held.scale !== 'log' || (min !== undefined && min > 0)) ? held.scale : undefined;
  const stops = held.stops || next.stops ? [...new Set([...(held.stops ?? []), ...(next.stops ?? [])])].sort((x, y) => x - y) : undefined;
  const minAt = deepEqual(held.minAt, next.minAt) ? held.minAt : undefined;
  const maxAt = deepEqual(held.maxAt, next.maxAt) ? held.maxAt : undefined;
  const clearable = held.clearable === true || next.clearable === true;
  // A tool that clears the field without a default of its own reads unset, which a numeric default would hide.
  const unset = clearable && (held.default === undefined || next.default === undefined);
  return {
    ...rest, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }), ...(endless ? { endless } : {}),
    ...(step === undefined ? {} : { step }), ...(scale === undefined ? {} : { scale }), ...(stops ? { stops } : {}),
    ...(minAt === undefined ? {} : { minAt }), ...(maxAt === undefined ? {} : { maxAt }),
    ...(clearable ? { clearable: true } : {}), ...(unset ? { default: undefined } : {}),
  } as PrefNumber;
}

const isGroup = (node: PrefLeaf | PrefGroup | undefined): node is PrefGroup => !!node && !('kind' in node);

/** Lay `group` into `children` at `toolId`, a group per segment of a dotted id, as a prefs store nests the names it
 *  keeps. Throws where one tool's option and another's group would sit in one place. */
function placeToolGroup(children: Record<string, PrefLeaf | PrefGroup>, toolId: string, group: PrefGroup): void {
  const parts = toolId.split('.');
  let at = children;
  for (const part of parts.slice(0, -1)) {
    const node = getOwn(at, part);
    if (node && !isGroup(node)) throw new Error(`toolOptionsPrefs: tool "${toolId}" would keep its options inside an option at "${part}"`);
    const next = node ?? { name: part, children: {} };
    if (!node) setOwn(at, part, next);
    at = (next as PrefGroup).children as Record<string, PrefLeaf | PrefGroup>;
  }
  const last = parts.at(-1)!;
  const held = getOwn(at, last);
  if (held && !isGroup(held)) throw new Error(`toolOptionsPrefs: tool "${toolId}" would keep its options inside an option at "${last}"`);
  const below = held ? held.children : {};
  for (const key of Object.keys(group.children)) {
    if (Object.hasOwn(below, key)) throw new Error(`toolOptionsPrefs: tool "${toolId}"'s option "${key}" and the tool "${toolId}.${key}" would share one place`);
  }
  setOwn(at, last, { ...group, children: { ...below, ...group.children } });
}

/**
 * The prefs group `tools`' options are kept in: a group per tool holding its
 * own options, and a {@link SHARED_TOOL_OPTIONS} group holding each shared
 * key once, as the first tool naming it declares it, with the default the host
 * gives it. A shared number takes the widest bounds of the tools naming it, a
 * `step`, `scale` or bound read from the holder only where they agree, every
 * tool's `stops`, and `clearable` where any is; each tool reads it held to its own; a shared enum takes every tool's options, and a shared string the longest
 * `maxLength`; any other shared kind must be declared alike by every tool, wording aside. Throws where tools name one
 * shared key as leaves of different kinds or declare another kind differently, the host gives one a default its leaf
 * does not take or a default for a key no tool shares, or two tools of one id declare different options; one tool
 * listed twice is placed once. A tool with no options of its own has no group, and a dotted id's group sits a level
 * down for each dot (`path.brush` in `path`), named for the segment until a tool of that id names it.
 */
export function toolOptionsPrefs(tools: Iterable<OptionedTool>, spec: ToolOptionsPrefsSpec = {}): PrefGroup {
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  const shared: Record<string, PrefLeaf | PrefGroup> = {};
  const seen = new Map<string, ToolOptionsSpec>();
  for (const tool of tools) {
    const options = tool.options;
    if (!options) continue;
    checkToolOptionOwner(tool.id);
    const prior = seen.get(tool.id);
    if (prior === options) continue;
    if (prior) throw new Error(`toolOptionsPrefs: two tools named "${tool.id}" declare different options`);
    seen.set(tool.id, options);
    const own: Record<string, PrefLeaf | PrefGroup> = {};
    for (const [key, leaf] of Object.entries(options.prefs.children)) {
      const slot = toolOptionSlot(tool.id, options, key);
      if (slot.key.includes('.')) {
        throw new Error(`toolOptionsPrefs: ${tool.id}'s option "${key}" is kept under "${slot.key}", and a prefs store reads a "." there as a group`);
      }
      if (slot.owner === tool.id) setOwn(own, key, leaf);
      else setOwn(shared, slot.key, Object.hasOwn(shared, slot.key) ? widened(slot.key, getOwn(shared, slot.key)!, leaf) : leaf);
    }
    if (Object.keys(own).length > 0) placeToolGroup(children, tool.id, { ...options.prefs, children: own });
  }
  for (const [key, value] of Object.entries(spec.shared ?? {})) {
    const leaf = getOwn(shared, key);
    if (!leaf) throw new Error(`toolOptionsPrefs: the host gives a default for the shared option "${key}", which no tool names`);
    if (!('kind' in leaf)) continue;
    const invalid = Symbol('invalid');
    if (!deepEqual(repairPrefValue({ ...leaf, default: invalid } as PrefLeaf, value), value)) {
      throw new Error(`toolOptionsPrefs: the host's default ${JSON.stringify(value)} for the shared option "${key}" is not a value any tool naming it takes`);
    }
    setOwn(shared, key, { ...leaf, default: value } as PrefLeaf);
  }
  if (Object.keys(shared).length > 0) {
    children[SHARED_TOOL_OPTIONS] = { name: 'Shared', description: 'Settings every tool naming them uses.', children: shared };
  }
  return { name: spec.name ?? 'Tools', description: spec.description ?? 'Each tool’s settings.', children };
}

const pathOf = (base: string, owner: string, key: string) => (base ? `${base}.${owner}.${key}` : `${owner}.${key}`);

function subtree(values: Record<string, unknown>, base: string): Record<string, unknown> | undefined {
  let at: unknown = values;
  for (const part of base ? base.split('.') : []) at = at && typeof at === 'object' ? getOwn(at as Record<string, unknown>, part) : undefined;
  return at && typeof at === 'object' ? (at as Record<string, unknown>) : undefined;
}

const NONE: Readonly<Record<string, unknown>> = Object.freeze({});

/**
 * Tool option values kept in `store` under `base`, each owner's at
 * `<base>.<owner>.<key>`: the layout {@link toolOptionsPrefs} makes. The
 * store's schema decides each default, so a shared key nobody set reads the
 * default the host gave it.
 */
export function prefsToolOptionValues(store: ToolOptionPrefsStore, base: string): ToolOptionValues {
  const cache = new Map<string, { values: unknown; out: Readonly<Record<string, unknown>> }>();
  return {
    get(owner) {
      const values = store.values();
      const hit = cache.get(owner);
      if (hit && hit.values === values) return hit.out;
      const tree = subtree(values, base);
      // The store nests a dotted name, so a tool id `a.b` is kept at `a` → `b`.
      const held = tree && subtree(tree, owner);
      let out = held && typeof held === 'object' ? (held as Readonly<Record<string, unknown>>) : NONE;
      // An unchanged answer keeps its identity, so a subscriber comparing it sees no change.
      if (hit && deepEqual(hit.out, out)) out = hit.out;
      cache.set(owner, { values, out });
      return out;
    },
    set: (owner, key, value) => store.set(pathOf(base, owner, key), value),
    subscribe: (listener) => store.subscribe(() => listener()),
  };
}
