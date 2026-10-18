import type { PrefCondition, PrefPair } from '@weasel-js/prefs';
import { type Auto, isAuto } from './auto';
import type {
  Annotations,
  ConfigNode,
  ConfigPredicate,
  ControlRenderer,
  InDialogOptions,
  NodeOptions,
  SectionOption,
} from './types';

/** `annotations` and `options` with `when` under `field` in the one that holds
 *  its form, and nothing under it in the other. */
export function conditioned<A extends object, O extends object>(
  annotations: A,
  options: O,
  field: 'showIf' | 'enableIf',
  when: PrefCondition | ConfigPredicate,
): [A, O] {
  const { [field]: _data, ...said } = annotations as A & { showIf?: unknown; enableIf?: unknown };
  const { [field]: _code, ...rest } = options as O & { showIf?: unknown; enableIf?: unknown };
  return typeof when === 'function'
    ? [said as A, { ...rest, [field]: when } as O]
    : [{ ...said, [field]: when } as A, rest as O];
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

  /** Draw the control across the whole row, with no label beside it: for an
   *  editor too wide for the control column. Showing the leaf's name and
   *  description is then the control's job. */
  block(): this {
    return this.ann({ block: true });
  }

  /** Draw the control in the title row of the heading above it — the section,
   *  the group, or the panel's `title` — with that title as its accessible
   *  name: a section's on/off switch or kind picker. A boolean or enum only. */
  heading(): this {
    return this.ann({ heading: true });
  }

  /** Share one row with the fields `pair.with` names, by full config path
   *  (`'offset.y'`), labeled `pair.label` or else this field's label. */
  pair(pair: PrefPair): this {
    return this.ann({ pair });
  }

  /** Render under a named section heading. `collapsed` opens the section
   *  folded, and `layout` and `pack` lay out its rows — say each on any one of
   *  the section's leaves. */
  section(label: string, opts: Omit<SectionOption, 'label'> = {}): this {
    return this.opt({ section: { label, ...opts } });
  }

  /** Show this row only while `when` holds. Presentational — the value stays
   *  in config and the instrument still reads it. A condition
   *  (`{ path: 'mode', is: 'row' }`) is data: it rides the resolved leaf, so
   *  it exports and can be edited. A function is for what one cannot say. */
  showIf(when: PrefCondition | ConfigPredicate): this {
    return this.with(...conditioned(this.annotations, this.options, 'showIf', when));
  }

  /** Disable this row while `when` does not hold; as `showIf`, a condition or a function. */
  enableIf(when: PrefCondition | ConfigPredicate): this {
    return this.with(...conditioned(this.annotations, this.options, 'enableIf', when));
  }

  /** Draw this one row yourself, keeping the kind, default and validation. */
  render(renderer: ControlRenderer): this {
    return this.opt({ render: renderer, dialog: undefined });
  }

  /** Draw this row as a button that opens a dialog, with `body` as the
   *  dialog's content — for an editor too big for the row. */
  dialog(body: ControlRenderer, opts?: InDialogOptions): this {
    return this.opt({ dialog: { ...opts, body }, render: undefined });
  }

  /**
   * Let this leaf be auto: its row's label then toggles it. A leaf that never
   * says so is always pinned. With `resolve`, the leaf's value while it is
   * auto is what that computes, given the config with every other auto path
   * already resolved; without, it reads `undefined`.
   */
  auto(resolve?: (config: Record<string, unknown>) => T): this {
    return this.opt(
      resolve === undefined
        ? { autoable: true }
        : { autoable: true, autoResolve: resolve as (c: Record<string, unknown>) => unknown },
    );
  }

  /**
   * Start this leaf auto rather than pinned at its default, which also lets it
   * be auto. Takes `auto` and nothing else — the constructor argument already
   * declares the value, and a second way to say it would fight with the first.
   */
  initial(value: Auto): this {
    if (!isAuto(value)) throw new Error('[labkit] .initial() takes `auto` and nothing else');
    return this.opt({ unpinned: true });
  }
}
