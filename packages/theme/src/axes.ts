/** One value of an axis. `scheme` becomes `color-scheme` in that value's CSS blocks. */
export interface AxisValue {
  readonly scheme?: 'dark' | 'light';
}

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

export type Varying<T> = T | ByAxis<T>;

export type Picked<T> = { ok: true; value: T } | { ok: false; axis: string; value: string };

export function isByAxis(v: unknown): v is ByAxis<unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { by?: unknown }).by === 'string';
}

/** Every axis given a known value; anything missing or unknown takes its default. */
export function fullSelection(axes: AxisDefs, selection: Selection = {}): Selection {
  const out: Record<string, string> = {};
  for (const [name, def] of Object.entries(axes)) {
    const v = selection[name];
    out[name] = v !== undefined && v in def.values ? v : def.default;
  }
  return out;
}

export function enumerateSelections(axes: AxisDefs): Selection[] {
  let out: Record<string, string>[] = [{}];
  for (const [name, def] of Object.entries(axes)) {
    out = out.flatMap((s) => Object.keys(def.values).map((v) => ({ ...s, [name]: v })));
  }
  return out;
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
    if (value === undefined || value === 'by' || !(value in cur)) return { ok: false, axis, value: value ?? '' };
    cur = cur[value];
  }
  return { ok: true, value: cur as T };
}
