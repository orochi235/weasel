import { resolveStrokeWidth, type CommandStroke, type DrawCommand, type View } from '@weasel-js/core';
import { PATH_L, PATH_M, pxExtent, pxExtentInFrame, type Affine, type PolygonPath } from '@weasel-js/geom';
import { linesIn, type AxisLines, type GridLines } from './axes';

/** An axis-aligned rectangle, in whatever coordinates a lattice is drawn in. */
export type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

/** The strokes of a lattice's three line families. */
export type LatticeStyles = { line: CommandStroke; accent: CommandStroke; sub: CommandStroke };

/** How a lattice divides: accents every N cells, sub-lines per cell. Both
 *  apply only to an axis with a pitch. */
export interface LatticeShape {
  accentEvery?: number | undefined;
  subdivisions?: number | undefined;
}

/** Closest, in CSS pixels, a line family is drawn; denser ones are left out. */
const MIN_SCREEN_SPACING = 4;

// Written so a non-finite extent, which a zero view scale gives, fails it too.
export function hasArea(r: Rect): boolean {
  return r.width > 0 && r.height > 0 && Number.isFinite(r.width) && Number.isFinite(r.height);
}

type Axis = 'x' | 'y';
const other = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x');

/**
 * The lines of `lines` inside `b`: sub-lines, cell lines and accents. `b` is
 * in `frame`'s coordinates, which `frame` carries to world; absent, it is
 * world. A line runs across `b`, or across the other axis's range where its
 * pitch is limited to one. Lines are a screen pixel wide either way.
 */
export function lattice(
  b: Rect, lines: GridLines, shape: LatticeShape, view: View, styles: LatticeStyles, frame?: Affine,
): DrawCommand[] {
  // Every line runs along one of the lattice's axes, so its width runs along
  // the other, and one pixel of it is that axis's extent.
  const px = frame ? pxExtentInFrame(1, view.scale, frame) : pxExtent(1, view.scale);
  const span = { x: [b.x, b.x + b.width] as const, y: [b.y, b.y + b.height] as const };
  const children: DrawCommand[] = [];

  // The stretch of `axis` a line across it covers.
  const across = (axis: Axis): [number, number] => {
    const a = lines[axis];
    const [lo, hi] = span[axis];
    return a && 'pitch' in a ? [Math.max(lo, a.from), Math.min(hi, a.to)] : [lo, hi];
  };

  const draw = (axis: Axis, at: readonly number[], s: CommandStroke): void => {
    const [lo, hi] = across(other(axis));
    if (!(hi > lo)) return;
    const width = resolveStrokeWidth(s.width ?? 1, 1) * px[axis];
    for (const p of at) {
      const coords = axis === 'x' ? [p, lo, p, hi] : [lo, p, hi, p];
      const path: PolygonPath = {
        kind: 'polygon', commands: new Uint8Array([PATH_M, PATH_L]), coords: new Float32Array(coords), fillRule: 'nonzero',
      };
      children.push({ kind: 'path', path, stroke: { ...s, width } });
    }
  };

  // A pitch's lines `every`-th apart, leaving out each `skipEvery`-th (the
  // ones a coarser family draws), and none once they would sit closer than
  // MIN_SCREEN_SPACING on screen.
  const periodic = (axis: Axis, a: Extract<AxisLines, { pitch: number }>, step: number, skipEvery: number, s: CommandStroke) => {
    if (!(step / px[axis] >= MIN_SCREEN_SPACING)) return;
    const at = linesIn({ ...a, pitch: step }, ...span[axis]);
    draw(axis, skipEvery > 0 ? at.filter((p) => Math.round((p - a.offset) / step) % skipEvery !== 0) : at, s);
  };

  const { accentEvery, subdivisions } = shape;
  const accentOn = accentEvery !== undefined && accentEvery > 0;
  const passes: ((axis: Axis, a: Extract<AxisLines, { pitch: number }>) => void)[] = [
    // Sub-lines first so cell lines paint on top, accents last of all.
    (axis, a) => { if (subdivisions && subdivisions > 1) periodic(axis, a, a.pitch / subdivisions, subdivisions, styles.sub); },
    (axis, a) => periodic(axis, a, a.pitch, accentOn ? accentEvery : 0, styles.line),
    (axis, a) => { if (accentOn) periodic(axis, a, a.pitch * accentEvery, 0, styles.accent); },
  ];
  for (const pass of passes) {
    for (const axis of ['x', 'y'] as const) {
      const a = lines[axis];
      if (a && 'pitch' in a) pass(axis, a);
    }
  }
  for (const axis of ['x', 'y'] as const) {
    const a = lines[axis];
    if (a && 'at' in a) draw(axis, thinned(linesIn(a, ...span[axis]), px[axis] * MIN_SCREEN_SPACING), styles.line);
  }
  return children;
}

/** `at` (ascending) less each line closer than `gap` to the last one kept. */
function thinned(at: readonly number[], gap: number): number[] {
  const out: number[] = [];
  for (const p of at) if (out.length === 0 || p - out[out.length - 1]! >= gap) out.push(p);
  return out;
}

/** The axis-aligned box around `outline`. */
export function outlineBox(outline: readonly Point[]): Rect {
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Where `a` and `b` overlap; no area where they don't. */
export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, width: Math.min(a.x + a.width, b.x + b.width) - x, height: Math.min(a.y + a.height, b.y + b.height) - y };
}
