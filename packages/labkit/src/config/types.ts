import type { PrefGroup, PrefLeaf, PrefNumberUnit, PrefRenderer } from '@weasel-js/ui';

/**
 * Renders the control cell for one config leaf. Identical to weasel-ui's
 * `PrefRenderer` on purpose — aliased rather than redeclared so the two
 * cannot drift.
 */
export type ControlRenderer = PrefRenderer;

/** One labeled choice in an `enum` leaf. */
export interface ConfigOption {
  value: string;
  label: string;
}

/** Everything a leaf can carry beyond its kind and default. A flat union of
 *  every `Pref*` leaf's extras, plus labkit's own `debounceMs`. */
export interface Annotations {
  name?: string;
  description?: string;
  hidden?: boolean;
  block?: boolean;
  pair?: string;
  min?: number;
  max?: number;
  step?: number;
  control?: string;
  options?: readonly ConfigOption[];
  alpha?: boolean;
  unit?: PrefNumberUnit;
  placeholder?: string;
  maxLength?: number;
  /** Milliseconds to debounce a string leaf's live writes. Default 150. */
  debounceMs?: number;
}

/** What a rule contributes. `kind` is honored only while it is still unset,
 *  which is what makes `f.value` claimable and a kinded factory final. */
export type LeafPatch = Annotations & { kind?: string };

/** What a rule is given for the leaf it is deciding about. */
export interface ConfigRuleContext {
  /** The config key this leaf writes. */
  key: string;
  /** Dotted path within the schema. Equal to `key` while schemas are flat. */
  path: string;
  /** The leaf's default value. A rule may read it but never change it. */
  default: unknown;
  /** What earlier rules and the author's own annotations have settled. */
  leaf: Readonly<LeafPatch>;
}

/**
 * Decides part of how a leaf is presented. Returns a patch, or null to
 * abstain. Merging is gap-filling: a property already settled is never
 * overwritten, so the author's annotations beat every rule and a consumer's
 * rules beat labkit's built-ins.
 */
export type ConfigRule = (ctx: ConfigRuleContext) => LeafPatch | null;

/** A presentational bucket of leaves, rendered under one heading. */
export interface SectionSpec {
  label: string;
  paths: readonly string[];
}

/** A schema resolved against a set of rules: the vocabulary weasel-ui renders,
 *  plus the three things labkit keeps on the side because `PrefLeaf` has no
 *  field for them. */
export interface ResolvedConfig {
  /** Flat: every leaf is a direct child, so a leaf's path is its config key. */
  group: PrefGroup;
  sections: readonly SectionSpec[];
  showIf: ReadonlyMap<string, (config: Record<string, unknown>) => boolean>;
  /** Node-level `.render` overrides, keyed by path. */
  renderers: Readonly<Record<string, ControlRenderer>>;
}

/** Per-node extras that do not belong on a `PrefLeaf`. */
export interface NodeOptions {
  section?: string;
  showIf?: (config: Record<string, unknown>) => boolean;
  render?: ControlRenderer;
  validate?: (leaf: PrefLeaf) => string[];
}

/** The builder's leaf: a kind (or null, to be decided by rules), a default,
 *  an annotation bag, and the extras above. */
export interface ConfigNode<T = unknown> {
  readonly kind: string | null;
  readonly default: T;
  readonly annotations: Readonly<Annotations>;
  readonly options: Readonly<NodeOptions>;
}

/** The value type a node produces. */
export type NodeValue<N> = N extends ConfigNode<infer T> ? T : never;

/** The config type a builder shape produces. */
export type InferConfig<S> = { [K in keyof S]: NodeValue<S[K]> };

/** An instrument's config, declared once. */
export interface ConfigSchema<TC> {
  readonly nodes: Readonly<Record<string, ConfigNode>>;
  /** The starting config — what `defaultConfig()` would have returned. */
  defaults(): TC;
}

/** The config type behind a schema: `ConfigOf<typeof sceneConfig>`. */
export type ConfigOf<S> = S extends ConfigSchema<infer TC> ? TC : never;
