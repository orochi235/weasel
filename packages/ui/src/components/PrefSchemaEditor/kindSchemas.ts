import { solid } from '@weasel-js/core';
import {
  isPrefLeaf,
  isPrefSection,
  PREF_KINDS,
  type PrefEnum,
  type PrefField,
  type PrefGroup,
  type PrefKind,
  type PrefLeaf,
  type PrefList,
  type PrefNumber,
  type PrefSection,
} from '@weasel-js/prefs';
import { replaceNode, nodeAt, type SchemaNode, type SchemaRoot } from './schemaEdit';
import { containsCode, STUB } from './schemaExport';

export type KindAttrs = Record<string, PrefLeaf>;
export type CustomKinds = Record<string, KindAttrs>;

export const BUILTIN_KINDS = Object.keys(PREF_KINDS) as readonly PrefKind[];

const text = (name: string, description: string, multiline = false): PrefLeaf =>
  ({ kind: 'string', name, description, default: '', ...(multiline ? { control: 'textarea' } : {}) }) as PrefLeaf;
const flag = (name: string, description: string): PrefLeaf => ({ kind: 'boolean', name, description, default: false });
const optNumber = (name: string, description: string): PrefLeaf => ({ kind: 'optional-number', name, description, default: undefined });
const choice = (name: string, description: string, values: readonly string[]): PrefLeaf =>
  ({ kind: 'enum', name, description, default: undefined, clearable: true, options: values.map((v) => ({ value: v, label: v })) }) as PrefLeaf;
const strings = (name: string, description: string): PrefLeaf =>
  ({ kind: 'list', name, description, default: [], item: { kind: 'string', name: '', description: '', default: '' } }) as PrefLeaf;
/** Text the code spells, which the editor sets in monospace. */
const symbol = (name: string, description: string): PrefLeaf => ({ kind: 'symbol', name, description, default: '' });
const symbols = (name: string, description: string): PrefLeaf =>
  ({ kind: 'list', name, description, default: [], item: symbol('', '') }) as PrefLeaf;
const control = (values: readonly string[]) => choice('Control', 'Which control draws it. Unset: the kind\'s default.', values);

const LEAF_BASE: KindAttrs = {
  name: text('Name', 'The label beside the control.'),
  description: text('Description', 'Help text for the tooltip or the line under the label.', true),
  hidden: flag('Hidden', 'Left out of a settings UI unless it shows hidden prefs.'),
  block: flag('Block', 'Full width with no label row, for a control with its own chrome.'),
  icon: symbol('Icon', 'Glyph name in the host\'s icon set.'),
  pair: { kind: 'pair', name: 'Pair', description: 'The fields that share this one\'s row in compact property UIs, and what the row reads.', default: undefined },
  short: strings('Short names', 'Shorter forms of the name, longest first.'),
};

const KIND_ATTRS: Record<PrefKind, KindAttrs> = {
  number: {
    min: optNumber('Min', 'Lowest value.'),
    max: optNumber('Max', 'Highest value.'),
    step: optNumber('Step', 'Increment.'),
    control: control(['input', 'slider']),
    endless: choice('Endless', 'Which ends run to infinity.', ['min', 'max', 'both']),
  },
  boolean: { control: control(['checkbox', 'switch', 'toggle']) },
  string: { control: control(['input', 'textarea']) },
  enum: {
    options: { kind: 'enum-options', name: 'Options', description: 'Values and their labels, in order.', default: [] },
    clearable: flag('Clearable', 'Can be set back to no value.'),
    control: control(['select', 'radio', 'toggle']),
  },
  color: { alpha: flag('Alpha', 'Offer an alpha channel.') },
  paint: { alpha: flag('Alpha', 'Offer an alpha channel.') },
  object: {},
  field: {
    kinds: symbols('Kinds', 'Only fields of these kinds may be named. Empty: any.'),
  },
  list: {
    minItems: optNumber('Fewest', 'Entries cannot be removed at this many.'),
    maxItems: optNumber('Most', 'Entries cannot be added at this many.'),
  },
  map: {},
  union: { tag: symbol('Tag', 'The field of the value that names its variant.') },
  action: { label: text('Button', 'The button\'s text. Unset: the name.') },
};

