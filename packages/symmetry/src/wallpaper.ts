import type { SymmetrySpec, WallpaperCell } from './kinds';

/** The most copies a wallpaper draws. Past it, the lattice points nearest the
 *  center are kept, so a lattice finer than its extent warrants still draws. */
export const MAX_WALLPAPER_COPIES = 4096;

/** One point of a wallpaper's lattice: `i` steps along `angle` and `j` rows
 *  along the row angle, which together put it at `x`, `y` from the center. */
export interface LatticePoint {
  i: number;
  j: number;
  x: number;
  y: number;
}

/** Index range a lattice is searched over, either way from the center, so a
 *  nearly collapsed lattice cannot make the search itself unbounded. */
const SEARCH = 512;
/** `Math.cos` and `Math.sin` leave 1e-16 where a quarter turn has an exact 0. */
const exact = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : v);

/**
 * The lattice points of `spec` inside its extent, as offsets from the center,
 * rows in order and steps in order along each. Empty when the lattice has
 * collapsed onto a line or a point. At most `limit` of them, the nearest the
 * center kept.
 */
export function latticePoints(spec: SymmetrySpec, limit = MAX_WALLPAPER_COPIES + 1): LatticePoint[] {
  const ax = exact(Math.cos(spec.angle)) * spec.spacing;
  const ay = exact(Math.sin(spec.angle)) * spec.spacing;
  const bx = exact(Math.cos(spec.angle + spec.rowAngle)) * spec.rowSpacing;
  const by = exact(Math.sin(spec.angle + spec.rowAngle)) * spec.rowSpacing;
  const det = ax * by - ay * bx;
  const { x, y, width, height } = spec.extent;
  if (!(Math.abs(det) > 1e-9) || !(width >= 0) || !(height >= 0)) return [];
  // The extent's corners in lattice coordinates bound the indices worth trying.
  const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
    .map(([px, py]) => [(px * by - py * bx) / det, (ax * py - ay * px) / det]);
  const range = (k: 0 | 1): [number, number] => [
    Math.max(-SEARCH, Math.floor(Math.min(...corners.map((c) => c[k])))),
    Math.min(SEARCH, Math.ceil(Math.max(...corners.map((c) => c[k])))),
  ];
  const [i0, i1] = range(0);
  const [j0, j1] = range(1);
  const eps = 1e-9 * Math.max(1, width, height);
  const out: LatticePoint[] = [];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const px = i * ax + j * bx;
      const py = i * ay + j * by;
      if (px < x - eps || px > x + width + eps || py < y - eps || py > y + height + eps) continue;
      out.push({ i, j, x: px, y: py });
    }
  }
  if (out.length <= limit) return out;
  const kept = new Set(
    [...out].sort((p, q) => Math.hypot(p.x, p.y) - Math.hypot(q.x, q.y)).slice(0, Math.max(0, limit)),
  );
  return out.filter((p) => kept.has(p));
}

/** A wallpaper group's name, in the crystallographers' short notation. */
export type WallpaperGroup =
  | 'p1' | 'p2' | 'pm' | 'pg' | 'cm' | 'pmm' | 'pmg' | 'pgg' | 'cmm'
  | 'p4' | 'p4m' | 'p4g' | 'p3' | 'p3m1' | 'p31m' | 'p6' | 'p6m';

/** The spec fields that make a wallpaper one of the groups. `rowRatio` is the
 *  row spacing as a multiple of the step's. */
export interface WallpaperPreset {
  readonly cell: WallpaperCell;
  readonly count?: number;
  readonly cellAngle?: number;
  readonly glide?: boolean;
  readonly glideRows?: boolean;
  readonly rowAngle: number;
  readonly rowRatio: number;
}

const OBLIQUE = { rowAngle: (5 * Math.PI) / 12, rowRatio: 0.8 };
const RECTANGLE = { rowAngle: Math.PI / 2, rowRatio: 0.75 };
// A row offset by half a step: the rectangle with a point at its middle.
const CENTERED = { rowAngle: Math.atan2(0.8, 0.5), rowRatio: Math.hypot(0.5, 0.8) };
const SQUARE = { rowAngle: Math.PI / 2, rowRatio: 1 };
// A square turned an eighth: rows offset by half a step, half a step apart.
const CENTERED_SQUARE = { rowAngle: Math.PI / 4, rowRatio: Math.SQRT1_2 };
const HEXAGON = { rowAngle: Math.PI / 3, rowRatio: 1 };

/**
 * The seventeen wallpaper groups, each as a cell and a lattice it fits. pgg
 * and p4g mirror alternate rows of a centered lattice, which puts their glide
 * axes between the rows and off the cell's centers.
 */
export const WALLPAPER_GROUPS: Readonly<Record<WallpaperGroup, WallpaperPreset>> = {
  p1: { cell: 'none', ...OBLIQUE },
  p2: { cell: 'point', ...OBLIQUE },
  pm: { cell: 'mirror', ...RECTANGLE },
  pg: { cell: 'none', glide: true, ...RECTANGLE },
  cm: { cell: 'mirror', ...CENTERED },
  pmm: { cell: 'both', ...RECTANGLE },
  pmg: { cell: 'point', glide: true, ...RECTANGLE },
  pgg: { cell: 'point', glide: true, glideRows: true, ...CENTERED },
  cmm: { cell: 'both', ...CENTERED },
  p4: { cell: 'radial', count: 4, ...SQUARE },
  p4m: { cell: 'kaleidoscope', count: 4, ...SQUARE },
  p4g: { cell: 'radial', count: 4, glide: true, glideRows: true, ...CENTERED_SQUARE },
  p3: { cell: 'radial', count: 3, ...HEXAGON },
  p3m1: { cell: 'kaleidoscope', count: 3, cellAngle: Math.PI / 2, ...HEXAGON },
  p31m: { cell: 'kaleidoscope', count: 3, ...HEXAGON },
  p6: { cell: 'radial', count: 6, ...HEXAGON },
  p6m: { cell: 'kaleidoscope', count: 6, ...HEXAGON },
};

/** The spec fields that make a wallpaper of group `name`, stepping `spacing`
 *  apart. Its angle, center and extent are left as they are. */
export function wallpaperSpec(name: WallpaperGroup, spacing: number): Partial<SymmetrySpec> {
  const p = WALLPAPER_GROUPS[name];
  return {
    kind: 'wallpaper',
    cell: p.cell,
    ...(p.count !== undefined ? { count: p.count } : {}),
    cellAngle: p.cellAngle ?? 0,
    glide: p.glide ?? false,
    glideRows: p.glideRows ?? false,
    spacing,
    rowAngle: p.rowAngle,
    rowSpacing: spacing * p.rowRatio,
  };
}
