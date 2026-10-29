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
import { autoRowsOf, withAutoRow, type LeafAuto } from './autoRows';

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
  ({ kind: 'list', name, description, default: [], control: 'tokens', item: { kind: 'string', name: '', description: '', default: '' } }) as PrefLeaf;
/** Text the code spells, which the editor sets in monospace. */
const symbol = (name: string, description: string): PrefLeaf => ({ kind: 'symbol', name, description, default: '' });
/** The attribute kind an `icon` is edited as: a picker over every registered icon. */
export const ICON_KIND = 'icon';
/** The attribute kind a `showIf` or an `enableIf` is edited as: a `PrefCondition` over the schema's other leaves. */
export const CONDITION_KIND = 'condition';
const condition = (name: string, description: string): PrefLeaf => ({ kind: CONDITION_KIND, name, description, default: undefined });
const SHOW_IF = condition('Shown if', 'Shown only while this condition on other prefs holds. None: always shown.');
const ENABLE_IF = condition('Enabled if', 'Editable only while this condition on other prefs holds, and shown grayed out otherwise. None: always editable.');
/** An entry is drawn with its list, so it has no `showIf` to offer. */
const ENTRY_ENABLE_IF = condition('Enabled if', 'An entry is editable only while this condition holds, on its own fields or on other prefs. None: always editable.');
const control = (values: readonly string[]) => choice('Control', 'Which control edits it. Unset: the usual control for its kind.', values);

const LEAF_BASE: KindAttrs = {
  name: text('Name', 'The label shown beside its control.'),
  description: text('Description', 'Help shown in its tooltip, or under its label where there is room.', true),
  tags: strings('Tags', 'Extra words a settings search finds it by. A search for a tag finds every pref carrying it.'),
  access: text('Access letter', 'The letter that picks it in an open menu. For a top-level menu, the letter that opens it with the menu bar\'s shortcut. One character; optional.'),
  hidden: flag('Hidden', 'Not shown in the app\'s settings, unless they are set to show hidden prefs.'),
  showIf: SHOW_IF,
  enableIf: ENABLE_IF,
  block: flag('Block', 'Takes the full width with no label, for a control that brings its own header.'),
  heading: flag('In heading', 'Shown in its group\'s heading instead of as a row. A boolean or an enum only.'),
  icon: { kind: ICON_KIND, name: 'Icon', description: 'An icon from the app\'s registered icon sets, by its full name.', default: undefined } as PrefLeaf,
  pair: { kind: 'pair', name: 'Pair', description: 'Other fields shown on this one\'s row in property panels, and the label that row shows.', default: undefined },
  short: strings('Short names', 'Shorter versions of the name, longest first, for where the full name does not fit.'),
  absentIsDefault: flag('Absent is default', 'With nothing stored, show its default, because the code reading it treats a missing value as the default. For node properties, where a missing value otherwise means the node has no such property.'),
};

const KIND_ATTRS: Record<PrefKind, KindAttrs> = {
  number: {
    min: optNumber('Min', 'The lowest value it takes.'),
    max: optNumber('Max', 'The highest value it takes.'),
    step: optNumber('Step', 'How much one nudge changes it.'),
    unit: { kind: 'unit', name: 'Unit', description: 'The unit it is shown and typed in, where that differs from the unit it is stored in: stored = shown × scale + offset, shown to the given decimal places. Each extra suffix lets it be typed in that unit instead, where shown = typed × that suffix\'s scale + its offset.', default: undefined },
    control: control(['input', 'slider']),
    endless: choice('Endless', 'Which ends have no limit.', ['min', 'max', 'both']),
    measure: choice('Measure', 'What kind of quantity it is. A length is stored in world units and shown in the units of the node it belongs to.', ['length']),
  },
  boolean: { control: control(['checkbox', 'switch', 'toggle']) },
  string: { control: control(['input', 'textarea']) },
  enum: {
    options: { kind: 'enum-options', name: 'Options', description: 'The values it can take, each with the label shown for it, in order.', default: [] },
    clearable: flag('Clearable', 'Can be cleared back to no value.'),
    control: control(['select', 'radio', 'toggle', 'menu']),
  },
  color: { alpha: flag('Alpha', 'Lets the color be partly transparent.') },
  paint: { alpha: flag('Alpha', 'Lets the color be partly transparent.') },
  object: {},
  field: {
    kinds: strings('Kinds', 'Only fields of these kinds can be picked. Empty: any field.'),
  },
  list: {
    minItems: optNumber('Fewest', 'Entries cannot be removed once there are this few.'),
    maxItems: optNumber('Most', 'Entries cannot be added once there are this many.'),
    control: control(['list', 'tokens']),
  },
  map: {},
  union: { tag: symbol('Tag', 'The field of its value that says which variant it is.') },
  action: {
    action: symbol('Action', 'The registered action its button fires, as id or id:variant. It fires this instead of any code the pref carries.'),
    label: text('Button', 'The text on its button. Unset: its name.'),
    control: control(['button', 'icon']),
  },
  actions: {
    group: symbol('Group', 'The registered action group whose actions it shows, each as its own button, in the order they were registered.'),
  },
  label: {},
  separator: {},
  alias: { of: { kind: 'field', name: 'Of', description: 'The pref this one mirrors: the same control is shown here too, editing the same stored value.', default: '' } as PrefLeaf },
};

const BAR_OVERFLOW = choice('Overflow', 'For a bar: what happens to items that do not fit on its line. scroll keeps them all on the line, and menu moves the extras into a menu at its end. Unset: scroll.', ['scroll', 'menu']);

const BAR_LEAD = choice('Lead', 'For a bar: what comes first on its line. label shows its name there, and icon its icon. Unset: its first item.', ['label', 'icon']);