const GROUP_ATTRS: KindAttrs = {
  name: LEAF_BASE.name!,
  description: LEAF_BASE.description!,
  as: choice('Drawn as', 'A page of its own in the rail, a tab beside its neighbors, a bordered panel, a heading over its rows, or a fragment: its rows among its neighbors\' with nothing drawn around them. Unset: a page at the top level, a section inside another group.', ['page', 'tab', 'panel', 'section', 'fragment']),
};
const SECTION_ATTRS: KindAttrs = {
  name: LEAF_BASE.name!,
  description: LEAF_BASE.description!,
  as: choice('Drawn as', 'A tab beside its neighbors, a bordered panel, a heading over its rows, or a fragment: its rows among its neighbors\' with nothing drawn around them. Unset: a heading.', ['tab', 'panel', 'section', 'fragment']),
};

const AUTO_FLAGS: KindAttrs = {
  manual: flag('Never auto', 'Cannot be left for its owner to decide: its row gets no way to unpin it.'),
  unpinned: flag('Starts auto', 'Begins unpinned, where it would begin at its default.'),
};

/** Kinds that hold no value, so have nothing to be auto. */
const VALUELESS = new Set(['action', 'label']);

/** Stored as given, falsy or not: `false` and `0` are values a leaf can read while auto. */
const AS_GIVEN = new Set(['autoValue']);

/** Written even when empty: a leaf without them is not a leaf. */
const REQUIRED = new Set(['name', 'description', 'default', 'options', 'tag']);

/** Where a node keeps the nodes under it, which the tree edits and the attributes pane leaves alone. */
const SLOTS = new Set(['children', 'members', 'variants', 'item']);

function valueAttr(leaf: PrefLeaf, base: { name: string; description: string }): PrefLeaf | null {
  switch (leaf.kind) {
    case 'number': {
      const n = leaf as PrefNumber;
      return { ...base, kind: 'number', default: 0, min: n.min, max: n.max, step: n.step } as PrefLeaf;
    }
    case 'boolean': return { ...base, kind: 'boolean', default: false };
    case 'string': return { ...base, kind: 'string', default: '' } as PrefLeaf;
    case 'enum': return { ...base, kind: 'enum', default: undefined, clearable: true, options: (leaf as PrefEnum).options } as PrefLeaf;
    case 'color': return { ...base, kind: 'color', default: '#000000' } as PrefLeaf;
    case 'field': return { ...base, kind: 'field', default: '', kinds: (leaf as PrefField).kinds } as PrefLeaf;
    case 'list': {
      const l = leaf as PrefList;
      return { ...base, kind: 'list', default: [], item: l.item, minItems: l.minItems, maxItems: l.maxItems } as PrefLeaf;
    }
    default: return null;
  }
}

const defaultAttr = (leaf: PrefLeaf) => valueAttr(leaf, { name: 'Default', description: 'The value before anything is stored.' });

function autoAttrs(leaf: PrefLeaf): KindAttrs {
  if (VALUELESS.has(leaf.kind)) return {};
  const value = valueAttr(leaf, { name: 'Auto value', description: 'What it reads while auto, where nothing computes it. It need not be the default.' });
  return { ...AUTO_FLAGS, ...(value ? { autoValue: value } : {}) };
}

function kindAttrs(kind: string, custom: CustomKinds): KindAttrs {
  if (Object.hasOwn(KIND_ATTRS, kind)) return KIND_ATTRS[kind as PrefKind];
  return Object.hasOwn(custom, kind) ? custom[kind]! : {};
}

export interface AttributeSchema {
  /** Attributes every kind has, edited beside the key and the kind. */
  shared: KindAttrs;
  /** The default and the attributes only this kind has; empty for a group. */
  own: KindAttrs;
  /** Whether it can be auto, whether it starts so, and what it reads while it is; empty for a group and for a kind with no value. */
  auto: KindAttrs;
  /** Attributes shown but not edited: code, and anything the kind's schema does not describe. */
  readOnly: Array<[string, unknown]>;
}

