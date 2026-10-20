import { solid } from '@weasel-js/core';
import {
  isPrefLeaf,
  isPrefSection,
  PREF_KINDS,
  prefHoldsValue,
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
import { findType, NO_TYPES, typeNamed, type PrefTypes } from './types';
import { actionChoice, registeredFacts, type RegisteredAction } from './registeredActionAttrs';

/** One attribute of a kind, as the leaf that edits it. `required` keeps it on a leaf when it is emptied, and seeds
 *  it, from this leaf's `default`, in a new leaf of the kind. */
export type KindAttr = PrefLeaf & { required?: boolean };
/** A kind's attributes, by attribute name. */
export type KindAttrs = Record<string, KindAttr>;
/** A custom kind's own attributes, by kind. One named `default` gives the kind a Default row, and a new leaf its default. */
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
/** The attribute kind an `icon` is edited as: a picker over every registered icon. */
export const ICON_KIND = 'icon';
const symbols = (name: string, description: string): PrefLeaf =>
  ({ kind: 'list', name, description, default: [], item: symbol('', '') }) as PrefLeaf;
/** The attribute kind a `showIf` or an `enableIf` is edited as: a `PrefCondition` over the schema's other leaves. */
export const CONDITION_KIND = 'condition';
const condition = (name: string, description: string): PrefLeaf => ({ kind: CONDITION_KIND, name, description, default: undefined });
const SHOW_IF = condition('Shown if', 'Drawn only while this holds of the other prefs\' values. None: always drawn.');
const ENABLE_IF = condition('Enabled if', 'Takes input only while this holds of the other prefs\' values, and is drawn either way. None: always enabled.');
/** An entry is drawn with its list, so it has no `showIf` to offer. */
const ENTRY_ENABLE_IF = condition('Enabled if', 'One entry takes input only while this holds, of its own fields or of the other prefs\' values. None: always enabled.');
const control = (values: readonly string[]) => choice('Control', 'Which control draws it. Unset: the kind\'s default.', values);

const LEAF_BASE: KindAttrs = {
  name: text('Name', 'The label beside the control.'),
  description: text('Description', 'Help text for the tooltip or the line under the label.', true),
  tags: strings('Tags', 'Words a settings search also finds it by, and that gather it with others carrying them.'),
  access: text('Access letter', 'The letter that picks it in a menu, and with the menu bar\'s chord opens a top-level menu. One character; optional.'),
  hidden: flag('Hidden', 'Left out of a settings UI unless it shows hidden prefs.'),
  showIf: SHOW_IF,
  enableIf: ENABLE_IF,
  block: flag('Block', 'Full width with no label row, for a control with its own chrome.'),
  heading: flag('In heading', 'Drawn in the heading of the group holding it, in place of a row. A boolean or an enum only.'),
  icon: { kind: ICON_KIND, name: 'Icon', description: 'An icon by qualified name, from the icon sets this app registered.', default: undefined } as PrefLeaf,
  pair: { kind: 'pair', name: 'Pair', description: 'The fields that share this one\'s row in compact property UIs, and what the row reads.', default: undefined },
  short: strings('Short names', 'Shorter forms of the name, longest first.'),
  absentIsDefault: flag('Absent is default', 'Where nothing is held, it reads as its default: for a node property whose reader does the same.'),
};

const KIND_ATTRS: Record<PrefKind, KindAttrs> = {
  number: {
    min: optNumber('Min', 'Lowest value.'),
    max: optNumber('Max', 'Highest value.'),
    step: optNumber('Step', 'Increment.'),
    unit: { kind: 'unit', name: 'Unit', description: 'What it is shown and typed in, over the unit it is stored in: stored = shown × scale + offset, shown to that many places. A suffix it also takes is typed in place of its own, where shown = typed × that suffix\'s scale + its offset.', default: undefined },
    control: control(['input', 'slider']),
    endless: choice('Endless', 'Which ends run to infinity.', ['min', 'max', 'both']),
    measure: choice('Measure', 'What it measures. A length is stored in world units and shown in the unit scope of the node it belongs to.', ['length']),
  },
  boolean: { control: control(['checkbox', 'switch', 'toggle']) },
  string: { control: control(['input', 'textarea']) },
  enum: {
    options: { kind: 'enum-options', name: 'Options', description: 'Values and their labels, in order.', default: [] },
    clearable: flag('Clearable', 'Can be set back to no value.'),
    control: control(['select', 'radio', 'toggle', 'menu']),
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
  action: {
    action: symbol('Action', 'The key of a registered action to fire: its id, or id:variant. It fires this over any code the pref carries.'),
    label: text('Button', 'The button\'s text. Unset: the name.'),
    control: control(['button', 'icon']),
  },
  actions: {
    group: symbol('Group', 'The registry action group whose actions it draws, each as an action pref would be, in the order they were registered.'),
  },
  label: {},
  separator: {},
  alias: { of: { kind: 'field', name: 'Of', description: 'The pref this one shows: its control is drawn here too, over the one stored value.', default: '' } as PrefLeaf },
};

const BAR_OVERFLOW = choice('Overflow', 'Drawn as a bar: what happens to the cells its line has no room for. scroll keeps them all on it, and menu opens the ones past its end from a button there. Unset: scroll.', ['scroll', 'menu']);

const BAR_LEAD = choice('Lead', 'Drawn as a bar: what its line starts with. label puts its name there, ahead of its cells, and icon its icon. Unset: its first cell.', ['label', 'icon']);

const GROUP_ICON_ATTR = { ...LEAF_BASE.icon!, description: 'Drawn as a bar led by its icon, this starts its line; drawn as a menu, page, tab, or panel, it sits beside the name on the button a bar opens it from, and on its submenu row in a menu. An icon by qualified name, from the icon sets this app registered.' } as PrefLeaf;

/** The attributes asked after how a group is drawn, which only some forms read. */
const AS_ATTRS: Partial<Record<string, Array<[string, KindAttr]>>> = {
  bar: [['overflow', BAR_OVERFLOW], ['lead', BAR_LEAD], ['icon', GROUP_ICON_ATTR]],
  menu: [['icon', GROUP_ICON_ATTR]],
  page: [['icon', GROUP_ICON_ATTR]],
  tab: [['icon', GROUP_ICON_ATTR]],
  panel: [['icon', GROUP_ICON_ATTR]],
};

const GROUP_ATTRS: KindAttrs = {
  name: LEAF_BASE.name!,
  description: LEAF_BASE.description!,
  tags: strings('Tags', 'Tags every pref under it carries too. A settings search matching one keeps all of them.'),
  as: choice('Drawn as', 'A page of its own in the rail, a tab beside its neighbors, a bordered panel, a heading over its rows, a fragment: its rows among its neighbors\' with nothing drawn around them, a bar: its prefs on one line in their bar forms, or a menu: a button opening it as a menu on a bar, a submenu in a menu, and a panel in a form. Unset: a page at the top level, a section inside another group.', ['page', 'tab', 'panel', 'section', 'fragment', 'bar', 'menu']),
  access: LEAF_BASE.access!,
  showIf: SHOW_IF,
  enableIf: ENABLE_IF,
};
const SECTION_ATTRS: KindAttrs = {
  name: LEAF_BASE.name!,
  description: LEAF_BASE.description!,
  tags: strings('Tags', 'Tags every pref under it carries too. A settings search matching one keeps all of them.'),
  as: choice('Drawn as', 'A tab beside its neighbors, a bordered panel, a heading over its rows, a fragment: its rows among its neighbors\' with nothing drawn around them, a bar: its prefs on one line in their bar forms, or a menu: a button opening it as a menu on a bar, a submenu in a menu, and a panel in a form. Unset: a heading.', ['tab', 'panel', 'section', 'fragment', 'bar', 'menu']),
  access: LEAF_BASE.access!,
  showIf: SHOW_IF,
  enableIf: ENABLE_IF,
};

const AUTO_FLAGS: KindAttrs = {
  manual: flag('Never auto', 'Cannot be left for its owner to decide: its row gets no way to unpin it.'),
  unpinned: flag('Starts auto', 'Begins unpinned, where it would begin at its default.'),
};

/** Stored as given, falsy or not: `false` and `0` are values a leaf can read while auto. */
const AS_GIVEN = new Set(['autoValue']);

/** Written even when empty: a leaf without them is not a leaf. */
const REQUIRED = new Set(['name', 'description', 'default', 'options', 'tag', 'of', 'group']);

/** Where a node keeps the nodes and leaves inside it, which no attribute row lists. */
const SLOTS = new Set(['children', 'members', 'variants', 'item']);

/** The fields a leaf made from a type sets where it is used; the rest are its type's. */
const USE_SITE = new Set(['name', 'description', 'tags', 'default', 'access', 'hidden', 'showIf', 'enableIf', 'block', 'heading', 'icon', 'pair', 'short', 'absentIsDefault', 'readout', 'manual', 'unpinned', 'autoValue']);

function valueAttr(leaf: PrefLeaf, base: { name: string; description: string }): PrefLeaf | null {
  switch (leaf.kind) {
    case 'number': {
      const n = leaf as PrefNumber;
      return { ...base, kind: 'number', default: 0, min: n.min, max: n.max, step: n.step, unit: n.unit } as PrefLeaf;
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

/** A leaf made from a type edits its value with the control the type itself draws. */
function ownControl(leaf: PrefLeaf, base: { name: string; description: string }): PrefLeaf {
  const rest = Object.fromEntries(Object.entries(leaf).filter(([k]) => !USE_SITE.has(k)));
  return { ...rest, ...base, default: leaf.default } as PrefLeaf;
}

function defaultAttr(leaf: PrefLeaf, description = 'The value before anything is stored.'): PrefLeaf | null {
  if (leaf.kind === 'enum' && (leaf as PrefEnum).clearable) return null;
  const base = { name: 'Default', description };
  return valueAttr(leaf, base) ?? (leaf.type !== undefined ? ownControl(leaf, base) : null);
}

/** The leaf a list or a map describes each of its entries by. */
export const entryOf = (leaf: PrefLeaf): PrefLeaf | undefined => (leaf.kind === 'list' || leaf.kind === 'map' ? (leaf as PrefList).item : undefined);

/** What a list or a map says about one entry: its name, what a new one starts as, a plain kind's own attributes, and what enables it. */
function entryAttrs(item: PrefLeaf, custom: CustomKinds): KindAttrs {
  const def = defaultAttr(item, 'What a new entry starts as.');
  return {
    name: text('Name', 'What one entry is called.'),
    ...(def ? { default: def } : {}),
    ...(item.type === undefined ? kindAttrs(item.kind, custom) : {}),
    enableIf: ENTRY_ENABLE_IF,
  };
}

function autoAttrs(leaf: PrefLeaf): KindAttrs {
  if (!prefHoldsValue(leaf)) return {};
  const value = valueAttr(leaf, { name: 'Auto value', description: 'What it reads while auto, where nothing computes it. It need not be the default.' });
  return { ...AUTO_FLAGS, ...(value ? { autoValue: value } : {}) };
}

const READOUT = flag('Readout', 'Drawn showing its value but not editable.');

/** The leaf kinds a menu draws a row for, besides a label, and so can give a letter. */
const LETTERED: ReadonlySet<string> = new Set(['action', 'boolean', 'alias']);

/** The attributes a leaf shares with every other, less the ones nothing draws for it: a label is its
 *  name and its description, and a separator neither, and neither has a control to enable. An actions
 *  pref is a run of buttons, and only a leaf holding a value can be a readout of it. */
function sharedAttrs(leaf: PrefLeaf): KindAttrs {
  const { kind } = leaf;
  if (kind === 'separator') return { hidden: LEAF_BASE.hidden!, showIf: SHOW_IF };
  if (kind === 'label') return { name: LEAF_BASE.name!, description: LEAF_BASE.description!, access: LEAF_BASE.access!, hidden: LEAF_BASE.hidden!, showIf: SHOW_IF };
  if (kind === 'actions') {
    const { name, description, tags, hidden, showIf, enableIf } = LEAF_BASE;
    return { name: name!, description: description!, tags: tags!, hidden: hidden!, showIf: showIf!, enableIf: enableIf! };
  }
  const { access, ...noLetter } = LEAF_BASE;
  const base = LETTERED.has(kind) ? { ...noLetter, access: access! } : noLetter;
  return prefHoldsValue(leaf) ? { ...base, readout: READOUT } : base;
}

/** What every leaf carries and nothing draws for a separator, so no row lists it. */
const SEPARATOR_UNDRAWN: ReadonlySet<string> = new Set(['name', 'description']);
const NO_ATTRS: ReadonlySet<string> = new Set();

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
  /** A list's or a map's entry; empty for any other node. */
  entry: KindAttrs;
  /** Attributes shown but not edited: code, and anything the kind's schema does not describe. */
  readOnly: Array<[string, unknown]>;
}

/** Editable attributes, rendered with `PrefsForm` over the node itself as values. */
export function attributeSchema(
  node: SchemaNode, custom: CustomKinds = {}, actions?: readonly RegisteredAction[],
): AttributeSchema {
  if (!isPrefLeaf(node)) {
    const attrs = Object.entries(isPrefSection(node) ? SECTION_ATTRS : GROUP_ATTRS);
    const shared = attrs.flatMap((attr): Array<[string, KindAttr]> => (attr[0] === 'as' ? [attr, ...(AS_ATTRS[node.as ?? ''] ?? [])] : [attr]));
    return { shared: Object.fromEntries(shared), own: {}, auto: {}, entry: {}, readOnly: [] };
  }
  const typed = node.type !== undefined;
  const def = defaultAttr(node);
  const item = entryOf(node);
  const shared: KindAttrs = sharedAttrs(node);
  const own: KindAttrs = { ...(def ? { default: def } : {}), ...(typed ? {} : kindAttrs(node.kind, custom)) };
  if (own.action && node.kind === 'action' && actions && actions.length > 0) own.action = actionChoice(own.action, actions, (node as { action?: string }).action);
  const auto = autoAttrs(node);
  const entry = item && !typed ? entryAttrs(item, custom) : {};
  const fields = node as unknown as Record<string, unknown>;
  for (const attrs of [shared, own, auto]) for (const k of Object.keys(attrs)) if (containsCode(fields[k])) delete attrs[k];
  for (const k of Object.keys(entry)) if (containsCode((item as unknown as Record<string, unknown>)[k])) delete entry[k];
  // What a type holds beyond the fields its use sets is the type's to show, where it is declared.
  const undrawn = node.kind === 'separator' ? SEPARATOR_UNDRAWN : NO_ATTRS;
  // Every leaf carries a `default`, which says nothing of one that holds no value.
  const listed = (k: string): boolean => k !== 'kind' && !SLOTS.has(k) && !undrawn.has(k) && !(k === 'default' && !prefHoldsValue(node));
  const readOnly = typed ? [] : Object.entries(fields).filter(([k]) => listed(k) && !(k in shared) && !(k in own) && !(k in auto));
  if (node.kind === 'action') readOnly.push(...registeredFacts(actions?.find((a) => a.key === (node as { action?: string }).action)));
  return { shared, own, auto, entry, readOnly };
}

/** The value to store for an edited attribute: an optional one left empty is removed rather than written. */
export function normalizeAttr(key: string, value: unknown, attr?: KindAttr): unknown {
  if (REQUIRED.has(key) || AS_GIVEN.has(key) || attr?.required) return value;
  if (value === undefined || value === '' || value === false) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return value;
}

export function blankLeaf(kind: string, custom: CustomKinds = {}): PrefLeaf {
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
    case 'actions': return { ...base, default: undefined, group: '' } as PrefLeaf;
    case 'label': return { kind, name: 'Label', description: '', default: undefined } as PrefLeaf;
    // A rule has no words: nothing draws a name or a description for one.
    case 'separator': return { kind, name: '', description: '', default: undefined } as PrefLeaf;
    // Named for what it shows until it is given a name of its own.
    case 'alias': return { kind, name: '', description: '', default: undefined, of: '' } as PrefLeaf;
    default: {
      const attrs = kindAttrs(kind, custom);
      const required = Object.entries(attrs).filter(([, attr]) => attr.required).map(([k, attr]) => [k, attr.default]);
      return { ...base, default: attrs.default?.default, ...Object.fromEntries(required) } as PrefLeaf;
    }
  }
}

export function blankGroup(): PrefGroup {
  return { name: 'New group', description: '', children: {} };
}

export function blankSection(): PrefSection {
  return { name: 'New section', description: '', members: {} };
}

const SHARED = ['name', 'description', 'tags', 'hidden', 'showIf', 'enableIf', 'block', 'heading', 'icon', 'pair', 'short', 'absentIsDefault', 'readout', 'manual', 'unpinned'];

const PRIMITIVES = new Set(['string', 'number', 'boolean']);

function carriesDefault(v: unknown, blank: Record<string, unknown>): boolean {
  if (!PRIMITIVES.has(typeof v) || typeof v !== typeof blank.default) return false;
  const options = blank.options as Array<{ value: unknown }> | undefined;
  return options === undefined || options.some((o) => o.value === v);
}

/** Whether `attr`, a kind's attribute, can hold `v`: a choice holds only what it offers. Any other attribute, and a shared one (`undefined`), holds what it is given. */
function offers(attr: PrefLeaf | undefined, v: unknown): boolean {
  return attr?.kind !== 'enum' || (attr as PrefEnum).options.some((o) => o.value === v);
}

/** A new leaf of what a kind picker's `choice` names: a blank one of a kind, or a type as it was declared. */
export function leafOf(choice: string, types: PrefTypes = NO_TYPES, custom: CustomKinds = {}): PrefLeaf {
  const type = findType(types, typeNamed(choice));
  return type ? { ...type } : blankLeaf(choice, custom);
}

/**
 * `leaf` as what `choice` names. Base fields carry over, as does a default of the same type onto a kind; the rest
 * is named in `dropped`. A type's own default stands, being a value of the type's shape.
 */
export function convertLeaf(leaf: PrefLeaf, choice: string, custom: CustomKinds = {}, types: PrefTypes = NO_TYPES): { leaf: PrefLeaf; dropped: string[] } {
  const typed = typeNamed(choice) !== undefined;
  const blank = leafOf(choice, types, custom) as unknown as Record<string, unknown>;
  const attrs = kindAttrs(choice, custom);
  const keep = new Set([...SHARED, ...(typed ? [] : Object.keys(attrs))]);
  const next: Record<string, unknown> = { ...blank };
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(leaf)) {
    if (k === 'kind' || k === 'type' || v === undefined) continue;
    if (k === 'default') {
      if (!typed && carriesDefault(v, blank)) next.default = v;
      else dropped.push('default');
      continue;
    }
    if (SLOTS.has(k)) {
      // What is inside a leaf goes with it to any kind that keeps it the same way.
      if (!typed && k in blank) next[k] = v;
      else dropped.push(k);
      continue;
    }
    if (keep.has(k) && (typed || offers(attrs[k], v))) next[k] = v;
    else dropped.push(k);
  }
  return { leaf: next as unknown as PrefLeaf, dropped };
}

/** Change what the leaf at `path` is, by {@link convertLeaf}. `root` itself where no leaf is there: one of several changed together may have gone with its parent's children. */
export function changeKind<R extends SchemaRoot>(root: R, path: string, choice: string, custom: CustomKinds = {}, types: PrefTypes = NO_TYPES): { root: R; dropped: string[] } {
  const node = nodeAt(root, path);
  if (!node || !isPrefLeaf(node)) return { root, dropped: [] };
  const { leaf, dropped } = convertLeaf(node, choice, custom, types);
  return { root: replaceNode(root, path, () => leaf as SchemaNode), dropped };
}
