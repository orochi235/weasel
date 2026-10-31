import type { IconRef } from '@weasel-js/icons';
import type {
  PrefActionContext,
  PrefAuto,
  PrefBarOverflow,
  PrefCondition,
  PrefGroup,
  PrefGroupAs,
  PrefLeaf,
  PrefNumberUnit,
  PrefObject,
  PrefPair,
  PrefSection,
} from '@weasel-js/prefs';
import type { Display, InfinityText } from '@weasel-js/quantity';
import type { Motif } from '@weasel-js/ui/components/MotifFrame';
import type { PrefRenderer } from '@weasel-js/ui/components/Prefs';
import type { ReactNode } from 'react';

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
  /** A qualified icon ref (`icon('ui:gradeSuccess')`) in the registry in scope. A segmented row draws it in
   *  place of `label`, which stays the accessible name and becomes the tooltip;
   *  a select draws it beside `label`. */
  icon?: IconRef;
}

/** Everything a leaf can carry beyond its kind and default. A flat union of
 *  every `Pref*` leaf's extras, plus labkit's own `debounceMs`. */
export interface Annotations {
  name?: string;
  description?: string;
  hidden?: boolean;
  /** Draw the row only while this holds. Set by `.showIf` given a condition. */
  showIf?: PrefCondition;
  /** Disable the row while this does not hold. Set by `.enableIf` given a condition. */
  enableIf?: PrefCondition;
  block?: boolean;
  pair?: PrefPair;
  /** Draw the control in the title row of the section or group holding it. */
  heading?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** A number leaf may be unset: emptying its field writes `undefined`. */
  clearable?: boolean;
  suffix?: string;
  /** How a number's value shows, speaks and reads back — `compact()` reads `2.00M`. */
  display?: Display;
  /** Display-unit conversion for a number stored in a canonical unit — the
   *  value, its bounds and its step all convert at the control's edge. */
  unit?: PrefNumberUnit;
  /** Which end of a number's slider gets a stop for infinity, one step beyond the range. */
  endless?: 'min' | 'max' | 'both';
  /** The word a number's infinity shows as — `'never'`. Default `∞`. */
  infinity?: InfinityText;
  /** A color leaf's value carries alpha (`#rrggbbaa`) and its row edits it. */
  alpha?: boolean;
  control?: string;
  options?: readonly ConfigOption[];
  placeholder?: string;
  maxLength?: number;
  /** Milliseconds to debounce a string leaf's live writes. Default 150. */
  debounceMs?: number;
  /** What each entry of a list leaf is. */
  item?: PrefLeaf;
  minItems?: number;
  maxItems?: number;
  /** An object leaf's fields. */
  children?: PrefObject['children'];
  /** The field of a union leaf's value that names its variant. */
  tag?: string;
  variants?: Record<string, PrefObject>;
  /** What an action leaf's button calls. */
  run?: ConfigActionRun;
  /** The path of the leaf an alias shows. */
  of?: string;
}

/** What an `f.action`'s run is told where labkit draws it: its path, and the config of the
 *  panel drawing it, with that panel's writer. */
export interface ConfigActionContext extends PrefActionContext {
  config: Record<string, unknown>;
  setConfig: (path: string, value: unknown) => void;
}

/** What an `f.action` calls. */
export type ConfigActionRun = (ctx: ConfigActionContext) => void | Promise<void>;

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
  /** Where the section's rows put their labels, over the panel's `layout`, `'inline'` by default. */
  layout?: 'block' | 'inline';
  /** How the section packs its rows, over the panel's `pack`, `'pairs'` by default. */
  pack?: 'auto' | 'pairs' | 'one-up';
  /** A class on the section's frame, for a look the section alone takes. */
  className?: string;
  /** The `MotifFrame` motif the section is drawn in, as `stereo()`. Unset, the panel's `motif`, else the default card. */
  motif?: Motif;
}

/** A schema resolved against a set of rules: the vocabulary weasel-ui renders,
 *  plus what labkit keeps on the side because a `PrefLeaf` cannot hold it. */
export interface ResolvedConfig {
  /** The schema as a `PrefGroup` tree: an `f.group` is a nested group, so a
   *  leaf's dotted path within it is the path its value is written at. */
  group: PrefGroup;
  sections: readonly SectionSpec[];
  /** The `.showIf` predicates written as functions, keyed by path. One
   *  written as a condition is on its node in `group`. */
  showIf: ReadonlyMap<string, ConfigPredicate>;
  /** The `.enableIf` predicates written as functions, as `showIf`. */
  enableIf?: ReadonlyMap<string, ConfigPredicate>;
  /** Node-level `.render` overrides, keyed by path. */
  renderers: Readonly<Record<string, ControlRenderer>>;
  /** Node-level `.dialog` rows, keyed by path. */
  dialogs: Readonly<Record<string, DialogSpec>>;
  /** Paths of the groups marked `.resettable()`, whose heading carries a
   *  button that puts every value beneath it back to its default. */
  resettable?: ReadonlySet<string>;
  /** The motif each group set with `.motif()` is drawn in, keyed by the group's path. */
  motifs?: ReadonlyMap<string, Motif>;
  /** The schema this one was resolved over, which its aliases point into and its conditions may read. */
  over?: PrefGroup | PrefSection;
}