/** Editable attributes, rendered with `PrefsForm` over the node itself as values. */
export function attributeSchema(node: SchemaNode, custom: CustomKinds = {}): AttributeSchema {
  if (!isPrefLeaf(node)) return { shared: { ...(isPrefSection(node) ? SECTION_ATTRS : GROUP_ATTRS) }, own: {}, auto: {}, readOnly: [] };
  const def = defaultAttr(node);
  const shared: KindAttrs = { ...LEAF_BASE };
  const own: KindAttrs = { ...(def ? { default: def } : {}), ...kindAttrs(node.kind, custom) };
  const auto = autoAttrs(node);
  const fields = node as unknown as Record<string, unknown>;
  for (const attrs of [shared, own, auto]) for (const k of Object.keys(attrs)) if (containsCode(fields[k])) delete attrs[k];
  const readOnly = Object.entries(fields).filter(([k]) => k !== 'kind' && !SLOTS.has(k) && !(k in shared) && !(k in own) && !(k in auto));
  return { shared, own, auto, readOnly };
}

/** The value to store for an edited attribute: an optional one left empty is removed rather than written. */
export function normalizeAttr(key: string, value: unknown): unknown {
  if (REQUIRED.has(key) || AS_GIVEN.has(key)) return value;
  if (value === undefined || value === '' || value === false) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return value;
}

export function blankLeaf(kind: string): PrefLeaf {
  const base = { kind, name: 'New pref', description: '' };
  switch (kind) {
    case 'number': return { ...base, default: 0 } as PrefLeaf;
    case 'boolean': return { ...base, default: false } as PrefLeaf;
    case 'string': return { ...base, default: '' } as PrefLeaf;
    case 'enum': return { ...base, default: 'a', options: [{ value: 'a', label: 'A' }] } as PrefLeaf;
    case 'color': return { ...base, default: '#000000' } as PrefLeaf;
    case 'paint': return { ...base, default: solid('#000000') } as PrefLeaf;
    case 'object': return { ...base, default: {}, children: {} } as PrefLeaf;
    case 'field': return { ...base, default: '' } as PrefLeaf;
    case 'list': return { ...base, default: [], item: { kind: 'string', name: 'Entry', description: '', default: '' } } as PrefLeaf;
    case 'map': return { ...base, default: {}, item: { kind: 'string', name: 'Value', description: '', default: '' } } as PrefLeaf;
    case 'union': return {
      ...base, default: { type: 'a' }, tag: 'type',
      variants: { a: { kind: 'object', name: 'A', description: '', default: {}, children: {} } },
    } as PrefLeaf;
    case 'action': return { ...base, default: undefined, run: STUB } as PrefLeaf;
    default: return { ...base, default: undefined } as PrefLeaf;
  }
}

export function blankGroup(): PrefGroup {
  return { name: 'New group', description: '', children: {} };
}

export function blankSection(): PrefSection {
  return { name: 'New section', description: '', members: {} };
}

const SHARED = ['name', 'description', 'hidden', 'block', 'icon', 'pair', 'short', 'manual', 'unpinned'];

const PRIMITIVES = new Set(['string', 'number', 'boolean']);

function carriesDefault(v: unknown, blank: Record<string, unknown>): boolean {
  if (!PRIMITIVES.has(typeof v) || typeof v !== typeof blank.default) return false;
  const options = blank.options as Array<{ value: unknown }> | undefined;
  return options === undefined || options.some((o) => o.value === v);
}

/** Change a leaf's kind. Base fields carry over, as does a default of the same type; the rest is reported. */
export function changeKind<R extends SchemaRoot>(root: R, path: string, kind: string, custom: CustomKinds = {}): { root: R; dropped: string[] } {
  const old = nodeAt(root, path) as unknown as Record<string, unknown>;
  const blank = blankLeaf(kind) as unknown as Record<string, unknown>;
  const keep = new Set([...SHARED, ...Object.keys(kindAttrs(kind, custom))]);
  const next: Record<string, unknown> = { ...blank };
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(old)) {
    if (k === 'kind' || v === undefined) continue;
    if (k === 'default') {
      if (carriesDefault(v, blank)) next.default = v;
      else dropped.push('default');
      continue;
    }
    if (SLOTS.has(k)) {
      // What is under a node goes with it to any kind that keeps its nodes the same way.
      if (k in blank) next[k] = v;
      else dropped.push(k);
      continue;
    }
    if (keep.has(k)) next[k] = v;
    else dropped.push(k);
  }
  return { root: replaceNode(root, path, () => next as unknown as SchemaNode), dropped };
}
