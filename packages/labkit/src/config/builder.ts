import type {
  PrefCondition,
  PrefGroup,
  PrefLeaf,
  PrefNumberUnit,
  PrefSection,
} from '@weasel-js/prefs';
import type { Display, InfinityText } from '@weasel-js/quantity';
import type { Motif } from '@weasel-js/ui/components/MotifFrame';
import { BaseNode, conditioned } from './baseNode';
import {
  ActionNode,
  AliasNode,
  compound,
  LabelNode,
  ListNode,
  MapNode,
  ObjectNode,
  SeparatorNode,
  UnionNode,
} from './compound';
import { configFromPrefs } from './fromPrefs';
import type {
  Annotations,
  BranchAnnotations,
  BranchOptions,
  ConfigBranch,
  ConfigEntry,
  ConfigOption,
  ConfigPredicate,
  ConfigSchema,
  ConfigShape,
  InferConfig,
  NodeOptions,
  SectionOption,
} from './types';

export {
  ActionNode,
  AliasNode,
  BaseNode,
  LabelNode,
  ListNode,
  MapNode,
  ObjectNode,
  SeparatorNode,
  UnionNode,
};

/** Whether a schema entry is a branch rather than a leaf. */
export function isConfigBranch(entry: ConfigEntry): entry is ConfigBranch {
  return 'children' in entry;
}

/** A numeric leaf, built by `f.number`. `T` takes `undefined` once the leaf is {@link NumberNode.clearable}. */
export class NumberNode<T extends number | undefined = number> extends BaseNode<T> {
  readonly kind = 'number';

  /** Bound the value. A number with both bounds renders as a slider. */
  range(min: number, max: number): this {
    return this.ann({ min, max });
  }

  /** Bound the value from below only. The row stays a typed field. */
  min(min: number): this {
    return this.ann({ min });
  }

  /** Bound the value from above only. The row stays a typed field. */
  max(max: number): this {
    return this.ann({ max });
  }

  /** Let the value be unset: emptying the field writes `undefined`, and an unset value draws as an empty field
   *  showing the {@link NumberNode.placeholder}. Without it an emptied field puts its value back. */
  clearable(): NumberNode<T | undefined> {
    return this.ann({ clearable: true }) as NumberNode<T | undefined>;
  }

  /** What an empty field shows: what an unset value stands for. */
  placeholder(placeholder: string): this {
    return this.ann({ placeholder });
  }

  step(step: number): this {
    return this.ann({ step });
  }

  /** A display suffix for the value — `'px'`, `'ms'`, `'°'`. Presentation only:
   *  it is never parsed, and the stored value stays a plain number. */
  suffix(suffix: string): this {
    return this.ann({ suffix });
  }

  /** Show, speak and read the value through a display — `compact()` reads
   *  `2.00M`. Presentation only: the stored value stays a plain number. */
  display(display: Display): this {
    return this.ann({ display });
  }

  /**
   * Store the value in one unit and edit it in another — radians stored,
   * degrees typed. `min`, `max` and `step` are declared in the stored unit
   * alongside the value, and convert with it. A unit is data where the
   * conversion is linear, `{ suffix: '°', scale: Math.PI / 180 }`, which
   * `prefUnit` builds from a `UnitSystem`, and a pair of functions where it
   * is not.
   */
  unit(unit: PrefNumberUnit): this {
    return this.ann({ unit });
  }

  /**
   * Add a stop for infinity one step past the top of the range: it stores
   * `Infinity` and reads `word` — `.range(0, 5000).endless('never')` — and
   * every value up to `max` stays reachable. `at: 'min'` adds it below the
   * bottom instead, as `-Infinity`; `'both'` does both.
   */
  endless(word?: InfinityText, at: 'min' | 'max' | 'both' = 'max'): this {
    return this.ann(word === undefined ? { endless: at } : { endless: at, infinity: word });
  }

  /** Force a slider even without both bounds. */
  slider(): this {
    return this.ann({ control: 'slider' });
  }

  /** Force a typed input even when both bounds are set. */
  input(): this {
    return this.ann({ control: 'input' });
  }
}

/** A true/false leaf, built by `f.boolean`; a checkbox unless `.toggle()`. */
export class BooleanNode extends BaseNode<boolean> {
  readonly kind = 'boolean';

  /** Ask for a switch rather than a checkbox. */
  toggle(): this {
    return this.ann({ control: 'switch' });
  }
}

/** A text leaf, built by `f.string`. */
export class StringNode extends BaseNode<string> {
  readonly kind = 'string';

