import { multiply, rotate, translate, type Affine, type Point } from '@weasel-js/geom';
import { MAX_WALLPAPER_COPIES, latticePoints } from './wallpaper';

/** Which copies a symmetry group draws. */
export type SymmetryKind = 'mirror' | 'both' | 'point' | 'radial' | 'kaleidoscope' | 'repeat' | 'wallpaper';

/** What a wallpaper draws about each of its lattice points: one of the kinds
 *  that turn or reflect about a point, or `none` for the lattice alone. */
export type WallpaperCell = 'none' | 'mirror' | 'both' | 'point' | 'radial' | 'kaleidoscope';

/** A box in world units from a group's center. */
export interface SymmetryExtent {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Everything a symmetry group's copies are built from, besides its center.
 * Each kind reads only the fields it needs, so switching kind keeps the rest.
 */
export interface SymmetrySpec {
  kind: SymmetryKind;
  /**
   * Radians, measured from +x toward +y, which is clockwise on screen. The
   * axis a mirror reflects across, the first of `both`'s two axes and of a
   * kaleidoscope's mirrors, and the direction a repeat steps in.
   * {@link VERTICAL_AXIS} mirrors left and right, {@link HORIZONTAL_AXIS}
   * top and bottom.
   */
  angle: number;
  /** How many there are, the original included: wedges round the center for
   *  `radial` and `kaleidoscope` and a wallpaper cell of either, places along
   *  the line for `repeat`. */
  count: number;
  /** World distance from one repeat to the next, and from one wallpaper
   *  lattice point to the next along its rows. */
  spacing: number;
  /** For `repeat`, every other repeat is mirrored across the line it steps
   *  along, a glide reflection. For `wallpaper`, every other column is, across
   *  the row it steps along. */
  glide: boolean;
  /** `wallpaper` only: what each lattice point draws about itself. */
  cell: WallpaperCell;
  /** `wallpaper` only: radians the cell's axis turns from `angle`. */
  cellAngle: number;
  /** `wallpaper` only: radians from `angle` to the direction one row steps
   *  to the next, a quarter turn for rows square to it and a sixth of a turn
   *  for a hexagonal lattice. */
  rowAngle: number;
  /** `wallpaper` only: world distance from one row to the next, along `rowAngle`. */
  rowSpacing: number;
  /** `wallpaper` only: the box the lattice fills, from the center. A copy is
   *  drawn at every lattice point inside it, the original wherever it is. */
  extent: SymmetryExtent;
}

/** The angle of an axis running up and down the screen. */
export const VERTICAL_AXIS = Math.PI / 2;
/** The angle of an axis running across the screen. */
export const HORIZONTAL_AXIS = 0;

/** A mirror across the vertical axis, with the other fields at their defaults. */
export const DEFAULT_SYMMETRY: SymmetrySpec = {
  kind: 'mirror',
  angle: VERTICAL_AXIS,
  count: 6,
  spacing: 120,
  glide: false,
  cell: 'none',
  cellAngle: 0,
  rowAngle: Math.PI / 2,
  rowSpacing: 120,
  extent: { x: -360, y: -240, width: 720, height: 480 },
};

/** `Math.cos` and `Math.sin` leave 1e-16 where a quarter turn has an exact
 *  0, which a preset axis then carries into every coordinate it mirrors. */
const exact = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : v);

const about = (c: Point, m: Affine): Affine => multiply(translate(c.x, c.y), multiply(m, translate(-c.x, -c.y)));

/** The reflection across the line through `c` at `angle`. */
export function mirrorAcross(c: Point, angle: number): Affine {
  const cos = exact(Math.cos(2 * angle));
  const sin = exact(Math.sin(2 * angle));
  return about(c, [cos, sin, sin, -cos, 0, 0]);
}

/** The rotation by `angle` about `c`. */
export function turnAbout(c: Point, angle: number): Affine {
  const [a, b, cc, d] = rotate(angle);
  return about(c, [exact(a), exact(b), exact(cc), exact(d), 0, 0]);
}