const GROUP_ICON_ATTR = { ...LEAF_BASE.icon!, description: 'Its icon: first on its line in a bar whose Lead is icon, and beside its name on the button a bar opens it from and on its row in a menu. An icon from the app\'s registered icon sets, by its full name.' } as PrefLeaf;

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
  tags: strings('Tags', 'Tags every pref inside it carries too. A search for one finds all of them.'),
  as: choice('Drawn as', 'How it is shown. page: its own page in the sidebar. tab: a tab beside its neighbors. panel: a bordered box. section: a heading over its rows. fragment: its rows among its neighbors\', with nothing around them. bar: its prefs on one line, in their compact forms. menu: a menu opened from a button on a bar, a submenu in a menu, and a panel in a form. Unset: a page at the top level, a section inside another group.', ['page', 'tab', 'panel', 'section', 'fragment', 'bar', 'menu']),
  access: LEAF_BASE.access!,
  showIf: SHOW_IF,
  enableIf: ENABLE_IF,
};
const SECTION_ATTRS: KindAttrs = {
  name: LEAF_BASE.name!,
  description: LEAF_BASE.description!,
  tags: strings('Tags', 'Tags every pref inside it carries too. A search for one finds all of them.'),
  as: choice('Drawn as', 'How it is shown. tab: a tab beside its neighbors. panel: a bordered box. section: a heading over its rows. fragment: its rows among its neighbors\', with nothing around them. bar: its prefs on one line, in their compact forms. menu: a menu opened from a button on a bar, a submenu in a menu, and a panel in a form. Unset: a section.', ['tab', 'panel', 'section', 'fragment', 'bar', 'menu']),
  access: LEAF_BASE.access!,
  showIf: SHOW_IF,
  enableIf: ENABLE_IF,
};

const AUTO_FLAGS: KindAttrs = {
  never: flag('Never auto', 'The app can never choose its value: its row has no way to hand it to the app.'),
  on: flag('Starts auto', 'Starts with the app choosing its value, instead of at its default.'),
};

/** Written even when empty: a leaf without them is not a leaf. */
const REQUIRED = new Set(['name', 'description', 'default', 'options', 'tag', 'of', 'group']);

/** Where a node keeps the nodes and leaves inside it, which no attribute row lists. */
const SLOTS = new Set(['children', 'members', 'variants', 'item']);

/** The fields a leaf made from a type sets where it is used; the rest are its type's. */
const USE_SITE = new Set(['name', 'description', 'tags', 'default', 'access', 'hidden', 'showIf', 'enableIf', 'block', 'heading', 'icon', 'pair', 'short', 'absentIsDefault', 'readout', 'auto']);

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
      return { ...base, kind: 'list', default: [], item: l.item, minItems: l.minItems, maxItems: l.maxItems, control: l.control } as PrefLeaf;
    }
    default: return null;
  }
}

/** A leaf made from a type edits its value with the control the type itself draws. */
function ownControl(leaf: PrefLeaf, base: { name: string; description: string }): PrefLeaf {
  const rest = Object.fromEntries(Object.entries(leaf).filter(([k]) => !USE_SITE.has(k)));
  return { ...rest, ...base, default: leaf.default } as PrefLeaf;
}

function defaultAttr(leaf: PrefLeaf, description = 'Its value until one is stored.'): PrefLeaf | null {
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
  const value = valueAttr(leaf, { name: 'Auto value', description: 'What it reads while the app is choosing, if the app computes nothing for it. Off: no value at all. It need not match the default.' });
  return { ...AUTO_FLAGS, ...(value ? { value } : {}) };
}

const READOUT = flag('Readout', 'Shows its value but cannot be edited.');

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
  for (const attrs of [shared, own]) for (const k of Object.keys(attrs)) if (containsCode(fields[k])) delete attrs[k];
  const rows = autoRowsOf(node) as Record<string, unknown>;
  for (const k of Object.keys(auto)) if (containsCode(rows[k])) delete auto[k];
  for (const k of Object.keys(entry)) if (containsCode((item as unknown as Record<string, unknown>)[k])) delete entry[k];
  // What a type holds beyond the fields its use sets is the type's to show, where it is declared.
  const undrawn = node.kind === 'separator' ? SEPARATOR_UNDRAWN : NO_ATTRS;
  // Every leaf carries a `default`, which says nothing of one that holds no value.
  const listed = (k: string): boolean => k !== 'kind' && !SLOTS.has(k) && !undrawn.has(k) && !(k === 'default' && !prefHoldsValue(node));
  const readOnly = typed ? [] : Object.entries(fields).filter(([k]) => listed(k) && !(k in shared) && !(k in own) && !(k === 'auto' && Object.keys(auto).length > 0));
  if (node.kind === 'action') readOnly.push(...registeredFacts(actions?.find((a) => a.key === (node as { action?: string }).action)));
  return { shared, own, auto, entry, readOnly };
}

/** The value to store for an edited attribute: an optional one left empty is removed rather than written. */
export function normalizeAttr(key: string, value: unknown, attr?: KindAttr): unknown {
  if (REQUIRED.has(key) || attr?.required) return value;
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

const SHARED = ['name', 'description', 'tags', 'hidden', 'showIf', 'enableIf', 'block', 'heading', 'icon', 'pair', 'short', 'absentIsDefault', 'readout'];

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
    if (k === 'auto') {
      // What it reads while auto is a value of the old kind.
      const kept = withAutoRow(v as LeafAuto, 'value', undefined);
      if (kept !== undefined) next.auto = kept;
      if (autoRowsOf(leaf).value !== undefined) dropped.push('auto.value');
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
