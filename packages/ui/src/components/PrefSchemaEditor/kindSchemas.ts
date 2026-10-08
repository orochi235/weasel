import { solid } from '@weasel-js/core';
import type { ToolPrefEnum, ToolPrefGroup, ToolPrefKind, ToolPrefLeaf, ToolPrefNumber } from '@weasel-js/core';
import { isPrefLeaf } from '../Prefs/schema';
import { replaceNode, nodeAt, type SchemaNode } from './schemaEdit';
import { containsCode } from './schemaExport';

export type KindAttrs = Record<string, ToolPrefLeaf>;
export type CustomKinds = Record<string, KindAttrs>;

export const BUILTIN_KINDS: readonly ToolPrefKind[] = ['number', 'boolean', 'string', 'enum', 'color', 'paint', 'object'];

const text = (name: string, description: string, multiline = false): ToolPrefLeaf =>
  ({ kind: 'string', name, description, default: '', ...(multiline ? { control: 'textarea' } : {}) }) as ToolPrefLeaf;
const flag = (name: string, description: string): ToolPrefLeaf => ({ kind: 'boolean', name, description, default: false });
const optNumber = (name: string, description: string): ToolPrefLeaf => ({ kind: 'optional-number', name, description, default: undefined });
const choice = (name: string, description: string, values: readonly string[]): ToolPrefLeaf =>
  ({ kind: 'enum', name, description, default: undefined, clearable: true, options: values.map((v) => ({ value: v, label: v })) }) as ToolPrefLeaf;
const control = (values: readonly string[]) => choice('Control', 'Which control draws it. Unset: the kind\'s default.', values);

const LEAF_BASE: KindAttrs = {
  name: text('Name', 'The label beside the control.'),
  description: text('Description', 'Help text for the tooltip or the line under the label.', true),
  hidden: flag('Hidden', 'Left out of a settings UI unless it shows hidden prefs.'),
  block: flag('Block', 'Full width with no label row, for a control with its own chrome.'),
  icon: text('Icon', 'Glyph name in the host\'s icon set.'),
  pair: text('Pair', 'Leaves sharing this label share one row in compact property UIs.'),
  short: { kind: 'string-list', name: 'Short names', description: 'Shorter forms of the name, longest first.', default: [] },
};

const KIND_ATTRS: Record<ToolPrefKind, KindAttrs> = {
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
};

const GROUP_ATTRS: ToolPrefGroup = { name: 'Group', children: { name: LEAF_BASE.name!, description: LEAF_BASE.description! } };

/** Written even when empty: a leaf without them is not a leaf. */
const REQUIRED = new Set(['name', 'description', 'default', 'options']);

function defaultAttr(leaf: ToolPrefLeaf): ToolPrefLeaf | null {
  const base = { name: 'Default', description: 'The value before anything is stored.' };
  switch (leaf.kind) {
    case 'number': {
      const n = leaf as ToolPrefNumber;
      return { ...base, kind: 'number', default: 0, min: n.min, max: n.max, step: n.step } as ToolPrefLeaf;
    }
    case 'boolean': return { ...base, kind: 'boolean', default: false };
    case 'string': return { ...base, kind: 'string', default: '' } as ToolPrefLeaf;
    case 'enum': return { ...base, kind: 'enum', default: undefined, clearable: true, options: (leaf as ToolPrefEnum).options } as ToolPrefLeaf;
    case 'color': return { ...base, kind: 'color', default: '#000000' } as ToolPrefLeaf;
    default: return null;
  }
}

function kindAttrs(kind: string, custom: CustomKinds): KindAttrs {
  if (Object.hasOwn(KIND_ATTRS, kind)) return KIND_ATTRS[kind as ToolPrefKind];
  return Object.hasOwn(custom, kind) ? custom[kind]! : {};
}

export interface AttributeSchema {
  /** Editable attributes, rendered with `PrefsForm` over the node itself as values. */
  schema: ToolPrefGroup;
  /** Attributes shown but not edited: code, and anything the kind's schema does not describe. */
  readOnly: Array<[string, unknown]>;
}

export function attributeSchema(node: SchemaNode, custom: CustomKinds = {}): AttributeSchema {
  if (!isPrefLeaf(node)) return { schema: GROUP_ATTRS, readOnly: [] };
  const own = kindAttrs(node.kind, custom);
  const def = defaultAttr(node);
  const children: KindAttrs = { ...LEAF_BASE, ...(def ? { default: def } : {}), ...own };
  const fields = node as unknown as Record<string, unknown>;
  for (const k of Object.keys(children)) if (containsCode(fields[k])) delete children[k];
  const readOnly = Object.entries(fields).filter(([k]) => k !== 'kind' && k !== 'children' && !(k in children));
  return { schema: { name: 'Attributes', children }, readOnly };
}

/** The value to store for an edited attribute: an optional one left empty is removed rather than written. */
export function normalizeAttr(key: string, value: unknown): unknown {
  if (REQUIRED.has(key)) return value;
  if (value === undefined || value === '' || value === false) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return value;
}

export function blankLeaf(kind: string): ToolPrefLeaf {
  const base = { kind, name: 'New pref', description: '' };
  switch (kind) {
    case 'number': return { ...base, default: 0 } as ToolPrefLeaf;
    case 'boolean': return { ...base, default: false } as ToolPrefLeaf;
    case 'string': return { ...base, default: '' } as ToolPrefLeaf;
    case 'enum': return { ...base, default: 'a', options: [{ value: 'a', label: 'A' }] } as ToolPrefLeaf;
    case 'color': return { ...base, default: '#000000' } as ToolPrefLeaf;
    case 'paint': return { ...base, default: solid('#000000') } as ToolPrefLeaf;
    case 'object': return { ...base, default: {}, children: {} } as ToolPrefLeaf;
    default: return { ...base, default: undefined } as ToolPrefLeaf;
  }
}

export function blankGroup(): ToolPrefGroup {
  return { name: 'New group', description: '', children: {} };
}

const SHARED = ['name', 'description', 'hidden', 'block', 'icon', 'pair', 'short'];

const PRIMITIVES = new Set(['string', 'number', 'boolean']);

function carriesDefault(v: unknown, blank: Record<string, unknown>): boolean {
  if (!PRIMITIVES.has(typeof v) || typeof v !== typeof blank.default) return false;
  const options = blank.options as Array<{ value: unknown }> | undefined;
  return options === undefined || options.some((o) => o.value === v);
}

/** Change a leaf's kind. Base fields carry over, as does a default of the same type; the rest is reported. */
export function changeKind(root: ToolPrefGroup, path: string, kind: string, custom: CustomKinds = {}): { root: ToolPrefGroup; dropped: string[] } {
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