  placeholder(placeholder: string): this {
    return this.ann({ placeholder });
  }

  maxLength(maxLength: number): this {
    return this.ann({ maxLength });
  }

  /** Milliseconds to debounce live writes. 0 commits every keystroke. */
  debounce(debounceMs: number): this {
    return this.ann({ debounceMs });
  }
}

/** A color leaf holding a hex string, built by `f.color`. */
export class ColorNode extends BaseNode<string> {
  readonly kind = 'color';

  /** The value carries alpha as `#rrggbbaa`, and the row gets an opacity
   *  track beside the swatch. */
  alpha(): this {
    return this.ann({ alpha: true });
  }
}

/** A fixed-choice leaf, built by `f.enum`; a select unless `.radio()` or `.toggle()`. */
export class EnumNode<T extends string> extends BaseNode<T> {
  readonly kind = 'enum';

  /** Every option at once. A control panel draws segments; a preferences form reading the leaf draws radio buttons. */
  radio(): this {
    return this.ann({ control: 'radio' });
  }

  /** Every option at once, as segments wherever the leaf is drawn. */
  toggle(): this {
    return this.ann({ control: 'toggle' });
  }

  /** Relabel the choices. Named `labels` rather than `options` because
   *  `options` is the node's own extras bag. */
  labels(options: readonly ConfigOption[]): this {
    return this.ann({ options });
  }
}

/** A leaf whose kind the rule chain decides. */
export class ValueNode<T> extends BaseNode<T> {
  readonly kind = null;
}

/** A leaf of a kind labkit does not ship a row for. */
export class CustomNode<T> extends BaseNode<T> {
  constructor(
    readonly kind: string,
    defaultValue: T,
    annotations: Readonly<Annotations> = {},
    options: Readonly<NodeOptions> = {},
  ) {
    super(defaultValue, annotations, options);
  }

  protected override with(annotations: Annotations, options: NodeOptions): this {
    return new CustomNode(this.kind, this.default, annotations, options) as this;
  }
}

/**
 * A branch of the schema: its children nest under its key, so a leaf inside
 * one is read and written at a dotted path. Distinct from `.section()`, which
 * puts a heading over sibling leaves and leaves their paths alone.
 */
export class GroupNode<S extends ConfigShape> implements ConfigBranch<S> {
  constructor(
    readonly children: S,
    readonly annotations: Readonly<BranchAnnotations> = {},
    readonly options: Readonly<BranchOptions> = {},
  ) {}

  private with(annotations: BranchAnnotations, options: BranchOptions): GroupNode<S> {
    return new GroupNode(this.children, annotations, options);
  }

  /** Heading for the group's rows. Defaults to the key, title-cased. */
  label(name: string): GroupNode<S> {
    return this.with({ ...this.annotations, name }, this.options);
  }

  /** Longer help text. Carried on the resolved `PrefGroup`; both weasel-ui's
   *  `PrefsForm` and `ControlPanel` draw it under the heading. */
  describe(description: string): GroupNode<S> {
    return this.with({ ...this.annotations, description }, this.options);
  }

  /** How the group is drawn: a `tab` beside its neighbors, a bordered `panel`,
   *  a `section` heading over its rows, or a `page` of its own where the
   *  surface has pages. Carried on the resolved `PrefGroup`. */
  as(kind: NonNullable<BranchAnnotations['as']>): GroupNode<S> {
    return this.with({ ...this.annotations, as: kind }, this.options);
  }

  /** Drawn `as('bar')`: what happens to the cells its line has no room for.
   *  `menu` opens them from a button at its end, where `scroll`, the default,
   *  keeps them all on it. Carried on the resolved `PrefGroup`. */
  overflow(mode: NonNullable<BranchAnnotations['overflow']>): GroupNode<S> {
    return this.with({ ...this.annotations, overflow: mode }, this.options);
  }

  /** Render this whole group under a named section heading. */
  section(label: string, opts: Omit<SectionOption, 'label'> = {}): GroupNode<S> {
    return this.with(this.annotations, { ...this.options, section: { label, ...opts } });
  }

  /** Show this group only while `when` holds, a condition or a function as on
   *  a leaf. Presentational — every value beneath it stays in config and the
   *  instrument still reads it. */
  showIf(when: PrefCondition | ConfigPredicate): GroupNode<S> {
    return this.with(...conditioned(this.annotations, this.options, 'showIf', when));
  }

