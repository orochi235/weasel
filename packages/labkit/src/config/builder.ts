import type { IconSpec } from '@weasel-js/icons';
import type { PrefCondition, PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
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
import { CurveNode } from './curveNode';
import { configFromPrefs } from './fromPrefs';
import { NumberNode } from './numberNode';
import { copyTree, setOwn } from './path';
import type {
  Annotations,
  BranchAnnotations,
  BranchOptions,
  ConfigBranch,
  ConfigEntry,
  ConfigOption,
  ConfigPredicate,
  ConfigSchemaBuilder,
  ConfigShape,
  InferConfig,
  NodeOptions,
  SectionOption,
} from './types';

export {
  ActionNode,
  AliasNode,
  BaseNode,
  CurveNode,
  LabelNode,
  ListNode,
  MapNode,
  NumberNode,
  ObjectNode,
  SeparatorNode,
  UnionNode,
};

/** Whether a schema entry is a branch rather than a leaf. */
export function isConfigBranch(entry: ConfigEntry): entry is ConfigBranch {
  return 'children' in entry;
}

/** A boolean leaf, built by `f.boolean`. It draws as a checkbox, or a switch after {@link BooleanNode.switch}. */
export class BooleanNode extends BaseNode<boolean> {
  readonly kind = 'boolean';

  /** Ask for a switch rather than a checkbox. */
  switch(): this {
    return this.ann({ control: 'switch' });
  }
}

/** A text leaf, built by `f.string`; a one-line field unless `.textarea()`. */
export class StringNode extends BaseNode<string> {
  readonly kind = 'string';

  /** What an empty field shows. */
  placeholder(placeholder: string): this {
    return this.ann({ placeholder });
  }

  /** The most characters the field takes. */
  maxLength(maxLength: number): this {
    return this.ann({ maxLength });
  }

  /** Edit the text in a box of several lines, across the whole row. */
  textarea(): this {
    return this.ann({ control: 'textarea' });
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

/** A fixed-choice leaf, built by `f.enum`; a select unless `.radio()`, `.toggle()` or `.menu()`. */
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

  /** A button reading the chosen option, which opens the options as a menu. */
  menu(): this {
    return this.ann({ control: 'menu' });
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

  /** A glyph naming the group. A bar drawn with `.lead('icon')` starts its
   *  line with it; a menu row opening the group carries it beside its name. */
  icon(icon: IconSpec): GroupNode<S> {
    return this.with({ ...this.annotations, icon }, this.options);
  }

  /** Drawn `as('bar')`: whether its line starts with its `icon` or its label.
   *  Unset, it starts with its first cell. Carried on the resolved `PrefGroup`. */
  lead(lead: NonNullable<BranchAnnotations['lead']>): GroupNode<S> {
    return this.with({ ...this.annotations, lead }, this.options);
  }

  /** Render this whole group under a named section heading. An empty `label` is no section. */
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
    setOwn(
      out,
      key,
      isConfigBranch(entry) ? shapeDefaults(entry.children) : copyTree(entry.default),
    );
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
  /** On or off: a checkbox, or a switch after `.switch()`. */
  boolean: (def: boolean): BooleanNode => new BooleanNode(def),
  /** Text: a one-line field, or several lines after `.textarea()`. */
  string: (def: string): StringNode => new StringNode(def),
  /** A color, held as a hex string: `#rrggbb`, or `#rrggbbaa` after `.alpha()`. */
  color: (def: string): ColorNode => new ColorNode(def),
  /** A curve y = f(x) over x in [0, 1], held flat as `[x0, y0, x1, y1, …]`: `f.curve([0, 0, 1, 1]).range(-1, 1)`.
   *  A drag along it is one undo step. */
  curve: (def: readonly number[]): CurveNode => new CurveNode([...def]),
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
  ): ConfigSchemaBuilder<InferConfig<S>> {
    const defaults = () => shapeDefaults(nodes) as InferConfig<S>;
    const build = (admitted: readonly string[]): ConfigSchemaBuilder<InferConfig<S>> => ({
      nodes,
      defaults,
      ...(options.over === undefined ? {} : { over: options.over }),
      ...(admitted.length === 0 ? {} : { admitted }),
      admits: (...selectors) => build([...admitted, ...selectors]),
    });
    return build([]);
  },
};
