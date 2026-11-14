// The attributes the schema editor offers, per kind, as the leaves that edit them.

import type { PrefKind, PrefLeaf } from '../index';

/** One attribute of a kind, as the leaf that edits it. `required` keeps it on a leaf when it is emptied, and seeds
 *  it, from this leaf's `default`, in a new leaf of the kind. */
export type KindAttr = PrefLeaf & { required?: boolean };
/** A kind's attributes, by attribute name. */
export type KindAttrs = Record<string, KindAttr>;
/** A custom kind's own attributes, by kind. One named `default` gives the kind a Default row, and a new leaf its default. */
export type CustomKinds = Record<string, KindAttrs>;

export const text = (name: string, description: string, multiline = false): PrefLeaf =>
  ({ kind: 'string', name, description, default: '', ...(multiline ? { control: 'textarea' } : {}) }) as PrefLeaf;
export const flag = (name: string, description: string): PrefLeaf => ({ kind: 'boolean', name, description, default: false });
const optNumber = (name: string, description: string): PrefLeaf => ({ kind: 'optional-number', name, description, default: undefined });
export const choice = (name: string, description: string, values: readonly string[]): PrefLeaf =>
  ({ kind: 'enum', name, description, default: undefined, clearable: true, options: values.map((v) => ({ value: v, label: v })) }) as PrefLeaf;
export const strings = (name: string, description: string): PrefLeaf =>
  ({ kind: 'list', name, description, default: [], control: 'tokens', item: { kind: 'string', name: '', description: '', default: '' } }) as PrefLeaf;
/** Text the code spells, which the editor sets in monospace. */
const symbol = (name: string, description: string): PrefLeaf => ({ kind: 'symbol', name, description, default: '' });
/** The attribute kind an `icon` is edited as: a picker over every registered icon. */
export const ICON_KIND = 'icon';
/** The attribute kind a `showIf` or an `enableIf` is edited as: a `PrefCondition` over the schema's other leaves. */
export const CONDITION_KIND = 'condition';
const condition = (name: string, description: string): PrefLeaf => ({ kind: CONDITION_KIND, name, description, default: undefined });
export const SHOW_IF = condition('Shown if', 'Shown only while this condition on other prefs holds. None: always shown.');
export const ENABLE_IF = condition('Enabled if', 'Editable only while this condition on other prefs holds, and shown grayed out otherwise. None: always editable.');
/** An entry is drawn with its list, so it has no `showIf` to offer. */
export const ENTRY_ENABLE_IF = condition('Enabled if', 'An entry is editable only while this condition holds, on its own fields or on other prefs. None: always editable.');
const control = (values: readonly string[]) => choice('Control', 'Which control edits it. Unset: the usual control for its kind.', values);

export const LEAF_BASE: KindAttrs = {
  name: text('Name', 'The label shown beside its control.'),
  description: text('Description', 'Help shown in its tooltip, or under its label where there is room.', true),
  tags: strings('Tags', 'Extra words a settings search finds it by. A search for a tag finds every pref carrying it.'),
  access: text('Access letter', 'The letter that picks it in an open menu. For a top-level menu, the letter that opens it with the menu bar\'s shortcut. One character; optional.'),
  hidden: flag('Hidden', 'Not shown in the app\'s settings, unless they are set to show hidden prefs.'),
  showIf: SHOW_IF,
  enableIf: ENABLE_IF,
  disabledReason: text('Why disabled', 'Read in its tooltip while it is disabled: what has to change to enable it.'),
  block: flag('Block', 'Takes the full width with no label, for a control that brings its own header.'),
  heading: flag('In heading', 'Shown in its group\'s heading instead of as a row. A boolean or an enum only.'),
  icon: { kind: ICON_KIND, name: 'Icon', description: 'An icon from the app\'s registered icon sets, by its full name.', default: undefined } as PrefLeaf,
  pair: { kind: 'pair', name: 'Pair', description: 'Other fields shown on this one\'s row in property panels, and the label that row shows.', default: undefined },
  short: strings('Short names', 'Shorter versions of the name, longest first, for where the full name does not fit.'),
  absentIsDefault: flag('Absent is default', 'With nothing stored, show its default, because the code reading it treats a missing value as the default. For node properties, where a missing value otherwise means the node has no such property.'),
};

export const KIND_ATTRS: Record<PrefKind, KindAttrs> = {
  number: {
    min: optNumber('Min', 'The lowest value it takes.'),
    max: optNumber('Max', 'The highest value it takes.'),
    step: optNumber('Step', 'How much one nudge changes it.'),
    unit: { kind: 'unit', name: 'Unit', description: 'The unit it is shown and typed in, where that differs from the unit it is stored in: stored = shown × scale + offset, shown to the given decimal places. Each extra suffix lets it be typed in that unit instead, where shown = typed × that suffix\'s scale + its offset.', default: undefined },
    stops: { kind: 'list', name: 'Stops', description: 'Values its slider catches on, in the unit it is stored in.', default: [], item: { kind: 'number', name: 'Stop', description: '', default: 0 } } as PrefLeaf,
    control: control(['input', 'slider']),
    scale: choice('Scale', 'How its slider spaces values along the track: log gives even ratios even distances, for a range above zero; sqrt spreads the low end less. Typed values, step and stops are unchanged.', ['linear', 'log', 'sqrt']),
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
    grade: choice('Grade', 'How serious pressing it is. danger draws it red, for one that destroys something.', ['info', 'success', 'warn', 'danger']),
    shortcut: text('Shortcut', 'The keys that fire it, as its tooltip shows them. Shown only: the app binds them. Unset: the registered action\'s.'),
    activeIf: condition('Pressed if', 'Drawn pressed while this condition on other prefs holds. None: as the registered action says, or never.'),
  },
  actions: {
    group: symbol('Group', 'The registered action group whose actions it shows, each as its own button, in the order they were registered.'),
  },
  label: {},
  separator: {},
  alias: { of: { kind: 'field', name: 'Of', description: 'The pref this one mirrors: the same control is shown here too, editing the same stored value.', default: '' } as PrefLeaf },
};
