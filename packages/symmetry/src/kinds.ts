import { multiply, rotate, translate, type Affine, type Point } from '@weasel-js/geom';

/** Which copies a symmetry group draws. */
export type SymmetryKind = 'mirror' | 'both' | 'point' | 'radial' | 'kaleidoscope' | 'repeat';

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
   *  `radial` and `kaleidoscope`, places along the line for `repeat`. */
  count: number;
  /** World distance from one repeat to the next. */
  spacing: number;
  /** `repeat` only: every other repeat is mirrored across the line it steps
   *  along, a glide reflection. */
  glide: boolean;
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

/** One kind: how its copies are built, and whether they form a finite group —
 *  one a path can be its own image under, which a repeat's never can. */
export interface SymmetryKindDef {
  readonly label: string;
  readonly group: boolean;
  transforms(spec: SymmetrySpec, c: Point): Affine[];
}

/**
 * Every kind, by name. A new kind, a wallpaper tiling say, is a row here: the
 * group, the guide layer and the controls all read the table.
 */
export const SYMMETRY_KINDS: Readonly<Record<SymmetryKind, SymmetryKindDef>> = {
  mirror: { label: 'Mirror', group: true, transforms: (s, c) => [mirrorAcross(c, s.angle)] },
  both: {
    label: 'Both axes',
    group: true,
    transforms: (s, c) => [mirrorAcross(c, s.angle), mirrorAcross(c, s.angle + Math.PI / 2), turnAbout(c, Math.PI)],
  },
  point: { label: 'Point', group: true, transforms: (_s, c) => [turnAbout(c, Math.PI)] },
  radial: { label: 'Radial', group: true, transforms: (s, c) => turns(c, wedges(s)) },
  kaleidoscope: {
    label: 'Kaleidoscope',
    group: true,
    transforms: (s, c) => {
      const n = wedges(s);
      return [...turns(c, n), ...Array.from({ length: n }, (_, k) => mirrorAcross(c, s.angle + (Math.PI * k) / n))];
    },
  },
  repeat: {
    label: 'Repeat',
    group: false,
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
};

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