  /** Disable every row beneath this group while `when` does not hold. */
  enableIf(when: PrefCondition | ConfigPredicate): GroupNode<S> {
    return this.with(...conditioned(this.annotations, this.options, 'enableIf', when));
  }

  /** Put a button on the group's heading that returns every value beneath it
   *  to its default, leaving the rest of the config alone. */
  resettable(): GroupNode<S> {
    return this.with(this.annotations, { ...this.options, resettable: true });
  }

  /** Draw the group's card in a `MotifFrame` motif from `@weasel-js/ui`, as
   *  `.motif(stereo())`, in place of the panel's default frame. Has no effect on a
   *  group drawn `as` a tab, bar, section, or fragment. */
  motif(motif: Motif): GroupNode<S> {
    return this.with(this.annotations, { ...this.options, motif });
  }
}

function numberLeaf(def: number): NumberNode;
function numberLeaf(): NumberNode<number | undefined>;
function numberLeaf(def?: number): NumberNode<number | undefined> {
  return def === undefined
    ? new NumberNode<number | undefined>(undefined).clearable()
    : new NumberNode(def);
}

/** Every default in a shape, nested the way the shape is. */
function shapeDefaults(shape: ConfigShape): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(shape)) {
    out[key] = isConfigBranch(entry) ? shapeDefaults(entry.children) : entry.default;
  }
  return out;
}

const expand = <T extends string>(
  options: readonly T[] | readonly ConfigOption[],
): readonly ConfigOption[] =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

function enumLeaf<const T extends string>(def: NoInfer<T>, options: readonly T[]): EnumNode<T>;
function enumLeaf<const T extends string>(
  def: NoInfer<T>,
  options: readonly ConfigOption<T>[],
): EnumNode<T>;
function enumLeaf<const T extends string>(
  def: NoInfer<T>,
  options: readonly T[] | readonly ConfigOption<T>[],
): EnumNode<T>;
function enumLeaf<T extends string>(
  def: T,
  options: readonly T[] | readonly ConfigOption<T>[],
): EnumNode<T> {
  return new EnumNode<T>(def, { options: expand(options) });
}

/**
 * Builds an instrument's config: the values, their types, and how each is
 * edited, in one declaration.
 *
 * ```ts
 * const config = f.schema({
 *   showGrid: f.boolean(true),
 *   cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
 *   // Nested: read and written at `grid.color`.
 *   grid: f.group({ color: f.color('#ffffff') }),
 * })
 * ```
 */
export const f = {
  /** A number. Given no default, it starts unset and is {@link NumberNode.clearable}. */
  number: numberLeaf,
  boolean: (def: boolean): BooleanNode => new BooleanNode(def),
  string: (def: string): StringNode => new StringNode(def),
  color: (def: string): ColorNode => new ColorNode(def),
  ...compound,

  /** A fixed set of choices. The choices' literal types flow into the config
   *  type, so `f.enum('fast', ['fast', 'accurate'])` and the same choices as
   *  `{ value, label }` options both give `'fast' | 'accurate'`, with no `as const`. */
  enum: enumLeaf,

  /** A leaf with no declared kind: the rule chain decides, which is how a lab
   *  states a convention like "every `*Color` key is a color picker". */
  value: <T>(def: T): ValueNode<T> => new ValueNode(def),

  /** A branch: its children nest under this key, so `grid: f.group({ size })`
   *  puts the value at `config.grid.size` and addresses it as `'grid.size'`.
   *  Groups nest as deeply as the schema wants. */
  group: <const S extends ConfigShape>(children: S): GroupNode<S> => new GroupNode(children),

  /** A leaf of a kind a lab supplies the control for, through `controls`. */
  custom: <T>(
    kind: string,
    def: T,
    validate?: (leaf: PrefLeaf, config: Record<string, unknown>) => string[],
  ): CustomNode<T> => new CustomNode(kind, def, {}, validate ? { validate } : {}),

  /** A property schema (`PrefSection`) as an instrument's config: see {@link configFromPrefs}. */
  prefs: configFromPrefs,

  /** Collect leaves and groups into an instrument's config, drawn over `options.over` where given. */
  schema<S extends ConfigShape>(
    nodes: S,
    options: { over?: PrefGroup | PrefSection } = {},
  ): ConfigSchema<InferConfig<S>> {
    const defaults = () => shapeDefaults(nodes) as InferConfig<S>;
    return options.over === undefined
      ? { nodes, defaults }
      : { nodes, defaults, over: options.over };
  },
};
