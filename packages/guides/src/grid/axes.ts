import type { PerAxis, PlaneValue } from '@weasel-js/core';

/** A length on a grid: a bare number, or a value tagged with a unit. */
export type GridLength = Exclude<PlaneValue, PerAxis<unknown>>;

/**
 * One axis of a grid: a pitch from zero; a pitch with an `offset` its lines
 * pass through, limited to `from`..`to` (inclusive); or lines at explicit
 * positions, for uneven bays. Positions are measured from the grid's origin:
 * a container's corner, or the root's origin. A pitch that is not a positive
 * finite number gives the axis no lines.
 */
export type GridAxis =
  | GridLength
  | { pitch: GridLength; offset?: GridLength; from?: GridLength; to?: GridLength }
  | { at: readonly GridLength[] };

/** A grid's lines: one rule for both axes, or one per axis. An axis left out
 *  has no lines: it draws none and nothing snaps on it. */
export type GridSpacing = GridLength | { x?: GridAxis; y?: GridAxis };

/** An axis's lines, resolved to numbers in the space the grid runs in. */
export type AxisLines =
  | { pitch: number; offset: number; from: number; to: number }
  | { at: readonly number[] };

/** A grid's lines on each axis, `null` where it has none. */
export type GridLines = PerAxis<AxisLines | null>;

type Axis = 'x' | 'y';

export function isGridLength(v: unknown): v is GridLength {
  return typeof v === 'number' || (typeof v === 'object' && v !== null && 'value' in v);
}

/** `spacing`'s lines, each length read by `read` for its axis. */
export function resolveGridLines(spacing: GridSpacing, read: (v: GridLength, axis: Axis) => number): GridLines {
  const on = (axis: Axis): AxisLines | null => {
    const a = isGridLength(spacing) ? spacing : spacing[axis];
    if (a === undefined) return null;
    try {
      return resolveAxis(a, (v) => read(v, axis));
    } catch (e) {
      throw new Error(`${axis} axis: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return { x: on('x'), y: on('y') };
}

function resolveAxis(a: GridAxis, read: (v: GridLength) => number): AxisLines | null {
  if (isGridLength(a)) return periodic(read(a), 0, -Infinity, Infinity);
  if ('at' in a) {
    const at = [...new Set(a.at.map(read))].filter(Number.isFinite).sort((p, q) => p - q);
    return at.length ? { at } : null;
  }
  return periodic(
    read(a.pitch),
    a.offset === undefined ? 0 : read(a.offset),
    a.from === undefined ? -Infinity : read(a.from),
    a.to === undefined ? Infinity : read(a.to),
  );
}

function periodic(pitch: number, offset: number, from: number, to: number): AxisLines | null {
  return pitch > 0 && Number.isFinite(pitch) && from <= to ? { pitch, offset, from, to } : null;
}

const EPS = 1e-9;

/** The first and last index `k` of `offset + k * pitch` inside the range. */
function indexRange(a: { pitch: number; offset: number; from: number; to: number }): [number, number] {
  return [Math.ceil((a.from - a.offset) / a.pitch - EPS), Math.floor((a.to - a.offset) / a.pitch + EPS)];
}

/** The line at or before `v` and the one after it, nearer first, the upper
 *  on a tie; at an end of the lines, the two nearest. Empty where the axis
 *  has no line. */
export function linesNear(a: AxisLines, v: number): number[] {
  let pair: number[];
  if ('at' in a) {
    const i = Math.min(Math.max(0, lastAtOrBefore(a.at, v)), Math.max(0, a.at.length - 2));
    pair = a.at.slice(i, i + 2);
  } else {
    const [lo, hi] = indexRange(a);
    if (lo > hi) return [];
    const k = Math.min(Math.max(Math.floor((v - a.offset) / a.pitch), lo), Math.max(lo, hi - 1));
    pair = k + 1 <= hi ? [a.offset + k * a.pitch, a.offset + (k + 1) * a.pitch] : [a.offset + k * a.pitch];
  }
  return pair.length === 2 && v - pair[0]! >= pair[1]! - v ? [pair[1]!, pair[0]!] : pair;
}

/** The line nearest `v`, or `null` where the axis has none. */
export function nearestLine(a: AxisLines, v: number): number | null {
  let best: number | null = null;
  for (const l of linesNear(a, v)) if (best === null || Math.abs(l - v) < Math.abs(best - v)) best = l;
  return best;
}

/** Every line from `lo` to `hi`, in order. The caller bounds how many a
 *  pitch gives over the span. */
export function linesIn(a: AxisLines, lo: number, hi: number): number[] {
  if ('at' in a) return a.at.filter((l) => l >= lo - EPS && l <= hi + EPS);
  const [k0, k1] = indexRange({ ...a, from: Math.max(a.from, lo), to: Math.min(a.to, hi) });
  const out: number[] = [];
  for (let k = k0; k <= k1; k++) out.push(a.offset + k * a.pitch);
  return out;
}

/** The cell holding `v`: the gap between two adjacent lines, numbered from
 *  the line through the offset (or the first explicit line). An axis with
 *  no lines is one cell, `0`, without end. `null` outside the lines. */
export function cellOf(a: AxisLines | null, v: number): { index: number; lo: number; hi: number } | null {
  if (!a) return { index: 0, lo: -Infinity, hi: Infinity };
  if ('at' in a) {
    const i = lastAtOrBefore(a.at, v);
    return i >= 0 && i < a.at.length - 1 ? { index: i, lo: a.at[i]!, hi: a.at[i + 1]! } : null;
  }
  const [lo, hi] = indexRange(a);
  const k = Math.floor((v - a.offset) / a.pitch);
  if (k < lo || k >= hi) return null;
  return { index: k, lo: a.offset + k * a.pitch, hi: a.offset + (k + 1) * a.pitch };
}

/** `a` with every position `p` moved to `p * scale + shift`. */
export function mapLines(a: AxisLines, scale: number, shift: number): AxisLines {
  const m = (p: number) => p * scale + shift;
  if ('at' in a) return { at: a.at.map(m).sort((p, q) => p - q) };
  const [from, to] = [m(a.from), m(a.to)].sort((p, q) => p - q) as [number, number];
  return { pitch: Math.abs(a.pitch * scale), offset: m(a.offset), from: Number.isNaN(from) ? -Infinity : from, to: Number.isNaN(to) ? Infinity : to };
}

function lastAtOrBefore(at: readonly number[], v: number): number {
  let lo = 0;
  let hi = at.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (at[mid]! <= v + EPS) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}
