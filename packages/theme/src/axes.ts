import { isPlainObject } from '@weasel-js/registry';

/** One value of an axis. `scheme` becomes `color-scheme` in that value's CSS blocks. */
export interface AxisValue {
  readonly scheme?: 'dark' | 'light';
}

/** One variant dimension of a theme, such as `mode` or `density`. `default` must name one of `values`. */
export interface AxisDef {
  readonly default: string;
  readonly values: Readonly<Record<string, AxisValue>>;
}

/** Key order is declaration order, which selectors and selection keys follow. */
export type AxisDefs = Readonly<Record<string, AxisDef>>;

/** A partial choice of axis values, e.g. `{ mode: 'light' }`. */
export type Selection = Readonly<Record<string, string>>;

/** `{ by: 'mode', dark: …, light: … }`: a value that differs per axis value. */
export interface ByAxis<T> {
  readonly by: string;
  readonly [axisValue: string]: Varying<T> | string;
}

/** A value that is either the same everywhere or chosen per axis value. */
export type Varying<T> = T | ByAxis<T>;

export type Picked<T> = { ok: true; value: T } | { ok: false; axis: string; value: string };

/** Whether `v` is a {@link ByAxis} value. */
export function isByAxis(v: unknown): v is ByAxis<unknown> {
  return isPlainObject(v) && typeof v.by === 'string';
}

/** Every axis given a known value; anything missing or unknown takes its default. */
export function fullSelection(axes: AxisDefs, selection: Selection = {}): Selection {
  const out: Record<string, string> = {};
  for (const [name, def] of Object.entries(axes)) {
    const v = selection[name];
    out[name] = v !== undefined && Object.hasOwn(def.values, v) ? v : def.default;
  }
  return out;
}

/** A child's axes over its parent's: an axis both declare keeps both sets of values, the child's entries and default winning. */
export function mergeAxes(parent: AxisDefs, child: AxisDefs): AxisDefs {
  const out: Record<string, AxisDef> = { ...parent };
  for (const [name, def] of Object.entries(child)) {
    out[name] = { ...def, values: { ...parent[name]?.values, ...def.values } };
  }
  return out;
}

/** Every full combination of axis values, the first axis varying slowest. */
export function enumerateSelections(axes: AxisDefs): Selection[] {
  let out: Record<string, string>[] = [{}];
  for (const [name, def] of Object.entries(axes)) {
    out = out.flatMap((s) => Object.keys(def.values).map((v) => ({ ...s, [name]: v })));
  }
  return out;
}

/** The `color-scheme` an axis value writes: its own, or `normal` when a sibling value has one, so a nested
 *  scheme-less value resets it. A value the axis doesn't declare takes its default's, whose tokens it falls
 *  back to, rather than a blanket reset. */
export function axisScheme(axes: AxisDefs, axis: string, value: string): string | undefined {
  const def = Object.hasOwn(axes, axis) ? axes[axis] : undefined;
  if (!def) return undefined;
  if (!Object.hasOwn(def.values, value)) return axisScheme(axes, axis, def.default);
  return def.values[value].scheme ?? (Object.values(def.values).some((v) => v.scheme) ? 'normal' : undefined);
}

/** A theme name or axis value as its `data-wzl-*` attribute holds it: NUL as U+FFFD, which is how CSS reads one, escaped or not. */
export function wzlValue(value: string): string {
  return value.replace(/\0/g, '\uFFFD');
}

/** The selector matching `data-wzl-<attr>` equal to `wzlValue(value)`, quoted so any theme name or axis value reads as itself. */
export function wzlAttr(attr: string, value: string): string {
  return `[data-wzl-${attr}='${wzlValue(value).replace(/[\\']/g, '\\$&').replace(/[\n\r\f]/g, (c) => `\\${c.charCodeAt(0).toString(16)} `)}']`;
}

/** `mode=dark,density=compact`, axes in declaration order. */
export function selectionKey(axes: AxisDefs, selection: Selection): string {
  const full = fullSelection(axes, selection);
  return Object.keys(axes).map((a) => `${a}=${full[a]}`).join(',');
}

export function pick<T>(v: Varying<T>, selection: Selection): Picked<T> {
  let cur: unknown = v;
  while (isByAxis(cur)) {
    const axis = cur.by;
    const value = selection[axis];
    if (value === undefined || value === 'by' || !Object.hasOwn(cur, value)) return { ok: false, axis, value: value ?? '' };
    cur = cur[value];
  }
  return { ok: true, value: cur as T };
}

/** Every entry of a varying record that has a value for this selection, in record order. */
export function pickAll<T>(record: Readonly<Record<string, Varying<T>>>, selection: Selection): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [name, v] of Object.entries(record)) {
    const picked = pick(v, selection);
    if (picked.ok) out[name] = picked.value;
  }
  return out;
}
