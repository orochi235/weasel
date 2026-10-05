import type { Unit } from './units';

/**
 * How a number shows, speaks and reads back, as plain data: `{ kind: 'fraction',
 * maxDenominator: 64 }`. Data rather than a function so a tagged value keeps its
 * presentation through JSON, history snapshots and `structuredClone`. The
 * behavior lives on the registered {@link DisplayKind} of the same `kind`.
 */
export interface Display {
  readonly kind: string;
  /** What ±Infinity reads as under this display — `'never'` on a timeout.
   *  Default `∞`, spoken `infinity`. Honored by every kind. */
  readonly infinity?: InfinityText;
  readonly [option: string]: unknown;
}

/** A word for infinity. A string is both shown and spoken. `negative` is the
 *  word for −Infinity, default `−∞`. */
export type InfinityText =
  | string
  | { readonly text: string; readonly spoken?: string; readonly negative?: string | { readonly text: string; readonly spoken?: string } };

/** `display` with `text` as its word for infinity: `endless(unit('ms'), 'never')`. */
export function endless<D extends Display>(display: D, text: InfinityText): D {
  return { ...display, infinity: text };
}

/** A number that carries its unit, its display, or both. */
export interface Tagged {
  value: number;
  /** The unit `value` is measured in. Absent is the base unit. */
  unit?: Unit;
  display?: Display;
}

/**
 * A number anywhere the engine takes one: bare, which costs nothing, or
 * {@link Tagged}, which keeps its unit and display as it moves. Every reader
 * goes through {@link amount}, and every writer through {@link retag}, so a
 * value leaves in the shape it arrived in.
 */
export type Quantity = number | Tagged;

/** The number a quantity holds. */
export function amount(q: Quantity): number {
  return typeof q === 'number' ? q : q.value;
}

/**
 * `next` in the shape of `q`: a bare number stays bare, and a tagged one keeps
 * its unit and display. What an editor calls when it changes a value it was
 * handed, so the presentation survives the edit.
 */
export function retag<Q extends Quantity>(q: Q, next: number): Q {
  return (typeof q === 'number' ? next : { ...(q as Tagged), value: next }) as Q;
}

/** A tagged quantity. `display` and `unit` are left off when absent, so the
 *  JSON carries only what was set. */
export function tag(value: number, display?: Display, unit?: Unit): Tagged {
  const t: Tagged = { value };
  if (unit !== undefined) t.unit = unit;
  if (display !== undefined) t.display = display;
  return t;
}

/** The display `q` carries, else `fallback`. A value's own tag wins over the
 *  default of whatever shows it. */
export function displayOf(q: Quantity, fallback?: Display): Display | undefined {
  return (typeof q === 'number' ? undefined : q.display) ?? fallback;
}

/** The unit `q` is measured in, when it says. */
export function unitOf(q: Quantity): Unit | undefined {
  return typeof q === 'number' ? undefined : q.unit;
}
