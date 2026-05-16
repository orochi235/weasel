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
}

export type ToolPrefNumberExpression = 'input' | 'slider';
export type ToolPrefBooleanExpression = 'checkbox' | 'switch';
export type ToolPrefStringExpression = 'input' | 'textarea';
export type ToolPrefEnumExpression = 'select' | 'radio';

export interface ToolPrefNumber extends ToolPrefBase<'number', number> {
  min?: number;
  max?: number;
  step?: number;
  expression?: ToolPrefNumberExpression;
}
export interface ToolPrefBoolean extends ToolPrefBase<'boolean', boolean> {
  expression?: ToolPrefBooleanExpression;
}
export interface ToolPrefString extends ToolPrefBase<'string', string> {
  expression?: ToolPrefStringExpression;
}
export interface ToolPrefEnum<T extends string = string>
  extends ToolPrefBase<'enum', T> {
  options: readonly { value: T; label: string }[];
  expression?: ToolPrefEnumExpression;
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
