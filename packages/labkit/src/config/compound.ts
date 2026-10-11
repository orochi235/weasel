import type { PrefAction, PrefLeaf, PrefObject } from '@weasel-js/prefs';
import { BaseNode } from './baseNode';
import { titleCase } from './rules';
import type { ConfigNode, NodeValue } from './types';

/** A list leaf, built by `f.list`: strings, unless it was given what an entry is. */
export class ListNode<T = string> extends BaseNode<T[]> {
  readonly kind = 'list';

  /** Shown in an empty entry of a list of strings. */
  placeholder(placeholder: string): this {
    return this.ann({ placeholder });
  }

  /** The fewest and the most entries the list may hold. */
  count(min: number | undefined, max?: number): this {
    return this.ann({ minItems: min, maxItems: max });
  }
}

/** A button among the rows, built by `f.action`. Holds no value. */
export class ActionNode extends BaseNode<undefined> {
  readonly kind = 'action';
}

/** A second row for another leaf, built by `f.alias`: it draws that leaf's control over that leaf's value, and
 *  holds none of its own. Its own `.showIf` and `.section` place it; `.label` and `.describe` rename it here. */
export class AliasNode extends BaseNode<undefined> {
  readonly kind = 'alias';
}

/** A node as a leaf inside another's value: a list's or a map's item, an object's field, a union's variant.
 *  Named for `key` where it has one and no label of its own. */
function itemLeaf(node: ConfigNode, key?: string): PrefLeaf {
  const kind = node.kind ?? typeof node.default;
  if (node.kind === null && kind !== 'string' && kind !== 'number' && kind !== 'boolean') {
    throw new Error(
      `[labkit] an f.value inside another leaf has a kind that cannot be inferred from its default (${String(node.default)})`,
    );
  }
  return {
    name: key === undefined ? '' : titleCase(key),
    description: '',
    ...node.annotations,
    kind,
    default: node.default,
  } as PrefLeaf;
}

function listOf(def: readonly string[]): ListNode;
function listOf<T>(def: readonly T[], item: ConfigNode<T>): ListNode<T>;
function listOf<T>(def: readonly T[], item?: ConfigNode<T>): ListNode<T> {
  return new ListNode<T>([...def], item ? { item: itemLeaf(item) } : {});
}

/** One value with named fields, built by `f.object`: a single leaf, where `f.group` would be a leaf per field. */
export class ObjectNode<T> extends BaseNode<T> {
  readonly kind = 'object';
}

/** A record of one kind of value by arbitrary key, built by `f.map`. */
export class MapNode<T> extends BaseNode<Record<string, T>> {
  readonly kind = 'map';
}

/** One of several objects told apart by a tag field, built by `f.union`. */
export class UnionNode<T> extends BaseNode<T> {
  readonly kind = 'union';
}

type Fields = Readonly<Record<string, ConfigNode>>;
type FieldValues<S extends Fields> = { -readonly [K in keyof S]: NodeValue<S[K]> };
type Variants = Readonly<Record<string, ConfigNode<object> & { readonly kind: 'object' }>>;
type VariantValues<Tag extends string, V extends Variants> = {
  [K in keyof V & string]: { [P in Tag]: K } & NodeValue<V[K]>;
}[keyof V & string];

/** The builders for leaves whose value is made of other leaves' values, and for the leaf that has none. */
export const compound = {
  /** A list: of strings, or of whatever `item` builds — `f.list([0, 1], f.number(0).range(0, 9))`.
   *  Its row summarizes the list, and opens a dialog to edit it one entry per
   *  control. */
  list: listOf,

  /** One value with these fields, read and written whole at this key — where
   *  `f.group` makes each field a leaf of its own. A field's label defaults to
   *  its key, title-cased. */
  object: <const S extends Fields>(fields: S): ObjectNode<FieldValues<S>> =>
    new ObjectNode(
      Object.fromEntries(
        Object.entries(fields).map(([key, node]) => [key, node.default]),
      ) as FieldValues<S>,
      {
        children: Object.fromEntries(
          Object.entries(fields).map(([key, node]) => [key, itemLeaf(node, key)]),
        ),
      },
    ),

  /** A record of values by whatever key is typed, each one what `item` builds. */
  map: <T>(def: Readonly<Record<string, T>>, item: ConfigNode<T>): MapNode<T> =>
    new MapNode<T>({ ...def }, { item: itemLeaf(item) }),

  /** One of several objects, told apart by the string its `tag` field holds:
   *  `f.union('type', { linear: f.object({ angle: f.number(90) }), radial: f.object({ radius: f.number(1) }) })`.
   *  It starts as the first variant; a variant's label defaults to its key, title-cased. */
  union: <const Tag extends string, const V extends Variants>(
    tag: Tag,
    variants: V,
  ): UnionNode<VariantValues<Tag, V>> => {
    const [first] = Object.entries(variants);
    if (!first) throw new Error('[labkit] f.union needs at least one variant');
    return new UnionNode({ ...first[1].default, [tag]: first[0] } as VariantValues<Tag, V>, {
      tag,
      variants: Object.fromEntries(
        Object.entries(variants).map(([key, node]) => [key, itemLeaf(node, key) as PrefObject]),
      ),
    });
  },

  /** A button among the rows, which calls `run`. Its label is the button's text. */
  action: (run: PrefAction['run']): ActionNode => new ActionNode(undefined, { run }),
  /** `of` is the path the shown leaf's value is written at, from the schema's root: `'view.grid'`. */
  alias: (of: string): AliasNode => new AliasNode(undefined, { of, name: '' }),
};