const turns = (c: Point, n: number): Affine[] =>
  Array.from({ length: Math.max(0, n - 1) }, (_, k) => turnAbout(c, (2 * Math.PI * (k + 1)) / n));

/** One kind: how its copies are built, and which of them keep the center
 *  where it is. */
export interface SymmetryKindDef {
  readonly label: string;
  transforms(spec: SymmetrySpec, c: Point): Affine[];
  /**
   * The copies that turn or reflect about the center, the identity not among
   * them: a finite group, so a path can be its own image under them, and an
   * edit keeps it so. All of them for a kind that turns or reflects, a
   * wallpaper's cell, and none for a repeat.
   */
  pointGroup(spec: SymmetrySpec, c: Point): Affine[];
}

const ID: Affine = [1, 0, 0, 1, 0, 0];
const none = (): Affine[] => [];

/** A kind whose copies are all about the center: its point group is all of them. */
const finite = (label: string, transforms: SymmetryKindDef['transforms']): SymmetryKindDef =>
  ({ label, transforms, pointGroup: transforms });

/**
 * Every kind, by name. A new kind is a row here: the group, the guide layer
 * and the controls all read the table.
 */
export const SYMMETRY_KINDS: Readonly<Record<SymmetryKind, SymmetryKindDef>> = {
  mirror: finite('Mirror', (s, c) => [mirrorAcross(c, s.angle)]),
  both: finite('Both axes', (s, c) => [mirrorAcross(c, s.angle), mirrorAcross(c, s.angle + Math.PI / 2), turnAbout(c, Math.PI)]),
  point: finite('Point', (_s, c) => [turnAbout(c, Math.PI)]),
  radial: finite('Radial', (s, c) => turns(c, wedges(s))),
  kaleidoscope: finite('Kaleidoscope', (s, c) => {
    const n = wedges(s);
    return [...turns(c, n), ...Array.from({ length: n }, (_, k) => mirrorAcross(c, s.angle + (Math.PI * k) / n))];
  }),
  repeat: {
    label: 'Repeat',
    pointGroup: none,
    transforms: (s, c) => {
      const dx = exact(Math.cos(s.angle)) * s.spacing;
      const dy = exact(Math.sin(s.angle)) * s.spacing;
      const glide = mirrorAcross(c, s.angle);
      return Array.from({ length: Math.max(0, Math.round(s.count) - 1) }, (_, i) => {
        const k = i + 1;
        const step = translate(k * dx, k * dy);
        return s.glide && k % 2 === 1 ? multiply(step, glide) : step;
      });
    },
  },
  wallpaper: {
    label: 'Wallpaper',
    pointGroup: (s, c) => cellTransforms(s, c),
    transforms: (s, c) => {
      const cell = [ID, ...cellTransforms(s, c)];
      const glide = s.glide ? mirrorAcross(c, s.angle) : null;
      const out: Affine[] = [];
      for (const p of latticePoints(s, Math.floor((MAX_WALLPAPER_COPIES + 1) / cell.length))) {
        const home = p.i === 0 && p.j === 0;
        const step = translate(p.x, p.y);
        const to = glide && p.i % 2 !== 0 ? multiply(step, glide) : step;
        for (const g of cell) {
          if (home) {
            if (g !== ID) out.push(g);
          } else out.push(multiply(to, g));
        }
      }
      return out;
    },
  },
};

/** What a wallpaper's cell draws about the center, its axis turned by `cellAngle`. */
function cellTransforms(s: SymmetrySpec, c: Point): Affine[] {
  return s.cell === 'none' ? [] : SYMMETRY_KINDS[s.cell].transforms({ ...s, angle: s.angle + s.cellAngle }, c);
}

/** The wedge count a radial kind uses: at least one, a whole number. */
function wedges(s: SymmetrySpec): number {
  return Math.max(1, Math.round(s.count));
}

/**
 * The copies `spec` draws about `center`, as world affines, the original not
 * among them. For a kind that forms a group this is the whole group less its
 * identity.
 */
export function symmetryTransforms(spec: SymmetrySpec, center: Point): Affine[] {
  return SYMMETRY_KINDS[spec.kind].transforms(spec, center);
}
