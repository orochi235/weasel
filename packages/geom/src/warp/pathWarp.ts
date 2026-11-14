/**
 * A warp as data: what a shape was warped by, held beside the shape so the
 * warp can be edited again later. Each kind names its controls in the same
 * space as the path it warps.
 */
import type { PolygonPath } from '../path';
import type { Point } from '../paths/cubicMath';
import { meshGridFrom, meshGridOver, bicubicMesh, coonsMesh, type MeshGrid } from './mesh';
import { pinWarpMap, type WarpPin } from './pinWarp';
import { bilinearQuad, projectiveQuad, type Quad, type UvMap } from './quad';
import { warpPath } from './warpPath';

/** An axis-aligned box: the area a plane warp or a cloth warp was laid over. */
export interface WarpBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How a plane warp maps its box onto its corners. `free` is bilinear, and bends
 *  straight lines; `perspective` is projective, and keeps them straight. */
export type PlaneMode = 'free' | 'perspective';

/** How a cloth warp interpolates its mesh. See `bicubicMesh` and `coonsMesh`. */
export type ClothMapping = 'bicubic' | 'coons';

/** The box's four corners, each dragged on its own. */
export interface PlaneWarp {
  kind: 'plane';
  mode: PlaneMode;
  box: WarpBox;
  /** Where the box's top-left, top-right, bottom-right and bottom-left went. */
  corners: Quad;
}

/** A grid of control points laid over the box. */
export interface ClothWarp {
  kind: 'cloth';
  mapping: ClothMapping;
  box: WarpBox;
  mesh: MeshGrid;
}

/** Pins on the shape, each dragged on its own. */
export interface PinWarp {
  kind: 'pin';
  pins: readonly WarpPin[];
}

/** Any of the warps a path can hold. */
export type PathWarp = PlaneWarp | ClothWarp | PinWarp;

/** A plane warp over `box` that leaves it where it is. */
export function planeOver(box: WarpBox, mode: PlaneMode = 'free'): PlaneWarp {
  const { x, y, width: w, height: h } = box;
  return {
    kind: 'plane',
    mode,
    box: { ...box },
    corners: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
  };
}

/** A cloth warp of `rows` × `cols` patches over `box` that leaves it where it is. */
export function clothOver(
  box: WarpBox,
  rows: number,
  cols: number,
  mapping: ClothMapping = 'bicubic',
): ClothWarp {
  return { kind: 'cloth', mapping, box: { ...box }, mesh: meshGridOver(box, rows, cols) };
}

/** `warp` with a mesh of `rows` × `cols` patches, placed where the current
 *  mesh carries an even grid, so the shape changes as little as a coarser or
 *  finer grid allows. */
export function resizeCloth(warp: ClothWarp, rows: number, cols: number): ClothWarp {
  if (warp.mesh.rows === rows && warp.mesh.cols === cols) return warp;
  return { ...warp, mesh: meshGridFrom(clothUvMap(warp), rows, cols) };
}

function clothUvMap(warp: ClothWarp): UvMap {
  return warp.mapping === 'coons' ? coonsMesh(warp.mesh) : bicubicMesh(warp.mesh);
}

function boxUv(box: WarpBox, uv: UvMap): (p: Point) => Point {
  const sx = box.width === 0 ? 0 : 1 / box.width;
  const sy = box.height === 0 ? 0 : 1 / box.height;
  return (p) => uv((p.x - box.x) * sx, (p.y - box.y) * sy);
}

/**
 * Where `warp`, laid over `source`, sends each point of the plane. A
 * perspective plane warp whose corners no longer make a convex quad has no
 * projective map, and falls back to the bilinear one until they do. Only a
 * pin warp reads `source`: its pins pull through the shape's fill.
 */
export function pathWarpMap(warp: PathWarp, source: PolygonPath): (p: Point) => Point {
  switch (warp.kind) {
    case 'plane': {
      const uv = (warp.mode === 'perspective' ? projectiveQuad(warp.corners) : null) ?? bilinearQuad(warp.corners);
      return boxUv(warp.box, uv);
    }
    case 'cloth':
      return boxUv(warp.box, clothUvMap(warp));
    case 'pin':
      return pinWarpMap(source, warp.pins);
  }
}

/** `source` warped by `warp`, refitted within `tolerance` (`warpPath`). */
export function applyPathWarp(source: PolygonPath, warp: PathWarp, tolerance = 0.5): PolygonPath {
  return warpPath(source, pathWarpMap(warp, source), { tolerance });
}

/** The points a user drags to change `warp`: a plane warp's corners, an
 *  cloth warp's mesh points, a pin warp's pins where they are now. */
export function warpControls(warp: PathWarp): readonly Point[] {
  switch (warp.kind) {
    case 'plane': return warp.corners;
    case 'cloth': return warp.mesh.points;
    case 'pin': return warp.pins.map((p) => p.to);
  }
}

/** `warp` with control `index` (as {@link warpControls} counts them) at `to`. */
export function moveWarpControl(warp: PathWarp, index: number, to: Point): PathWarp {
  const at = { x: to.x, y: to.y };
  switch (warp.kind) {
    case 'plane': {
      const corners = [...warp.corners] as [Point, Point, Point, Point];
      if (index < 0 || index > 3) return warp;
      corners[index] = at;
      return { ...warp, corners };
    }
    case 'cloth': {
      if (index < 0 || index >= warp.mesh.points.length) return warp;
      const points = [...warp.mesh.points];
      points[index] = at;
      return { ...warp, mesh: { ...warp.mesh, points } };
    }
    case 'pin': {
      if (index < 0 || index >= warp.pins.length) return warp;
      return { ...warp, pins: warp.pins.map((p, i) => (i === index ? { from: p.from, to: at } : p)) };
    }
  }
}
