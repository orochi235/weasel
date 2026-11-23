import { getOwn, setOwn } from '@weasel-js/registry';
import { isByAxis, parseTokenValue, type AxisChoice, type PinValue, type Theme, type ThemeDefinition, type TokenValue, type Varying } from '@weasel-js/theme';
import {
  bakeChain,
  declaredSteps,
  mergeChain,
  type DeriveResult,
  type Lookup,
  type RampDef,
  type ScaleDef,
  type SemanticRule,
} from '@weasel-js/theme/engine';

export type LayerId = 'seeds' | 'ramps' | 'scales' | 'semantics' | 'components' | 'pins';

export const LAYERS: readonly { readonly id: LayerId; readonly label: string }[] = [
  { id: 'seeds', label: 'Seeds' },
  { id: 'ramps', label: 'Ramps' },
  { id: 'scales', label: 'Scales' },
  { id: 'semantics', label: 'Semantics' },
  { id: 'components', label: 'Components' },
  { id: 'pins', label: 'Pins' },
];

export interface LayerCount {
  readonly count: number;
  readonly pinned: number;
}

export interface Counts {
  readonly overridden: number;
  readonly total: number;
  readonly layers: Readonly<Record<LayerId, LayerCount>>;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Tokens the definition's own entries produce, in definition order, with steps read in `merged`, the definition with
 *  what it extends. What it inherits is not its own. */
export function ownTokenNames(def: ThemeDefinition, merged: ThemeDefinition): string[] {
  const names = new Set<string>();
  for (const layer of [def.ramps, def.scales]) {
    for (const [name, entry] of Object.entries(layer ?? {})) for (const step of declaredSteps(entry, merged)) names.add(`${name}-${step}`);
  }
  for (const layer of [def.semantics, def.components, def.pins]) for (const name of Object.keys(layer ?? {})) names.add(name);
  return [...names];
}

/** A pin that fails at this selection (a `by` missing its value, an unknown seed) leaves no token, or leaves the rule's. */
export const pinApplies = (result: DeriveResult, name: string): boolean =>
  getOwn(result.provenance, name)?.pinned === true || getOwn(result.provenance, name)?.layer === 'pins';

/** The tokens `layer`'s page lists, in definition order: every seed with a value at `selection`, as `seeds.<name>`;
 *  each pin of the definition's own that applies; and for the rest, each token of the whole chain that `layer`
 *  produced, since a page lists what the theme inherits beside what it owns. */
export function layerNames(layer: LayerId, def: ThemeDefinition, result: DeriveResult, selection: AxisChoice, merged: ThemeDefinition): string[] {
  if (layer === 'seeds') {
    return Object.entries(def.seeds ?? {}).flatMap(([name, v]) => {
      const leaf = leafAt(v, selection);
      return typeof leaf === 'string' || typeof leaf === 'number' ? [`seeds.${name}`] : [];
    });
  }
  if (layer === 'pins') return Object.keys(def.pins ?? {}).filter((n) => pinApplies(result, n));
  return ownTokenNames(merged, merged).filter((n) => getOwn(result.tokens, n) && getOwn(result.provenance, n)?.layer === layer);
}

/** Each layer counts what its page lists ({@link layerNames}); the total counts each of the definition's own tokens
 *  once, and how many of them a pin overrides. */
export function countTokens(def: ThemeDefinition, result: DeriveResult, merged: ThemeDefinition, selection: AxisChoice): Counts {
  const pinnedOf = (names: readonly string[]) => names.filter((n) => getOwn(result.provenance, n)?.pinned).length;
  const layers = Object.fromEntries(
    LAYERS.map(({ id }) => {
      const names = layerNames(id, def, result, selection, merged);
      return [id, { count: names.length, pinned: id === 'seeds' ? 0 : pinnedOf(names) }];
    }),
  ) as Record<LayerId, LayerCount>;
  const own = ownTokenNames(def, merged).filter((n) => getOwn(result.provenance, n));
  return { overridden: pinnedOf(own), total: own.length, layers };
}

/** The draft as the runtime takes it, every theme it extends baked the same way. `name` scopes the rule `applyTheme` writes. */
export function runtimeTheme(def: ThemeDefinition, lookup: Lookup, name: string = def.name): Theme {
  const chain = bakeChain(def, lookup);
  return chain.reduce<Theme | null>(
    (parent, baked, i) => ({ name: i === chain.length - 1 ? name : baked.name, extends: parent, axes: baked.axes, tokens: baked.tokens }),
    null,
  )!;
}

const asNumber = (raw: string): number | null => (raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null);

/** Text typed over `previous`, kept a number when `previous` was one: `4` edited to `8` stays a number, not `'8'`, and
 *  a field cleared over a number keeps it rather than turning it into `''`. */
export const keepNumberness = (raw: string, previous: unknown): string | number =>
  typeof previous !== 'number' ? raw : raw.trim() === '' ? previous : (asNumber(raw) ?? raw);

/** Text typed over a value of DTCG `type`, in the shape a definition stores: a number stays one, a bezier four numbers. */
export const tokenValueFromText = (type: string | undefined, raw: string, previous: unknown): TokenValue =>
  typeof previous === 'number'
    ? keepNumberness(raw, previous)
    : type === 'number'
      ? (asNumber(raw) ?? raw)
      : parseTokenValue(type ?? 'string', raw);

function withEntry<T>(record: Readonly<Record<string, T>> | undefined, key: string, value: T): Record<string, T> {
  return { ...record, [key]: value };
}

/** The leaf `v` holds at `selection`, or undefined when a `by` there has no branch for it. */
export function leafAt<T>(v: Varying<T> | undefined, selection: AxisChoice): T | undefined {
  let cur: unknown = v;
  while (isByAxis(cur)) {
    const key = getOwn(selection, cur.by);
    if (key === undefined || key === 'by' || !Object.hasOwn(cur, key)) return undefined;
    cur = cur[key];
  }
  return cur as T | undefined;
}

/** The branch of `v` that `selection` names; throws when it names none, where writing a leaf would drop every branch. */
function branchOf(v: { readonly by: string }, selection: AxisChoice): string {
  const key = getOwn(selection, v.by);
  if (key === undefined || key === 'by') throw new Error(`no ${v.by} value is chosen, so no branch of this variation can be edited`);
  return key;
}

/** `v` with the leaf at `selection` replaced by `leaf`; every other branch of a `by` stays as it was. */
export function writeAt<T>(v: Varying<T> | undefined, selection: AxisChoice, leaf: T): Varying<T> {
  if (!isByAxis(v)) return leaf;
  const key = branchOf(v, selection);
  return { ...v, [key]: writeAt(getOwn(v, key) as Varying<T> | undefined, selection, leaf) } as Varying<T>;
}

/** `v` without its leaf at `selection`; every other branch of a `by` stays. Undefined when nothing is left, and `v`
 *  itself when it holds no leaf there. */
export function clearAt<T>(v: Varying<T> | undefined, selection: AxisChoice): Varying<T> | undefined {
  if (!isByAxis(v)) return undefined;
  const key = branchOf(v, selection);
  if (!Object.hasOwn(v, key)) return v;
  const branch = getOwn(v, key) as Varying<T> | undefined;
  const inner = clearAt(branch, selection);
  if (inner === branch) return v;
  const rest: Record<string, unknown> = { ...v };
  if (inner === undefined) delete rest[key];
  else setOwn(rest, key, inner);
  return Object.keys(rest).some((k) => k !== 'by') ? (rest as Varying<T>) : undefined;
}

export function setPin(def: ThemeDefinition, name: string, value: Varying<PinValue>): ThemeDefinition {
  return { ...def, pins: withEntry(def.pins, name, value) };
}

export function removePin(def: ThemeDefinition, name: string): ThemeDefinition {
  if (!def.pins || !Object.hasOwn(def.pins, name)) return def;
  const pins = { ...def.pins };
  delete pins[name];
  if (Object.keys(pins).length > 0) return { ...def, pins };
  const out: Mutable<ThemeDefinition> = { ...def };
  delete out.pins;
  return out;
}

/** Drops the definition's own pins on every step of `ramp`. A pin a parent holds stays. */
export function adoptGenerated(def: ThemeDefinition, lookup: Lookup, ramp: string): ThemeDefinition {
  const merged = mergeChain(def, lookup);
  const entry = getOwn(merged.ramps ?? {}, ramp);
  if (!entry) return def;
  return declaredSteps(entry, merged).reduce((d, step) => removePin(d, `${ramp}-${step}`), def);
}

/** Replaces a ramp's entry; a ramp the definition only inherits is copied in first. */
export function setRamp(def: ThemeDefinition, lookup: Lookup, ramp: string, update: (entry: RampDef) => RampDef): ThemeDefinition {
  const current = getOwn(def.ramps ?? {}, ramp) ?? getOwn(mergeChain(def, lookup).ramps ?? {}, ramp);
  return current ? { ...def, ramps: withEntry(def.ramps, ramp, update(current)) } : def;
}

export function setScale(def: ThemeDefinition, lookup: Lookup, scale: string, update: (entry: ScaleDef) => ScaleDef): ThemeDefinition {
  const current = getOwn(def.scales ?? {}, scale) ?? getOwn(mergeChain(def, lookup).scales ?? {}, scale);
  return current ? { ...def, scales: withEntry(def.scales, scale, update(current)) } : def;
}

export function setSemantic(def: ThemeDefinition, name: string, rule: Varying<SemanticRule>): ThemeDefinition {
  return { ...def, semantics: withEntry(def.semantics, name, rule) };
}

export function ruleSummary(rule: Varying<SemanticRule>): string {
  if (isByAxis(rule)) {
    const branches = Object.entries(rule).filter(([k]) => k !== 'by');
    return `by ${rule.by}: ${branches.map(([, v]) => ruleSummary(v as Varying<SemanticRule>)).join(' / ')}`;
  }
  const r = rule as SemanticRule;
  if ('ref' in r) return r.alpha === undefined ? r.ref : `${r.ref} at ${Math.round(r.alpha * 100)}%`;
  if ('contrast' in r) return `${r.ramp} ≥ ${r.contrast.min}:1 against ${r.contrast.against.join(', ')}`;
  if ('offset' in r) return `${r.from} ${r.offset} ${r.dir}`;
  if ('step' in r) return isByAxis(r.step) ? `${r.ramp} by ${r.step.by}` : `${r.ramp}-${r.step}`;
  return String(r.value);
}

const REF = /^\{([^}.]+)\}$/;

/** The ramp step a token's reference chain ends on; undefined when it ends on a literal. */
export function stepOf(name: string, result: DeriveResult): string | undefined {
  const seen = new Set<string>();
  for (let n: string | undefined = name; n !== undefined && !seen.has(n); ) {
    seen.add(n);
    if (getOwn(result.provenance, n)?.layer === 'ramps') return n;
    const value: unknown = getOwn(result.tokens, n)?.value;
    n = typeof value === 'string' ? REF.exec(value.trim())?.[1] : undefined;
  }
  return undefined;
}
