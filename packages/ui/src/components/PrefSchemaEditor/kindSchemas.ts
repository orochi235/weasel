import { solid } from '@weasel-js/core';
import {
  isPrefLeaf,
  type PrefEnum,
  type PrefField,
  type PrefGroup,
  type PrefKind,
  type PrefLeaf,
  type PrefNumber,
  type PrefSection,
} from '@weasel-js/prefs';
import { replaceNode, nodeAt, type SchemaNode, type SchemaRoot } from './schemaEdit';
import { containsCode } from './schemaExport';

export type KindAttrs = Record<string, PrefLeaf>;
export type CustomKinds = Record<string, KindAttrs>;

export const BUILTIN_KINDS: readonly PrefKind[] = ['number', 'boolean', 'string', 'enum', 'color', 'paint', 'object', 'field'];

const text = (name: string, description: string, multiline = false): PrefLeaf =>
  ({ kind: 'string', name, description, default: '', ...(multiline ? { control: 'textarea' } : {}) }) as PrefLeaf;
const flag = (name: string, description: string): PrefLeaf => ({ kind: 'boolean', name, description, default: false });
const optNumber = (name: string, description: string): PrefLeaf => ({ kind: 'optional-number', name, description, default: undefined });
const choice = (name: string, description: string, values: readonly string[]): PrefLeaf =>
  ({ kind: 'enum', name, description, default: undefined, clearable: true, options: values.map((v) => ({ value: v, label: v })) }) as PrefLeaf;
const control = (values: readonly string[]) => choice('Control', 'Which control draws it. Unset: the kind\'s default.', values);

const LEAF_BASE: KindAttrs = {
  name: text('Name', 'The label beside the control.'),
  description: text('Description', 'Help text for the tooltip or the line under the label.', true),
  hidden: flag('Hidden', 'Left out of a settings UI unless it shows hidden prefs.'),
  block: flag('Block', 'Full width with no label row, for a control with its own chrome.'),
  icon: text('Icon', 'Glyph name in the host\'s icon set.'),
  pair: { kind: 'pair', name: 'Pair', description: 'The fields that share this one\'s row in compact property UIs, and what the row reads.', default: undefined },
  short: { kind: 'string-list', name: 'Short names', description: 'Shorter forms of the name, longest first.', default: [] },
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
    kinds: { kind: 'string-list', name: 'Kinds', description: 'Only fields of these kinds may be named. Empty: any.', default: [] },
  },
};

const GROUP_ATTRS: KindAttrs = { name: LEAF_BASE.name!, description: LEAF_BASE.description! };

/** Written even when empty: a leaf without them is not a leaf. */
const REQUIRED = new Set(['name', 'description', 'default', 'options']);

function defaultAttr(leaf: PrefLeaf): PrefLeaf | null {
  const base = { name: 'Default', description: 'The value before anything is stored.' };
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
    default: return null;
  }
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
  /** Attributes shown but not edited: code, and anything the kind's schema does not describe. */
  readOnly: Array<[string, unknown]>;
}

/** Editable attributes, rendered with `PrefsForm` over the node itself as values. */
export function attributeSchema(node: SchemaNode, custom: CustomKinds = {}): AttributeSchema {
  if (!isPrefLeaf(node)) return { shared: { ...GROUP_ATTRS }, own: {}, readOnly: [] };
  const def = defaultAttr(node);
  const shared: KindAttrs = { ...LEAF_BASE };
  const own: KindAttrs = { ...(def ? { default: def } : {}), ...kindAttrs(node.kind, custom) };
  const fields = node as unknown as Record<string, unknown>;
  for (const attrs of [shared, own]) for (const k of Object.keys(attrs)) if (containsCode(fields[k])) delete attrs[k];
  const readOnly = Object.entries(fields).filter(([k]) => k !== 'kind' && k !== 'children' && !(k in shared) && !(k in own));
  return { shared, own, readOnly };
}

/** The value to store for an edited attribute: an optional one left empty is removed rather than written. */
export function normalizeAttr(key: string, value: unknown): unknown {
  if (REQUIRED.has(key)) return value;
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
    default: return { ...base, default: undefined } as PrefLeaf;
  }
}

export function blankGroup(): PrefGroup {
  return { name: 'New group', description: '', children: {} };
}

export function blankSection(): PrefSection {
  return { name: 'New section', description: '', members: {} };
}

const SHARED = ['name', 'description', 'hidden', 'block', 'icon', 'pair', 'short'];

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
    if (k === 'children' && 'children' in blank) { next.children = v; continue; }
    if (keep.has(k)) next[k] = v;
    else dropped.push(k);
  }
  return { root: replaceNode(root, path, () => next as unknown as SchemaNode), dropped };
}
