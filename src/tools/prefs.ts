// src/tools/prefs.ts
//
// Minimal pref descriptor for tools that want to expose user-facing
// settings (commit-on-close, snap thresholds, etc.). Host apps compose
// these into their own preferences registry; the kit ships no storage
// or UI of its own. The shape is intentionally narrow — number,
// boolean, string, enum, plus rendering hints — so it's a clean
// structural subset of whatever a host app already has.

export type ToolPrefKind = 'number' | 'boolean' | 'string' | 'enum';

interface ToolPrefBase<K extends ToolPrefKind, Value> {
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
}

export type ToolPrefNumberControl = 'input' | 'slider';
export type ToolPrefBooleanControl = 'checkbox' | 'switch';
export type ToolPrefStringControl = 'input' | 'textarea';
export type ToolPrefEnumControl = 'select' | 'radio';

export interface ToolPrefNumber extends ToolPrefBase<'number', number> {
  min?: number;
  max?: number;
  step?: number;
  control?: ToolPrefNumberControl;
}
export interface ToolPrefBoolean extends ToolPrefBase<'boolean', boolean> {
  control?: ToolPrefBooleanControl;
}
export interface ToolPrefString extends ToolPrefBase<'string', string> {
  control?: ToolPrefStringControl;
}
export interface ToolPrefEnum<T extends string = string>
  extends ToolPrefBase<'enum', T> {
  options: readonly { value: T; label: string }[];
  control?: ToolPrefEnumControl;
}

export type ToolPref =
  | ToolPrefNumber
  | ToolPrefBoolean
  | ToolPrefString
  | ToolPrefEnum;

/** Nestable group: branch nodes a tool can use to organize its prefs. */
export interface ToolPrefGroup {
  name: string;
  description?: string;
  children: Record<string, ToolPref | ToolPrefGroup>;
}
