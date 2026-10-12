// The preferences schema's typed leaves. `groups.ts` holds the branch nodes
// that arrange them: tools declare their options as a `PrefGroup`, and apps
// compose those into one registry, which `PrefsForm` renders and `openPrefs`
// stores.

import type { PrefAction } from './action';
import type { PrefAlias } from './alias';
import type { PrefCondition } from './condition';
import type { PrefSection } from './groups';
import type { PrefLabel, PrefSeparator } from './label';
import type { PrefList } from './list';
import type { PrefMap } from './map';
import type { PrefUnion } from './union';
import type { PrefNumberUnit } from './unit';
import type { Display, InfinityText } from '@weasel-js/quantity';

/** The value types a built-in pref leaf can hold. */
export type PrefKind =
  | 'number' | 'boolean' | 'string' | 'enum' | 'color' | 'paint' | 'object' | 'list' | 'map' | 'union' | 'field' | 'action' | 'alias' | 'label' | 'separator';

/**
 * Leaves that share one row in a compact property UI (weasel-ui
 * `SelectionPanel`, labkit's `ControlPanel`), declared on the first of them.
 * Purely presentational.
 */
export interface PrefPair {
  /** The other leaves on the row, by the full path their values are read and
   *  written at (`'pose.y'`, `'camera.type'`), in order. Each must follow the
   *  one before it among its siblings. */
  with: string | readonly string[];
  /** What the row reads. Default: the declaring leaf's `name`. */
  label?: string;
}

/** The fields every leaf pref shares, keyed by its `kind` and typed by its stored value. */
export interface PrefBase<K extends string, Value> {
  kind: K;
  /** Human-readable label. */
  name: string;
  /** Longer help text — shown in tooltips / a settings pane. */
  description: string;
  /** Fallback when nothing is persisted. */
  default: Value;
  /** Hide from a host app's settings UI by default. */
  hidden?: boolean;
  /** Drawn only while this holds. Presentational: the value stays stored
   *  and readable while the leaf is not drawn. */
  showIf?: PrefCondition;
  /** Drawn, and disabled while this does not hold. */
  enableIf?: PrefCondition;
  /** Nothing held where this leaf's value is read means `default`, because
   *  whoever reads the value takes it that way (`pose.rotation ?? 0`). A
   *  surface over sparse settings reads every leaf so already. One over a
   *  scene node, where a missing key otherwise means the node has no such
   *  property, shows the default only for a leaf that says this, and still
   *  writes nothing until an edit. */
  absentIsDefault?: boolean;
  /** Render full-width with no label row in schema-driven settings UIs
   *  (weasel-ui `PrefsForm` honors this for leaves whose control brings
   *  its own chrome). */
  block?: boolean;
  /** Glyph naming this leaf in a host UI's icon set (weasel-ui resolves it
   *  against `ICON_PATHS`). A plain string because this package ships no
   *  icon set and cannot depend on one. Read where a leaf's `name` has nowhere to go — a
   *  `pair`ed row is labeled by the pair, so its fields have only the glyph
   *  to tell them apart. */
  icon?: string;
  /** Puts this leaf and the ones it names on one row. */
  pair?: PrefPair;
  /** Shorter forms of `name`, longest first. A surface short of room for
   *  `name` — a strip of controls on one line, a segment in a `pair`ed row —
   *  shows the longest of them that fits. `name` stays the accessible name, so
   *  these abbreviate without costing anything. */
  short?: readonly string[];
  /** Never auto. A surface that lets a leaf be left for its owner to decide
   *  (weasel-ui `PrefsForm`'s `onAutoChange`, labkit's `ControlPanel`) gives
   *  this one no way to. */
  manual?: boolean;
  /** Starts auto, where it would start pinned at `default`. */
  unpinned?: boolean;
  /** What the leaf reads while it is auto, where its owner computes nothing
   *  for it. Unset, an auto leaf has no value. */
  autoValue?: Value;
  /** The name of the type this leaf was made from, set by `prefType`. A
   *  schema editor shows such a leaf as one closed thing and prints the name
   *  in place of its literal. */
  type?: string;
}

/** How a schema-driven UI should present a number pref. */
export type PrefNumberControl = 'input' | 'slider';
/** How a schema-driven UI should present a boolean pref. */
export type PrefBooleanControl = 'checkbox' | 'switch' | 'toggle';
/** How a schema-driven UI should present a string pref. */
export type PrefStringControl = 'input' | 'textarea';
/** How a schema-driven UI should present an enum pref. */
export type PrefEnumControl = 'select' | 'radio' | 'toggle' | 'menu';

/** A numeric pref, optionally bounded and stepped, and optionally stored in a
 *  different unit from the one shown. */
