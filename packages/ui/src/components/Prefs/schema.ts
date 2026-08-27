// Preference-schema vocabulary for PrefsForm / PrefsDialog.
//
// Deliberately field-compatible with core's `ToolPref*` family
// (src/tools/prefs.ts): this schema module deliberately avoids importing
// @weasel-js/core, so the contract is structural — a `ToolPrefGroup` (and
// any host-app superset, like WeaselDraw's registry) assigns into
// `PrefGroup` with no import and no cast. Keep the two in sync
// field-for-field.

/** Control-presentation hints per kind — visually-equivalent renderings
 *  of the same value type. The persisted value is unchanged either way. */
export type PrefNumberControl = 'input' | 'slider';
/** Which control renders a {@link PrefBoolean}. */
export type PrefBooleanControl = 'checkbox' | 'switch';
/** Which control renders a {@link PrefString}. */
export type PrefStringControl = 'input' | 'textarea';
/** Which control renders a {@link PrefEnum}. */
export type PrefEnumControl = 'select' | 'radio' | 'toggle';

interface PrefBase<K extends string, Value> {
  kind: K;
  /** Human-readable label, e.g. "Show grid". */
  name: string;
  /** Longer help text — surfaces as a tooltip on the row label. */
  description: string;
  /** Fallback when `values` holds nothing at this leaf's path. */
  default: Value;
  /** Omitted from the form unless `showHidden` is set. */
  hidden?: boolean;
  /** Render the control full-width with no label/tooltip row — for
   *  controls that supply their own chrome (embedded sub-panel editors).
   *  The `description` still applies wherever the renderer surfaces it. */
  block?: boolean;
  /** Row-pairing hint for compact property UIs (`SelectionPanel`):
   *  leaves sharing a `pair` id render side-by-side on one row labeled
   *  with the `pair` string. Purely presentational. */
  pair?: string;
}

/** Display-unit conversion for number leaves whose stored value uses a
 *  canonical unit the user shouldn't see (radians → degrees). Mirrors
 *  core's `ToolPrefNumberUnit`. */
export interface PrefNumberUnit {
  toDisplay: (stored: number) => number;
  fromDisplay: (display: number) => number;
  suffix?: string;
}

/**
 * A numeric preference. `unit` lets the stored value stay in a canonical unit
 * while the user edits a converted one.
 */
export interface PrefNumber extends PrefBase<'number', number> {
  min?: number;
  max?: number;
  step?: number;
  control?: PrefNumberControl;
  unit?: PrefNumberUnit;
}
/** A boolean preference. */
export interface PrefBoolean extends PrefBase<'boolean', boolean> {
  control?: PrefBooleanControl;
}
/** A free-text preference. */
export interface PrefString extends PrefBase<'string', string> {
  control?: PrefStringControl;
}
/** A preference chosen from a fixed set of options. */
export interface PrefEnum<T extends string = string> extends PrefBase<'enum', T> {
  /** `short` is what a segmented control shows when the full label will not
   *  fit; `label` stays the accessible name. */
  options: readonly { value: T; label: string; short?: string }[];
  control?: PrefEnumControl;
}

/** A color preference, stored as a hex string. */
export interface PrefColor extends PrefBase<'color', string> {
  /** Value is `#rrggbb`, or `#rrggbbaa` when `alpha` is set. */
  alpha?: boolean;
}

/** A whole paint — a solid color, a gradient, a pattern. Mirrors core's
 *  `ToolPrefPaint`: the value is the tagged union, not a color inside it. */
export interface PrefPaint extends PrefBase<'paint', unknown> {
  /** Offer an opacity control alongside the color. */
  alpha?: boolean;
}

/** A leaf whose value is one object, with its own fields as `children`.
 *  Mirrors core's `ToolPrefObject`: every child edit commits the parent whole,
 *  so a field is never written into a value that isn't an object yet. */
export interface PrefObject extends PrefBase<'object', unknown> {
  children: Record<string, PrefLeaf | PrefGroup>;
  /** Lift a non-object value into the object form before a child edit. */
  fromScalar?: (value: unknown) => Record<string, unknown>;
}

/** The leaf kinds `PrefsForm` renders without a custom renderer. */
export type BuiltinPref =
  | PrefNumber | PrefBoolean | PrefString | PrefEnum | PrefColor | PrefPaint | PrefObject;

/**
 * Open leaf: any node with a `kind` the form doesn't know renders via the
 * `renderers` map (`renderers[kind]`). App schemas keep their extra fields
 * (e.g. a registry-enum's `source`/`filter`) — renderers receive the node
 * and narrow it themselves. Deliberately NOT index-signatured so concrete
 * app interfaces stay assignable.
 */
export type PrefCustom = PrefBase<string, unknown>;

/**
 * Any leaf in a preference schema — a built-in kind, or an app-defined one
 * rendered through `PrefsFormProps.renderers`.
 */
export type PrefLeaf = BuiltinPref | PrefCustom;

/** Nestable group: branch nodes in the schema tree. */
export interface PrefGroup {
  name: string;
  description?: string;
  children: Record<string, PrefLeaf | PrefGroup>;
}

/** Distinguishes a leaf from a group while walking a schema tree. */
export function isPrefLeaf(node: PrefLeaf | PrefGroup): node is PrefLeaf {
  return 'kind' in node;
}

/** Get the value at a dotted path inside a nested value tree. Returns
 *  `undefined` when a segment is missing or hits a non-object. */
export function prefValueAtPath(values: unknown, path: string): unknown {
  let cur: unknown = values;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Recursively drop `hidden` leaves (unless `showHidden`), pruning groups
 * that end up empty. Returns null when the entire subtree is hidden.
 */
export function visiblePrefSubtree<T extends PrefLeaf | PrefGroup>(
  node: T,
  showHidden: boolean,
): T | null {
  if (isPrefLeaf(node)) return node.hidden && !showHidden ? null : node;
  const group = node as PrefGroup;
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  for (const [key, child] of Object.entries(group.children)) {
    const kept = visiblePrefSubtree(child, showHidden);
    if (kept) children[key] = kept;
  }
  if (Object.keys(children).length === 0) return null;
  return { ...node, children };
}