/** Options for a row drawn as a button that opens a dialog. */
export interface InDialogOptions {
  /** What the row's button shows of the value. Defaults to a list joined with
   *  commas, or the value itself. */
  summary?: (value: unknown) => ReactNode;
  /** The dialog's heading. Defaults to the row's label. */
  title?: ReactNode;
  /** Turns the body's draft into the value Done writes, so the draft may pass
   *  through states the saved value never should (a blank entry, a half-typed
   *  duplicate) and be cleaned once. Runs once at Done, only on a draft that was
   *  edited; Cancel never runs it. */
  commit?: (draft: unknown) => unknown;
}

/** A `.dialog` row: `body` is the dialog's content, handed the context a row
 *  renderer gets. */
export interface DialogSpec extends InDialogOptions {
  body: ControlRenderer;
}

/** How a node names the section it belongs to: the heading, and how that
 *  section opens. Every node in one section repeats the heading; only one of
 *  them has to say `collapsed`. */
export interface SectionOption {
  label: string;
  collapsed?: boolean;
  /** Where the section's rows put their labels, over the panel's `layout`, `'inline'` by default. */
  layout?: 'block' | 'inline';
  /** How the section packs its rows, over the panel's `pack`, `'pairs'` by default. */
  pack?: 'auto' | 'pairs' | 'one-up';
  /** A class on the section's frame, for a look the section alone takes. */
  className?: string;
  /** The `MotifFrame` motif the section is drawn in, as `stereo()`. Unset, the panel's `motif`, else the default card. */
  motif?: Motif;
}

/** Per-node extras that do not belong on a `PrefLeaf`. */
export interface NodeOptions extends BranchOptions {
  render?: ControlRenderer;
  /** Draw the row as a button that opens a dialog. Set by `.dialog`; the
   *  config entry records it, and `ControlPanel` draws it. */
  dialog?: DialogSpec;
  /** Errors for this leaf under `config`, the instrument's whole config. */
  validate?: (leaf: PrefLeaf, config: Record<string, unknown>) => string[];
  /** The leaf may be auto, and its row's label toggles it: `.auto()` sets
   *  it, and `.initial(auto)` sets it with `on`. It becomes the resolved
   *  leaf's `auto`; a leaf without it is always pinned. */
  auto?: PrefAuto;
  /** Computes this leaf's value while it is auto. Attaching one is what gives
   *  the row a real value to pin back to and keeps the instrument off
   *  `?? compute()`. */
  autoResolve?: (config: Record<string, unknown>) => unknown;
}

/** A `.showIf` or `.enableIf` written as code, for what a condition cannot say. */
export type ConfigPredicate = (config: Record<string, unknown>) => boolean;

/** What a branch can say about itself, beyond its children. */
export interface BranchOptions {
  section?: SectionOption;
  /** Show this node only while the predicate holds. On a group it hides the
   *  whole subtree; the values stay in config either way. */
  showIf?: ConfigPredicate;
  /** Disable this node while the predicate does not hold; on a group, the whole subtree. */
  enableIf?: ConfigPredicate;
  /** Put a button on this group's heading that returns every value beneath it
   *  to its default. Groups only. */
  resettable?: boolean;
  /** The `MotifFrame` motif this group's card is drawn in. Groups only. */
  motif?: Motif;
}

/** A group's own annotations: what it is called, optionally why, and how it is drawn. */
export interface BranchAnnotations {
  name?: string;
  description?: string;
  as?: PrefGroupAs;
  overflow?: PrefBarOverflow;
  showIf?: PrefCondition;
  enableIf?: PrefCondition;
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
export type Branching<V> = V extends readonly unknown[]
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
  /** Another schema this one is drawn over: an `f.alias` may show a leaf of it, and a condition may
   *  read a setting of it. Its values are not the config's; a lab keeps them (`<Lab over>`). */
  readonly over?: PrefGroup | PrefSection;
}

/** The config type behind a schema: `ConfigOf<typeof sceneConfig>`. */
export type ConfigOf<S> = S extends ConfigSchema<infer TC> ? TC : never;