export interface PrefNumber extends PrefBase<'number', number> {
  min?: number;
  max?: number;
  step?: number;
  control?: PrefNumberControl;
  /** How the value shows, speaks and reads back when typed — `compact()`
   *  reads `2.00M`. Presentation only: the stored value stays a number. */
  display?: Display;
  unit?: PrefNumberUnit;
  /** Which end of a slider gets a stop for ±Infinity, one step beyond the range. */
  endless?: 'min' | 'max' | 'both';
  /** The word infinity shows as — `'never'`, `'uncapped'`. Default `∞`. */
  infinity?: InfinityText;
}
/**
 * Stored-value bridge for a boolean leaf whose field is not a boolean — the
 * flag counterpart of {@link PrefEnumEncoding}. `TextStyle.fontStyle` is
 * the case: it stores `'italic'`, and the control is an Italic toggle.
 */
export interface PrefBooleanEncoding {
  /** Whether `stored` reads as on. */
  read: (stored: unknown, siblings: Record<string, unknown> | undefined) => boolean;
  /** What to store for `on`. `undefined` removes the field. */
  write: (on: boolean, siblings: Record<string, unknown> | undefined) => unknown;
}

/** An on/off pref. */
export interface PrefBoolean extends PrefBase<'boolean', boolean> {
  control?: PrefBooleanControl;
  encoding?: PrefBooleanEncoding;
}
/** A free-text pref. */
export interface PrefString extends PrefBase<'string', string> {
  control?: PrefStringControl;
}
/**
 * Stored-value bridge for an enum leaf whose value is not the option string —
 * the counterpart of {@link PrefNumberUnit}, which does the same for a
 * number stored in a canonical unit.
 *
 * A dash array is the case that needs it: `Stroke.dash` stores lengths, and
 * the thing a person chooses is a style. The presets scale by the stroke's
 * width, so both directions are given the object's other fields — a style is
 * meaningless without the width it is a multiple of.
 */
export interface PrefEnumEncoding<T extends string = string> {
  /**
   * The option `stored` reads as, or `undefined` for none — which a UI shows
   * the way it shows a mixed selection, by selecting nothing.
   *
   * `siblings` is the object the leaf is a field of, or `undefined` when the
   * node does not hold that object (and for a top-level leaf, which has none).
   */
  read: (stored: unknown, siblings: Record<string, unknown> | undefined) => T | undefined;
  /** What to store for `option`. `undefined` removes the field. */
  write: (option: T, siblings: Record<string, unknown> | undefined) => unknown;
}

/** What every enum leaf carries; {@link PrefEnum} adds `clearable`. */
export interface PrefEnumBase<T extends string = string>
  extends PrefBase<'enum', T | undefined> {
  /** `short` holds shorter forms of `label`, longest first, for a segmented
   *  control too narrow for the full one — down to a capital or two. `icon`
   *  names a glyph in the host UI's set (weasel-ui resolves it against
   *  `ICON_PATHS`), drawn in place of any text form where it resolves. It is
   *  a plain string because this package ships no icon set and cannot
   *  depend on one. The full `label` stays the accessible name, so neither the abbreviation nor the glyph becomes the only thing naming
   *  the option.
   *
   *  `disabled` marks an option a control reports but cannot author — the
   *  value a stored form reads as when it matches nothing offered. Dropping it
   *  from the list instead would leave the control selecting nothing and
   *  claiming the field is unset. */
  options: readonly {
    value: T;
    label: string;
    short?: readonly string[];
    icon?: string;
    disabled?: boolean;
  }[];
  control?: PrefEnumControl;
  encoding?: PrefEnumEncoding<T>;
}

/**
 * A pref with a fixed set of labeled choices.
 *
 * `clearable` says the field may hold none of the options, and that absence
 * is a state of its own rather than a missing value — a script that is
 * neither super nor sub. A toggle control then lets the chosen segment be
 * clicked off, which removes the field. Such a leaf's `default` is
 * `undefined`: a missing value is the only stored form of cleared, so a
 * default would bring an option back the moment the field was cleared.
 */
export type PrefEnum<T extends string = string> = PrefEnumBase<T> & (
  | { clearable?: false }
  | { clearable: true; default: undefined }
);

/** A single color, stored as a hex string. For a value that may also be a
 *  gradient or a pattern, use {@link PrefPaint} instead. */
export interface PrefColor extends PrefBase<'color', string> {
  /** Value is `#rrggbb`, or `#rrggbbaa` when `alpha` is set (UIs then
   *  offer an opacity control). */
  alpha?: boolean;
}

/**
 * Open leaf: any node with a `kind` outside the built-ins. Schema-driven
 * UIs (weasel-ui `PrefsForm` / `SelectionPanel`) dispatch it to an
 * app-supplied renderer. Deliberately NOT index-signatured so concrete
 * app interfaces stay assignable. Mirrors weasel-ui's `PrefCustom`.
 */
export type PrefCustom = PrefBase<string, unknown>;

