/**
 * The parameters a polygon or star was drawn with, kept on the node beside the
 * geometry they made (`data.generator` beside `data.path`), so the shape stays
 * editable as a polygon or a star after it is drawn.
 *
 * `data.path` stays the geometry every reader uses; the generator only says how
 * to make it again. Editing the path itself turns the shape into plain
 * geometry: the generator is dropped, since it could no longer reproduce what
 * is drawn. A generator whose path no longer matches it (a writer that changed
 * the path without dropping it) is treated the same way.
 */
import {
  boundsOfPath,
  boxToBox,
  poseFrameOf,
  regularPolygonPath,
  starPath,
  transformPath,
  originOf,
  worldCoords,
  worldEditToStorage,
  type PathInWorldPose,
  type PolygonPath,
} from '@weasel-js/geom';

/** A regular polygon's parameters. `rotation` is the angle of its first
 *  vertex, in radians, inside the pose's own rotation. */
export interface PolygonGenerator {
  kind: 'polygon';
  sides: number;
  rotation: number;
}

/** A star's parameters. `innerRadiusRatio` is the inner radius over the outer
 *  one; `rotation` is the angle of its first point, in radians, inside the
 *  pose's own rotation. */
export interface StarGenerator {
  kind: 'star';
  points: number;
  innerRadiusRatio: number;
  rotation: number;
}

/** The parameters a node's `data.path` was generated from. */
export type ShapeGenerator = PolygonGenerator | StarGenerator;

/** The range of a polygon's side count and a star's point count. */
export const SHAPE_COUNT_RANGE = { min: 3, max: 32 } as const;

/** The range of a star's `innerRadiusRatio`. */
export const STAR_RATIO_RANGE = { min: 0.01, max: 1 } as const;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Whether `v` is a well-formed {@link ShapeGenerator}. */
export function isShapeGenerator(v: unknown): v is ShapeGenerator {
  if (v === null || typeof v !== 'object') return false;
  const g = v as Record<string, unknown>;
  if (!finite(g.rotation)) return false;
  if (g.kind === 'polygon') return finite(g.sides);
  if (g.kind === 'star') return finite(g.points) && finite(g.innerRadiusRatio);
  return false;
}

/** The generator a node's `data` holds, or `null`. */
export function shapeGeneratorOf(data: unknown): ShapeGenerator | null {
  const g = (data as { generator?: unknown } | null | undefined)?.generator;
  return isShapeGenerator(g) ? g : null;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const count = (v: number): number => clamp(Math.round(v), SHAPE_COUNT_RANGE.min, SHAPE_COUNT_RANGE.max);

/** `g` with its counts rounded and every field held in range. */
export function clampShapeGenerator(g: ShapeGenerator): ShapeGenerator {
  if (g.kind === 'polygon') return { kind: 'polygon', sides: count(g.sides), rotation: g.rotation };
  return {
    kind: 'star',
    points: count(g.points),
    innerRadiusRatio: clamp(g.innerRadiusRatio, STAR_RATIO_RANGE.min, STAR_RATIO_RANGE.max),
    rotation: g.rotation,
  };
}

/** The shape `g` makes, on a circle of `radius` around `center`. */
export function shapeGeneratorPath(
  g: ShapeGenerator,
  center: { x: number; y: number } = { x: 0, y: 0 },
  radius = 1,
): PolygonPath {
  const c = clampShapeGenerator(g);
  return c.kind === 'polygon'
    ? regularPolygonPath(center, radius, c.sides, c.rotation)
    : starPath(center, radius, c.points, radius * c.innerRadiusRatio, c.rotation);
}

/** `data` without its generator: the shape as plain geometry. */
export function withoutShapeGenerator<T>(data: T): T {
  if (data === null || typeof data !== 'object' || !('generator' in data)) return data;
  const { generator: _dropped, ...rest } = data as Record<string, unknown>;
  void _dropped;
  return rest as T;
}

/** Whether `path` is what `g` makes, up to the box-to-box map storage applies. */
function pathMatches(path: unknown, g: ShapeGenerator): boolean {
  const p = path as PolygonPath | undefined;
  if (p?.kind !== 'polygon') return false;
  const unit = shapeGeneratorPath(g);
  if (p.coords.length !== unit.coords.length) return false;
  const u = boundsOfPath(unit);
  const b = boundsOfPath(p);
  const m = boxToBox(u.x, u.y, u.width, u.height, b.x, b.y, b.width, b.height);
  // Paths store float32 coordinates, so the slack scales with how far they are from the point they are measured from.
  const o = originOf(p);
  const tol = 1e-4 * Math.max(1, Math.abs(b.x - o.x) + b.width, Math.abs(b.y - o.y) + b.height);
  const at = worldCoords(p);
  for (let i = 0; i + 1 < unit.coords.length; i += 2) {
    const x = m[0] * unit.coords[i] + m[4];
    const y = m[3] * unit.coords[i + 1] + m[5];
    if (Math.abs(x - at[i]) > tol || Math.abs(y - at[i + 1]) > tol) return false;
  }
  return true;
}

/** A node's two halves, as a regeneration reads and writes them. */
export interface GeneratedShape<P extends PathInWorldPose = PathInWorldPose> {
  pose: P;
  data: unknown;
}

/**
 * `node` made again from `next`, in place: the new shape takes the box the old
 * one's circle had, under the same rotation and transform, so a star given
 * more points keeps its center and its size. Returns `null` when the node holds
 * no generator, or its path no longer matches the one it holds.
 */
export function regenerateShape<P extends PathInWorldPose>(
  node: GeneratedShape<P>,
  next: ShapeGenerator,
): GeneratedShape<P> | null {
  const held = shapeGeneratorOf(node.data);
  if (!held || !pathMatches((node.data as { path?: unknown }).path, held)) return null;
  const g = clampShapeGenerator(next);
  const was = boundsOfPath(shapeGeneratorPath(held));
  const { pose } = node;
  // Where the unit circle of the held generator lands in the pose's local frame.
  const toLocal = boxToBox(was.x, was.y, was.width, was.height, pose.x, pose.y, pose.width, pose.height);
  const local = transformPath(shapeGeneratorPath(g), toLocal) as PolygonPath;
  const frame = poseFrameOf(pose);
  const world = frame ? (transformPath(local, frame) as PolygonPath) : local;
  const stored = worldEditToStorage(pose, world);
  return { pose: stored.pose, data: { ...(node.data as object), path: stored.path, generator: g } };
}

/**
 * What a write that left a node as `next`, from `prev`, stores: when the write
 * changed the generator, the shape made again from it. A generator written
 * onto a node that held none, or of another kind, or onto one whose path no
 * longer matches, is dropped, leaving the shape as plain geometry. Any other
 * write is stored as written. Fits `NodePropertiesEntry.settle`.
 */
export function settleShapeGenerator<N extends { pose: unknown; data: unknown }>(next: N, prev: N): N {
  const data = next.data as Record<string, unknown> | null;
  if (data === null || typeof data !== 'object' || !('generator' in data)) return next;
  const raw = data.generator;
  const held = shapeGeneratorOf(prev.data);
  if (held !== null && JSON.stringify(raw) === JSON.stringify(held)) return next;
  const regenerated = held !== null && isShapeGenerator(raw) && raw.kind === held.kind
    ? regenerateShape({ pose: next.pose as PathInWorldPose, data: { ...data, generator: held } }, raw)
    : null;
  return { ...next, ...(regenerated ?? { data: withoutShapeGenerator(next.data) }) };
}
