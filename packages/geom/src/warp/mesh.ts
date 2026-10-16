/**
 * Maps from the unit square through a grid of control points: an envelope
 * mesh. The grid's points are interpolated, so a grid laid evenly over a box
 * maps the box onto itself.
 */
import type { Point } from '../paths/cubicMath';
import type { UvMap } from './quad';

/** A grid of `rows` × `cols` patches: `(rows + 1) × (cols + 1)` points, row by
 *  row from the top. */
export interface MeshGrid {
  rows: number;
  cols: number;
  points: readonly Point[];
}

/** An even grid of `rows` × `cols` patches over the box. */
export function meshGridOver(
  box: { x: number; y: number; width: number; height: number },
  rows: number,
  cols: number,
): MeshGrid {
  return meshGridFrom((u, v) => ({ x: box.x + u * box.width, y: box.y + v * box.height }), rows, cols);
}

/** A grid of `rows` × `cols` patches whose points are where `map` sends an
 *  even grid over the unit square — a mesh resampled at a new resolution. */
export function meshGridFrom(map: UvMap, rows: number, cols: number): MeshGrid {
  const r = Math.max(1, Math.round(rows));
  const c = Math.max(1, Math.round(cols));
  const points: Point[] = [];
  for (let i = 0; i <= r; i++) {
    for (let j = 0; j <= c; j++) points.push(map(j / c, i / r));
  }
  return { rows: r, cols: c, points };
}

/** The grid point at row `i`, column `j`, extended past the edges along the
 *  line through the last two, so the spline through the edge runs straight. */
function gridPoint(grid: MeshGrid, i: number, j: number): Point {
  if (i < 0) return extend(gridPoint(grid, 0, j), gridPoint(grid, 1, j));
  if (i > grid.rows) return extend(gridPoint(grid, grid.rows, j), gridPoint(grid, grid.rows - 1, j));
  if (j < 0) return extend(gridPoint(grid, i, 0), gridPoint(grid, i, 1));
  if (j > grid.cols) return extend(gridPoint(grid, i, grid.cols), gridPoint(grid, i, grid.cols - 1));
  return grid.points[i * (grid.cols + 1) + j];
}

const extend = (edge: Point, inner: Point): Point => ({ x: 2 * edge.x - inner.x, y: 2 * edge.y - inner.y });

/** The uniform Catmull-Rom spline through four values, between the middle two. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t2 * t);
}

function catmullRomPoint(p: readonly Point[], t: number): Point {
  return {
    x: catmullRom(p[0].x, p[1].x, p[2].x, p[3].x, t),
    y: catmullRom(p[0].y, p[1].y, p[2].y, p[3].y, t),
  };
}

/** Which patch `u` (or `v`) falls in out of `n`, and where in it. */
function cellOf(s: number, n: number): [number, number] {
  const k = Math.min(n - 1, Math.max(0, Math.floor(s * n)));
  return [k, s * n - k];
}

/**
 * The smooth surface through every grid point: a Catmull-Rom spline along each
 * row, and another down the columns through those. Bending one point bends its
 * neighborhood smoothly, across patch edges included.
 */
export function bicubicMesh(grid: MeshGrid): UvMap {
  return (u, v) => {
    const [j, s] = cellOf(u, grid.cols);
    const [i, t] = cellOf(v, grid.rows);
    const across: Point[] = [];
    for (let di = -1; di <= 2; di++) {
      across.push(catmullRomPoint([-1, 0, 1, 2].map((dj) => gridPoint(grid, i + di, j + dj)), s));
    }
    return catmullRomPoint(across, t);
  };
}

/**
 * One Coons patch per grid cell: the cell's four edges are the splines through
 * the grid lines, and its inside is blended from those edges alone. Edges
 * match the bicubic surface; the inside follows them more literally, without
 * the bicubic surface's pull from points beyond the cell.
 */
export function coonsMesh(grid: MeshGrid): UvMap {
  const row = (i: number, j: number, s: number) =>
    catmullRomPoint([-1, 0, 1, 2].map((dj) => gridPoint(grid, i, j + dj)), s);
  const col = (i: number, j: number, t: number) =>
    catmullRomPoint([-1, 0, 1, 2].map((di) => gridPoint(grid, i + di, j)), t);
  return (u, v) => {
    const [j, s] = cellOf(u, grid.cols);
    const [i, t] = cellOf(v, grid.rows);
    const top = row(i, j, s);
    const bottom = row(i + 1, j, s);
    const left = col(i, j, t);
    const right = col(i, j + 1, t);
    const p00 = gridPoint(grid, i, j);
    const p10 = gridPoint(grid, i, j + 1);
    const p01 = gridPoint(grid, i + 1, j);
    const p11 = gridPoint(grid, i + 1, j + 1);
    const blend = (k: 'x' | 'y') =>
      (1 - t) * top[k] + t * bottom[k] + (1 - s) * left[k] + s * right[k]
      - ((1 - s) * (1 - t) * p00[k] + s * (1 - t) * p10[k] + (1 - s) * t * p01[k] + s * t * p11[k]);
    return { x: blend('x'), y: blend('y') };
  };
}
