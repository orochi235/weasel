import { resolveStrokeWidth, type CommandStroke, type DrawCommand, type View } from '@weasel-js/core';
import { PATH_L, PATH_M, pxExtent, pxExtentInFrame, type Affine, type PolygonPath } from '@weasel-js/geom';

/** An axis-aligned rectangle, in whatever coordinates a lattice is drawn in. */
export type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

/** The strokes of a lattice's three line families. */
export type LatticeStyles = { line: CommandStroke; accent: CommandStroke; sub: CommandStroke };

/** How a lattice divides: accents every N cells, sub-lines per cell. */
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

/**
 * One lattice of pitch `spacing` across `b`: its sub-lines, cell lines and
 * accents. `b` is in `frame`'s coordinates, which `frame` carries to world;
 * absent, it is world. Lines are a screen pixel wide either way.
 */
export function lattice(
  b: Rect, spacing: Point, shape: LatticeShape, view: View, styles: LatticeStyles, frame?: Affine,
): DrawCommand[] {
  const { accentEvery, subdivisions } = shape;
  const x0 = b.x;
  const y0 = b.y;
  const x1 = b.x + b.width;
  const y1 = b.y + b.height;
  // Every line runs along one of the lattice's axes, so its width runs along
  // the other, and one pixel of it is that axis's extent.
  const px = frame ? pxExtentInFrame(1, view.scale, frame) : pxExtent(1, view.scale);

  const children: DrawCommand[] = [];

  const pushSegment = (sx: number, sy: number, ex: number, ey: number, s: CommandStroke): void => {
    const path: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L]),
      coords: new Float32Array([sx, sy, ex, ey]),
      fillRule: 'nonzero',
    };
    const across = sx === ex ? px.x : px.y;
    children.push({
      kind: 'path',
      path,
      stroke: { ...s, width: resolveStrokeWidth(s.width ?? 1, 1) * across },
    });
  };

  // One family of parallel lines `step` apart, leaving out every
  // `skipEvery`th (the ones a coarser family draws), and none at all once
  // they would sit closer than MIN_SCREEN_SPACING on screen.
  const family = (axis: 'x' | 'y', step: number, skipEvery: number, s: CommandStroke): void => {
    if (!(step / px[axis] >= MIN_SCREEN_SPACING)) return;
    const [from, to] = axis === 'x' ? [x0, x1] : [y0, y1];
    for (let k = 0; from + k * step <= to + 1e-9; k++) {
      if (skipEvery > 0 && k % skipEvery === 0) continue;
      const at = from + k * step;
      if (axis === 'x') pushSegment(at, y0, at, y1, s);
      else pushSegment(x0, at, x1, at, s);
    }
  };

  const accentOn = accentEvery !== undefined && accentEvery > 0;
  for (const axis of ['x', 'y'] as const) {
    // Sub-lines first so cell lines paint on top, accents last of all.
    if (subdivisions && subdivisions > 1) family(axis, spacing[axis] / subdivisions, subdivisions, styles.sub);
  }
  for (const axis of ['x', 'y'] as const) family(axis, spacing[axis], accentOn ? accentEvery : 0, styles.line);
  if (accentOn) {
    for (const axis of ['x', 'y'] as const) family(axis, spacing[axis] * accentEvery, 0, styles.accent);
  }
  return children;
}

/**
 * Grow `r` outward to whole periods of the lattice through `anchor`, so the
 * first line drawn sits on a multiple of the pitch from it, and of the accent
 * pitch for accents.
 */
export function onLattice(r: Rect, spacing: Point, accentEvery: number, anchor: Point): Rect {
  const px = spacing.x * accentEvery;
  const py = spacing.y * accentEvery;
  const x = anchor.x + Math.floor((r.x - anchor.x) / px) * px;
  const y = anchor.y + Math.floor((r.y - anchor.y) / py) * py;
  return {
    x,
    y,
    width: anchor.x + Math.ceil((r.x + r.width - anchor.x) / px) * px - x,
    height: anchor.y + Math.ceil((r.y + r.height - anchor.y) / py) * py - y,
  };
}
