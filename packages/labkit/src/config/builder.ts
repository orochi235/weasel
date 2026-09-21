import type { PrefLeaf, PrefNumberFormat, PrefNumberUnit } from '@weasel-js/ui';
import { type Auto, isAuto } from './auto';
import type {
  Annotations,
  BranchAnnotations,
  BranchOptions,
  ConfigBranch,
  ConfigEntry,
  ConfigNode,
  ConfigOption,
  ConfigSchema,
  ConfigShape,
  ControlRenderer,
  InferConfig,
  NodeOptions,
  SectionOption,
} from './types';

/** Whether a schema entry is a branch rather than a leaf. */
export function isConfigBranch(entry: ConfigEntry): entry is ConfigBranch {
  return 'children' in entry;
}

/** Shared chaining surface. Every method clones, so a node can be reused as a
 *  base for several leaves without one bleeding into the next. */
export abstract class BaseNode<T> implements ConfigNode<T> {
  abstract readonly kind: string | null;

  // `default` is a reserved word in a parameter position, so the field is
  // declared rather than taken as a parameter property.
  readonly default: T;

  constructor(
    defaultValue: T,
    readonly annotations: Readonly<Annotations> = {},
    readonly options: Readonly<NodeOptions> = {},
  ) {
    this.default = defaultValue;
  }

  /** Clone into the same subclass. Subclasses with extra constructor
   *  arguments override this. */
  protected with(annotations: Annotations, options: NodeOptions): this {
    const Ctor = this.constructor as new (d: T, a: Annotations, o: NodeOptions) => this;
    return new Ctor(this.default, annotations, options);
  }

  protected ann(patch: Annotations): this {
    return this.with({ ...this.annotations, ...patch }, this.options);
  }

  protected opt(patch: NodeOptions): this {
    return this.with(this.annotations, { ...this.options, ...patch });
  }

  /** Human-readable label. Defaults to the key, title-cased. */
  label(name: string): this {
    return this.ann({ name });
  }

  /** Longer help text, surfaced as a tooltip on the row label. */
  describe(description: string): this {
    return this.ann({ description });
  }

  /** Omit from the panel unless it is asked to show hidden leaves. */
  hidden(): this {
    return this.ann({ hidden: true });
  }

  /** Pair with a sibling sharing this id, side-by-side on one row. */
  pair(pair: string): this {
    return this.ann({ pair });
  }

  /** Render under a named section heading. `collapsed` opens the section
   *  folded, and `layout` and `pack` lay out its rows — say each on any one of
   *  the section's leaves. */
  section(label: string, opts: Omit<SectionOption, 'label'> = {}): this {
    return this.opt({ section: { label, ...opts } });
  }

  /** Show this row only while the predicate holds. Presentational — the value
   *  stays in config and the instrument still reads it. */
  showIf(predicate: (config: Record<string, unknown>) => boolean): this {
    return this.opt({ showIf: predicate });
  }

  /** Draw this one row yourself, keeping the kind, default and validation. */
  render(renderer: ControlRenderer): this {
    return this.opt({ render: renderer });
  }

  /**
   * Compute this leaf's value while it is auto, instead of leaving it
   * `undefined`. The resolver is given the config with every other auto path
   * already resolved.
   */
  auto(resolve: (config: Record<string, unknown>) => T): this {
    return this.opt({ autoResolve: resolve as (c: Record<string, unknown>) => unknown });
  }

  /**
   * Start this leaf auto rather than pinned at its default. Takes `auto` and
   * nothing else — the constructor argument already declares the value, and a
   * second way to say it would fight with the first.
   */
  initial(value: Auto): this {
    if (!isAuto(value)) throw new Error('[labkit] .initial() takes `auto` and nothing else');
    return this.opt({ unpinned: true });
  }

  /** Never auto. The row's label does not toggle. */
  manual(): this {
    return this.opt({ manual: true });
  }
}

export class NumberNode extends BaseNode<number> {
  readonly kind = 'number';

  /** Bound the value. A number with both bounds renders as a slider. */
  range(min: number, max: number): this {
    return this.ann({ min, max });
  }

  step(step: number): this {
    return this.ann({ step });
  }

  /** A display suffix for the value — `'px'`, `'ms'`, `'°'`. Presentation only:
   *  it is never parsed, and the stored value stays a plain number. */
  suffix(suffix: string): this {
    return this.ann({ suffix });
  }

  /** Show the value in a named format — `'compact'` reads `2.0M`. Presentation
   *  only: the stored value stays a plain number, and a typed `2.5m` reads back. */
  format(format: PrefNumberFormat): this {
    return this.ann({ format });
  }

  /**
   * Store the value in one unit and edit it in another — radians stored,
   * degrees typed. `min`, `max` and `step` are declared in the stored unit
   * alongside the value, and convert with it. `prefUnit` builds one from a
   * `UnitSystem`.
   */
  unit(unit: PrefNumberUnit): this {
    return this.ann({ unit });
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

export class BooleanNode extends BaseNode<boolean> {
  readonly kind = 'boolean';

  /** Ask for a switch rather than a checkbox. */
  toggle(): this {
    return this.ann({ control: 'switch' });
  }
}

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

export class ColorNode extends BaseNode<string> {
  readonly kind = 'color';

  /** The value carries alpha as `#rrggbbaa`, and the row gets an opacity
   *  track beside the swatch. */
  alpha(): this {
    return this.ann({ alpha: true });
  }
}

export class EnumNode<T extends string> extends BaseNode<T> {
  readonly kind = 'enum';

  /** Render as a segmented control rather than a select. */
  radio(): this {
    return this.ann({ control: 'radio' });
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

  /** Render this whole group under a named section heading. */
  section(label: string, opts: Omit<SectionOption, 'label'> = {}): GroupNode<S> {
    return this.with(this.annotations, { ...this.options, section: { label, ...opts } });
  }

  /** Show this group only while the predicate holds. Presentational — every
   *  value beneath it stays in config and the instrument still reads it. */
  showIf(predicate: (config: Record<string, unknown>) => boolean): GroupNode<S> {
    return this.with(this.annotations, { ...this.options, showIf: predicate });
  }
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
  number: (def: number): NumberNode => new NumberNode(def),
  boolean: (def: boolean): BooleanNode => new BooleanNode(def),
  string: (def: string): StringNode => new StringNode(def),
  color: (def: string): ColorNode => new ColorNode(def),

  /** A fixed set of choices. The default's literal type flows into the config
   *  type, so `f.enum('fast', ['fast', 'accurate'])` gives
   *  `'fast' | 'accurate'` with no `as const`. */
  enum: <const T extends string>(
    def: T,
    options: readonly T[] | readonly ConfigOption[],
  ): EnumNode<T> => new EnumNode<T>(def, { options: expand(options) }),

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

  /** Collect leaves and groups into an instrument's config. */
  schema<S extends ConfigShape>(nodes: S): ConfigSchema<InferConfig<S>> {
    return { nodes, defaults: () => shapeDefaults(nodes) as InferConfig<S> };
  },
};
