// src/tools/prefs.ts
//
// Minimal pref descriptor for tools that want to expose user-facing
// settings (commit-on-close, snap thresholds, etc.). Host apps compose
// these into their own preferences registry; the kit ships no storage
// or UI of its own. The shape is intentionally narrow — number,
// boolean, string, enum, plus rendering hints — so it's a clean
// structural subset of whatever a host app already has.

/** The value types a built-in pref leaf can hold. */
export type ToolPrefKind = 'number' | 'boolean' | 'string' | 'enum' | 'color' | 'paint';

interface ToolPrefBase<K extends string, Value> {
  kind: K;
  /** Human-readable label. */
  name: string;
  /** Longer help text — shown in tooltips / a settings pane. */
  description: string;
  /** Fallback when nothing is persisted. */
  default: Value;
  /** Hide from a host app's settings UI by default. */
  hidden?: boolean;
  /** Render full-width with no label row in schema-driven settings UIs
   *  (weasel-ui `PrefsForm` honors this for leaves whose control brings
   *  its own chrome). */
  block?: boolean;
  /** Row-pairing hint for compact property UIs (weasel-ui
   *  `SelectionPanel`): leaves sharing a `pair` id render side-by-side
   *  on one row labeled with the `pair` string (e.g. `'Position'` for
   *  `pose.x` / `pose.y`). Purely presentational. */
  pair?: string;
}

/** How a schema-driven UI should present a number pref. */
export type ToolPrefNumberControl = 'input' | 'slider';
/** How a schema-driven UI should present a boolean pref. */
export type ToolPrefBooleanControl = 'checkbox' | 'switch';
/** How a schema-driven UI should present a string pref. */
export type ToolPrefStringControl = 'input' | 'textarea';
/** How a schema-driven UI should present an enum pref. */
export type ToolPrefEnumControl = 'select' | 'radio';

/** Display-unit conversion for number leaves whose stored value uses a
 *  canonical unit the user shouldn't see (e.g. radians stored, degrees
 *  shown). The stored value stays canonical; UIs convert at the edge. */
export interface ToolPrefNumberUnit {
  toDisplay: (stored: number) => number;
  fromDisplay: (display: number) => number;
  /** Shown after the input, e.g. `'°'`. */
  suffix?: string;
}

/** A numeric pref, optionally bounded and stepped, and optionally stored in a
 *  different unit from the one shown. */
export interface ToolPrefNumber extends ToolPrefBase<'number', number> {
  min?: number;
  max?: number;
  step?: number;
  control?: ToolPrefNumberControl;
  unit?: ToolPrefNumberUnit;
}
/** An on/off pref. */
export interface ToolPrefBoolean extends ToolPrefBase<'boolean', boolean> {
  control?: ToolPrefBooleanControl;
}
/** A free-text pref. */
export interface ToolPrefString extends ToolPrefBase<'string', string> {
  control?: ToolPrefStringControl;
}
/** A pref with a fixed set of labeled choices. */
export interface ToolPrefEnum<T extends string = string>
  extends ToolPrefBase<'enum', T> {
  options: readonly { value: T; label: string }[];
  control?: ToolPrefEnumControl;
}

/** A single color, stored as a hex string. For a value that may also be a
 *  gradient or a pattern, use {@link ToolPrefPaint} instead. */
export interface ToolPrefColor extends ToolPrefBase<'color', string> {
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
export interface ToolPrefCustom extends ToolPrefBase<string, unknown> {}

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
export interface ToolPrefPaint extends ToolPrefBase<'paint', unknown> {
  /** Offer an opacity control alongside the color. */
  alpha?: boolean;
}

/** One built-in pref leaf. `ToolPrefLeaf` widens this to include
 *  app-defined kinds. */
export type ToolPref =
  | ToolPrefNumber
  | ToolPrefBoolean
  | ToolPrefString
  | ToolPrefEnum
  | ToolPrefColor
  | ToolPrefPaint;

// Compile-time tie: every built-in leaf kind must appear in ToolPrefKind
// and vice versa (ToolPrefBase's K is open for ToolPrefCustom's sake, so
// the union no longer enforces it).
type _BuiltinKindsExact = [ToolPref['kind']] extends [ToolPrefKind]
  ? [ToolPrefKind] extends [ToolPref['kind']] ? true : never
  : never;
const _builtinKindsExact: _BuiltinKindsExact = true;
void _builtinKindsExact;

/** Built-in or app-defined leaf. */
export type ToolPrefLeaf = ToolPref | ToolPrefCustom;

/** Nestable group: branch nodes a tool can use to organize its prefs. */
export interface ToolPrefGroup {
  name: string;
  description?: string;
  children: Record<string, ToolPrefLeaf | ToolPrefGroup>;
}
