import type { PrefGroup, PrefLeaf, PrefRenderer } from '@weasel-js/ui';

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
  suffix?: string;
  control?: string;
  options?: readonly ConfigOption[];
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
  /** The leaf's own key — its last path segment, and what a label is titled
   *  from. */
  key: string;
  /** Dotted path within the schema, which is the path the value is written
   *  at. Equal to `key` for a leaf sitting at the root. */
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

/** A presentational bucket of nodes, rendered under one heading. Buckets
 *  siblings: a section never nests a value, which is what separates it from
 *  `f.group`. */
export interface SectionSpec {
  /** Dotted path of the group whose children this buckets. `''` is the root,
   *  which is where every section of a flat schema sits. */
  at: string;
  label: string;
  /** Full dotted paths, so a section under a group names its children the way
   *  everything else does. */
  paths: readonly string[];
  /** Whether the section opens folded. Set, the panel folds this section
   *  whether or not it was given a panel-wide `collapse`; a fold the reader
   *  has since toggled outranks it. */
  collapsed?: boolean;
}

/** A schema resolved against a set of rules: the vocabulary weasel-ui renders,
 *  plus the three things labkit keeps on the side because `PrefLeaf` has no
 *  field for them. */
export interface ResolvedConfig {
  /** The schema as a `PrefGroup` tree: an `f.group` is a nested group, so a
   *  leaf's dotted path within it is the path its value is written at. */
  group: PrefGroup;
  sections: readonly SectionSpec[];
  showIf: ReadonlyMap<string, (config: Record<string, unknown>) => boolean>;
  /** Node-level `.render` overrides, keyed by path. */
  renderers: Readonly<Record<string, ControlRenderer>>;
}

/** How a node names the section it belongs to: the heading, and how that
 *  section opens. Every node in one section repeats the heading; only one of
 *  them has to say `collapsed`. */
export interface SectionOption {
  label: string;
  collapsed?: boolean;
}

/** Per-node extras that do not belong on a `PrefLeaf`. */
export interface NodeOptions extends BranchOptions {
  render?: ControlRenderer;
  validate?: (leaf: PrefLeaf) => string[];
}

/** What a branch can say about itself, beyond its children. */
export interface BranchOptions {
  section?: SectionOption;
  /** Show this node only while the predicate holds. On a group it hides the
   *  whole subtree; the values stay in config either way. */
  showIf?: (config: Record<string, unknown>) => boolean;
}

/** A group's own annotations: what it is called and, optionally, why. */
export interface BranchAnnotations {
  name?: string;
  description?: string;
}

/** The builder's leaf: a kind (or null, to be decided by rules), a default,
 *  an annotation bag, and the extras above. */
export interface ConfigNode<T = unknown> {
  readonly kind: string | null;
  readonly default: T;
  readonly annotations: Readonly<Annotations>;
  readonly options: Readonly<NodeOptions>;
}

/** The builder's branch: named children, nested as deeply as the schema
 *  wants. A branch nests the value too — `grid: f.group({ size })` puts the
 *  value at `grid.size`, where `.section('Grid')` would have left it at
 *  `size`. */
export interface ConfigBranch<S extends ConfigShape = ConfigShape> {
  readonly children: S;
  readonly annotations: Readonly<BranchAnnotations>;
  readonly options: Readonly<BranchOptions>;
}

/** Either half of a schema tree. */
export type ConfigEntry = ConfigNode | ConfigBranch;

/** The children of a schema or a group. */
export type ConfigShape = { readonly [key: string]: ConfigEntry };

/** The value type a node produces. */
export type NodeValue<N> = N extends ConfigNode<infer T> ? T : never;

/** The value type a schema entry produces — a leaf's own, or a branch's
 *  nested record. */
export type EntryValue<E> =
  E extends ConfigBranch<infer S> ? InferConfig<S> : E extends ConfigNode<infer T> ? T : never;

/** The config type a builder shape produces. */
export type InferConfig<S> = { [K in keyof S]: EntryValue<S[K]> };

/** Whether a config value has children a path can descend into. Arrays and
 *  functions are values, not branches. */
type Branching<V> = V extends readonly unknown[]
  ? false
  : V extends (...args: never[]) => unknown
    ? false
    : V extends object
      ? true
      : false;

/**
 * Every dotted path a config offers, a group's own path included. A config
 * whose shape is not known — `unknown`, or a bare record — gives `string`,
 * which is what keeps a generic instrument writable.
 */
export type ConfigPath<T> = unknown extends T
  ? string
  : T extends object
    ? {
        [K in keyof T & string]: Branching<T[K]> extends true ? K | `${K}.${ConfigPath<T[K]>}` : K;
      }[keyof T & string]
    : never;

/** The type at a dotted path, or `unknown` where the path is not one the
 *  config's type spells out. */
export type ValueAtPath<T, P extends string> = unknown extends T
  ? unknown
  : P extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
      ? ValueAtPath<T[Head], Rest>
      : unknown
    : P extends keyof T
      ? T[P]
      : unknown;

/** An instrument's config, declared once. */
export interface ConfigSchema<TC> {
  readonly nodes: ConfigShape;
  /** The starting config — what `defaultConfig()` would have returned. */
  defaults(): TC;
}

/** The config type behind a schema: `ConfigOf<typeof sceneConfig>`. */
export type ConfigOf<S> = S extends ConfigSchema<infer TC> ? TC : never;