/**
 * A whole `FillStyle`, not a color inside one. Use it wherever the value is
 * the tagged paint union — a solid color, a pattern, a gradient — rather
 * than a hex string.
 *
 * Addressing `…fill.color` instead reads `undefined` off a gradient (so the
 * control shows its default and claims the text is black) and writes a
 * hybrid `{ fill: 'gradient', stops, color }` that the renderer's structural
 * `'color' in paint` checks then paint flat solid. The union has to be
 * edited as a union.
 */
export interface PrefPaint extends PrefBase<'paint', unknown> {
  /** Offer an opacity control alongside the color. */
  alpha?: boolean;
}

/**
 * A leaf whose value is one object, with its own fields hanging off it.
 *
 * A compound value — a stroke, a shadow, a pattern spec — could be described
 * as several sibling leaves addressing into it (`data.stroke.width`,
 * `data.stroke.cap`). It shouldn't be: each control would then write one field
 * of a value it can only half see, and writing into something that is not an
 * object yet corrupts it. Here the fields are `children` of one leaf, and
 * every edit commits the parent object whole.
 *
 * `children` paths are relative to the object. They are ordinary leaves, so a
 * field that is itself a union (a stroke's `paint`) declares the kind that
 * edits that union. A child may also be a {@link PrefSection}, which
 * organizes the fields under a heading without contributing to the path. A
 * `TextStyle` needs it: its character and paragraph fields belong to one
 * value but read as two lists.
 */
export interface PrefObject extends PrefBase<'object', unknown> {
  children: Record<string, PrefLeaf | PrefSection>;
  /**
   * Lift a non-object value into the object form, for a consumer field that
   * may also be held as a scalar. Called before a child edit is applied;
   * without it a scalar-valued leaf shows its children empty, and an edit
   * starts from the leaf's `default`.
   */
  fromScalar?: (value: unknown) => Record<string, unknown>;
}

/**
 * A reference to another field of the same schema, held as the full path its
 * value is read and written at (`'camera.type'`) — the currency fields refer
 * to each other in. A surface offers the fields it draws as the choices.
 */
export interface PrefField extends PrefBase<'field', string> {
  /** Only fields of these kinds may be named. Default: any leaf. */
  kinds?: readonly string[];
}

/** One built-in pref leaf. `PrefLeaf` widens this to include
 *  app-defined kinds. */
export type BuiltinPref =
  | PrefNumber
  | PrefBoolean
  | PrefString
  | PrefEnum
  | PrefColor
  | PrefPaint
  | PrefObject
  | PrefList
  | PrefMap
  | PrefUnion
  | PrefField
  | PrefAction
  | PrefAlias
  | PrefLabel
  | PrefSeparator;

// Compile-time tie: every built-in leaf kind must appear in PrefKind
// and vice versa (PrefBase's K is open for PrefCustom's sake, so
// the union no longer enforces it).
type _BuiltinKindsExact = [BuiltinPref['kind']] extends [PrefKind]
  ? [PrefKind] extends [BuiltinPref['kind']] ? true : never
  : never;
const _builtinKindsExact: _BuiltinKindsExact = true;
void _builtinKindsExact;

/**
 * The built-in kinds, as a table. A kind added to {@link PrefKind} is a
 * compile error here, and from here it is one in every renderer's `never`
 * guard — the only thing standing between a new kind and rendering as
 * nothing in four places at once.
 */
export const PREF_KINDS: Record<PrefKind, true> = {
  number: true,
  boolean: true,
  string: true,
  enum: true,
  color: true,
  paint: true,
  object: true,
  list: true,
  map: true,
  union: true,
  field: true,
  action: true,
  alias: true,
  label: true,
  separator: true,
};

/** Which row each pairing among `leaves` puts a path on: a `key` the row's
 *  members share (the declaring leaf's path) and the `label` it reads. A
 *  path no `pair` names is absent. `leaves` are given by the path each
 *  surface reads and writes them at, so references resolve in its terms. */
export function pairRowsOf(
  leaves: Iterable<readonly [path: string, leaf: PrefLeaf]>,
): Map<string, { key: string; label: string }> {
  const rows = new Map<string, { key: string; label: string }>();
  for (const [path, leaf] of leaves) {
    if (!leaf.pair || rows.has(path)) continue;
    const row = { key: path, label: leaf.pair.label ?? leaf.name };
    rows.set(path, row);
    const partners = typeof leaf.pair.with === 'string' ? [leaf.pair.with] : leaf.pair.with;
    for (const partner of partners) if (!rows.has(partner)) rows.set(partner, row);
  }
  return rows;
}

/**
 * Narrows a leaf to the built-in union, so a renderer's switch discriminates
 * on {@link PrefKind} instead of the open `string` that
 * {@link PrefCustom} widens `kind` to. An app-defined kind answers false
 * and belongs to the renderer's custom-renderer path.
 */
export function isBuiltinPref(leaf: PrefLeaf): leaf is BuiltinPref {
  return Object.hasOwn(PREF_KINDS, leaf.kind);
}

/** Built-in or app-defined leaf. */
export type PrefLeaf = BuiltinPref | PrefCustom;
