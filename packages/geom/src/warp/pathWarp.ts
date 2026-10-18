/**
 * A warp as data: what a shape was warped by, held beside the shape so the
 * warp can be edited again later. Each kind names its controls in the same
 * space as the path it warps.
 */
import type { PolygonPath } from '../path';
import type { Point } from '../paths/cubicMath';
import { meshGridFrom, meshGridOver, bicubicMesh, coonsMesh, type MeshGrid } from './mesh';
import { puppetMap, type PuppetPin } from './puppet';
import { bilinearQuad, projectiveQuad, type Quad, type UvMap } from './quad';
import { warpPath } from './warpPath';

/** An axis-aligned box: the area a distort or an envelope was laid over. */
export interface WarpBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How a distort maps its box onto its corners. `free` is bilinear, and bends
 *  straight lines; `perspective` is projective, and keeps them straight. */
export type DistortMode = 'free' | 'perspective';

/** How an envelope interpolates its mesh. See `bicubicMesh` and `coonsMesh`. */
export type EnvelopeMapping = 'bicubic' | 'coons';

/** The box's four corners, each dragged on its own. */
export interface DistortWarp {
  kind: 'distort';
  mode: DistortMode;
  box: WarpBox;
  /** Where the box's top-left, top-right, bottom-right and bottom-left went. */
  corners: Quad;
}

/** A grid of control points laid over the box. */
export interface EnvelopeWarp {
  kind: 'envelope';
  mapping: EnvelopeMapping;
  box: WarpBox;
  mesh: MeshGrid;
}

/** Pins on the shape, each dragged on its own. */
export interface PuppetWarp {
  kind: 'puppet';
  pins: readonly PuppetPin[];
}

/** Any of the warps a path can hold. */
export type PathWarp = DistortWarp | EnvelopeWarp | PuppetWarp;

/** A distort over `box` that leaves it where it is. */
export function distortOver(box: WarpBox, mode: DistortMode = 'free'): DistortWarp {
  const { x, y, width: w, height: h } = box;
  return {
    kind: 'distort',
    mode,
    box: { ...box },
    corners: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
  };
}

/** An envelope of `rows` × `cols` patches over `box` that leaves it where it is. */
export function envelopeOver(
  box: WarpBox,
  rows: number,
  cols: number,
  mapping: EnvelopeMapping = 'bicubic',
): EnvelopeWarp {
  return { kind: 'envelope', mapping, box: { ...box }, mesh: meshGridOver(box, rows, cols) };
}

/** `warp` with a mesh of `rows` × `cols` patches, placed where the current
 *  mesh carries an even grid, so the shape changes as little as a coarser or
 *  finer grid allows. */
export function resizeEnvelope(warp: EnvelopeWarp, rows: number, cols: number): EnvelopeWarp {
  if (warp.mesh.rows === rows && warp.mesh.cols === cols) return warp;
  return { ...warp, mesh: meshGridFrom(envelopeUvMap(warp), rows, cols) };
}

function envelopeUvMap(warp: EnvelopeWarp): UvMap {
  return warp.mapping === 'coons' ? coonsMesh(warp.mesh) : bicubicMesh(warp.mesh);
}

function boxUv(box: WarpBox, uv: UvMap): (p: Point) => Point {
  const sx = box.width === 0 ? 0 : 1 / box.width;
  const sy = box.height === 0 ? 0 : 1 / box.height;
  return (p) => uv((p.x - box.x) * sx, (p.y - box.y) * sy);
}

/**
 * Where `warp`, laid over `source`, sends each point of the plane. A
 * perspective distort whose corners no longer make a convex quad has no
 * projective map, and falls back to the bilinear one until they do. Only a
 * puppet reads `source`: its pins pull through the shape's fill.
 */
export function pathWarpMap(warp: PathWarp, source: PolygonPath): (p: Point) => Point {
  switch (warp.kind) {
    case 'distort': {
      const uv = (warp.mode === 'perspective' ? projectiveQuad(warp.corners) : null) ?? bilinearQuad(warp.corners);
      return boxUv(warp.box, uv);
    }
    case 'envelope':
      return boxUv(warp.box, envelopeUvMap(warp));
    case 'puppet':
      return puppetMap(source, warp.pins);
  }
}

/** `source` warped by `warp`, refitted within `tolerance` (`warpPath`). */
export function applyPathWarp(source: PolygonPath, warp: PathWarp, tolerance = 0.5): PolygonPath {
  return warpPath(source, pathWarpMap(warp, source), { tolerance });
}

/** The points a user drags to change `warp`: a distort's corners, an
 *  envelope's mesh points, a puppet's pins where they are now. */
export function warpControls(warp: PathWarp): readonly Point[] {
  switch (warp.kind) {
    case 'distort': return warp.corners;
    case 'envelope': return warp.mesh.points;
    case 'puppet': return warp.pins.map((p) => p.to);
  }
}

/** `warp` with control `index` (as {@link warpControls} counts them) at `to`. */
export function moveWarpControl(warp: PathWarp, index: number, to: Point): PathWarp {
  const at = { x: to.x, y: to.y };
  switch (warp.kind) {
    case 'distort': {
      const corners = [...warp.corners] as [Point, Point, Point, Point];
      if (index < 0 || index > 3) return warp;
      corners[index] = at;
      return { ...warp, corners };
    }
    case 'envelope': {
      if (index < 0 || index >= warp.mesh.points.length) return warp;
      const points = [...warp.mesh.points];
      points[index] = at;
      return { ...warp, mesh: { ...warp.mesh, points } };
    }
    case 'puppet': {
      if (index < 0 || index >= warp.pins.length) return warp;
      return { ...warp, pins: warp.pins.map((p, i) => (i === index ? { from: p.from, to: at } : p)) };
    }
  }
}
