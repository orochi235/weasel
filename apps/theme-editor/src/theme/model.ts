import { isByAxis, type PinValue, type Theme, type ThemeDefinition, type Varying } from '@weasel-js/theme';
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

/** Tokens the definition's own entries produce, in definition order. What it inherits is not its own. */
export function ownTokenNames(def: ThemeDefinition): string[] {
  const names = new Set<string>();
  for (const layer of [def.ramps, def.scales]) {
    for (const [name, entry] of Object.entries(layer ?? {})) for (const step of declaredSteps(entry)) names.add(`${name}-${step}`);
  }
  for (const layer of [def.semantics, def.components, def.pins]) for (const name of Object.keys(layer ?? {})) names.add(name);
  return [...names];
}

/** A pin that fails at this selection (a `by` missing its value, an unknown seed) leaves no token, or leaves the rule's. */
export const pinApplies = (result: DeriveResult, name: string): boolean =>
  result.provenance[name]?.pinned === true || result.provenance[name]?.layer === 'pins';

/** Each own token counts once, under the layer that produced it; the Pins row counts the pins that apply, and how many override a generator. */
export function countTokens(def: ThemeDefinition, result: DeriveResult): Counts {
  const zero = () => ({ count: 0, pinned: 0 });
  const layers: Record<LayerId, Mutable<LayerCount>> = {
    seeds: { count: Object.keys(def.seeds ?? {}).length, pinned: 0 },
    ramps: zero(),
    scales: zero(),
    semantics: zero(),
    components: zero(),
    pins: zero(),
  };
  let overridden = 0;
  let total = 0;
  for (const name of ownTokenNames(def)) {
    const p = result.provenance[name];
    if (!p) continue;
    total += 1;
    if (p.pinned) overridden += 1;
    if (p.layer !== 'pins') {
      layers[p.layer].count += 1;
      if (p.pinned) layers[p.layer].pinned += 1;
    }
  }
  for (const name of Object.keys(def.pins ?? {})) {
    if (!pinApplies(result, name)) continue;
    layers.pins.count += 1;
    if (result.provenance[name]?.pinned) layers.pins.pinned += 1;
  }
  return { overridden, total, layers };
}

/** The draft as the runtime takes it, every theme it extends baked the same way. `name` scopes the rule `applyTheme` writes. */
export function runtimeTheme(def: ThemeDefinition, lookup: Lookup, name: string = def.name): Theme {
  const chain = bakeChain(def, lookup);
  return chain.reduce<Theme | null>(
    (parent, baked, i) => ({ name: i === chain.length - 1 ? name : baked.name, extends: parent, axes: baked.axes, tokens: baked.tokens }),
    null,
  )!;
}

function withEntry<T>(record: Readonly<Record<string, T>> | undefined, key: string, value: T): Record<string, T> {
  return { ...record, [key]: value };
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
  const entry = mergeChain(def, lookup).ramps?.[ramp];
  if (!entry) return def;
  return declaredSteps(entry).reduce((d, step) => removePin(d, `${ramp}-${step}`), def);
}

/** Replaces a ramp's entry; a ramp the definition only inherits is copied in first. */
export function setRamp(def: ThemeDefinition, lookup: Lookup, ramp: string, update: (entry: RampDef) => RampDef): ThemeDefinition {
  const current = def.ramps?.[ramp] ?? mergeChain(def, lookup).ramps?.[ramp];
  return current ? { ...def, ramps: withEntry(def.ramps, ramp, update(current)) } : def;
}

export function setScale(def: ThemeDefinition, lookup: Lookup, scale: string, update: (entry: ScaleDef) => ScaleDef): ThemeDefinition {
  const current = def.scales?.[scale] ?? mergeChain(def, lookup).scales?.[scale];
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
    if (result.provenance[n]?.layer === 'ramps') return n;
    const value: unknown = result.tokens[n]?.value;
    n = typeof value === 'string' ? REF.exec(value.trim())?.[1] : undefined;
  }
  return undefined;
}
