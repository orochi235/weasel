/**
 * Where tiles live: a scheme names a tile by key, answers its parent, children, level and bounds,
 * and says which keys a view wants. Boxes are `[min…, max…]` in the scheme's own dimension, so a
 * scheme over a plane, a cube's faces or a volume fits the same cache and planner.
 */

/** A box in `dim` dimensions: `[min…, max…]`. */
export type TileBox = ArrayLike<number>;

/** One tile the view wants, and how soon: lower `priority` bakes first. */
export interface WantedTile<K> {
  readonly key: K;
  readonly priority: number;
  /** Past the screen's edge: baked ahead of a pan, never drawn. */
  readonly ring?: boolean;
}

/** The structure a tile pyramid is built on. `V` is what its view looks like. */
export interface TileScheme<K, V> {
  readonly dim: number;
  /** A string naming the tile, unique within the scheme. */
  idOf(key: K): string;
  levelOf(key: K): number;
  /** The tile one level coarser that holds this one, or null at the top. */
  parentOf(key: K): K | null;
  /** The tiles one level finer that this one holds. */
  childrenOf(key: K): readonly K[];
  /** The tile's extent, `[min…, max…]`. */
  boundsOf(key: K): Float64Array;
  /** Texels per world unit at this tile's level, on each axis. */
  texelsPerUnit(key: K): number;
  /** The tiles at `level` meeting `box`. */
  keysMeeting(box: TileBox, level: number): readonly K[];
  /** The level a view wants, given the level it showed last (or undefined). */
  levelFor(view: V, prev: number | undefined): number;
  /** The tiles `view` wants at `level`: those on screen first, nearest its center, then a ring past it. */
  wanted(view: V, level: number): readonly WantedTile<K>[];
}

/** A plane tile: `z/x/y`. At level `z` a tile covers `tilePx / 2^z` world units a side. */
export interface PlaneTileKey {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

/** What a plane scheme is asked with: the world box on screen and how many device pixels a unit covers. */
export interface PlaneTileView {
  /** `[x0, y0, x1, y1]` in world units. */
  readonly box: TileBox;
  /** Device pixels per world unit, the larger axis's. */
  readonly pxPerUnit: number;
  /** World units the view moved since the last frame, `[dx, dy]`: the ring leans that way. */
  readonly motion?: readonly [number, number];
  /** Tiles past the screen's edge to ask for. Default 1. */
  readonly ring?: number;
}

/** Of a level, how far `log2(pxPerUnit)` must pass its boundary before the level changes. */
export const LEVEL_SLACK = 1 / 16;

/** The plane scheme over tiles of `tilePx` texels a side. */
export function createPlaneScheme(tilePx = 512): TileScheme<PlaneTileKey, PlaneTileView> {
  const side = (z: number): number => tilePx / 2 ** z;
  const key = (z: number, x: number, y: number): PlaneTileKey => ({ z, x, y });
  const keysMeeting = (box: TileBox, z: number): PlaneTileKey[] => {
    const s = side(z);
    const x0 = Math.floor(box[0]! / s), y0 = Math.floor(box[1]! / s);
    const x1 = Math.ceil(box[2]! / s) - 1, y1 = Math.ceil(box[3]! / s) - 1;
    const out: PlaneTileKey[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(key(z, x, y));
    return out;
  };
  return {
    dim: 2,
    idOf: (k) => `${k.z}/${k.x}/${k.y}`,
    levelOf: (k) => k.z,
    parentOf: (k) => key(k.z - 1, Math.floor(k.x / 2), Math.floor(k.y / 2)),
    childrenOf: (k) => [key(k.z + 1, 2 * k.x, 2 * k.y), key(k.z + 1, 2 * k.x + 1, 2 * k.y),
      key(k.z + 1, 2 * k.x, 2 * k.y + 1), key(k.z + 1, 2 * k.x + 1, 2 * k.y + 1)],
    boundsOf: (k) => {
      const s = side(k.z);
      return Float64Array.of(k.x * s, k.y * s, (k.x + 1) * s, (k.y + 1) * s);
    },
    texelsPerUnit: (k) => 2 ** k.z,
    keysMeeting,
    levelFor: (view, prev) => {
      const l = Math.log2(Math.max(view.pxPerUnit, Number.MIN_VALUE));
      if (prev !== undefined && l > prev - 1 - LEVEL_SLACK && l <= prev + LEVEL_SLACK) return prev;
      return Math.ceil(l);
    },
    wanted: (view, z) => {
      const b = view.box;
      const s = side(z);
      const cx = (b[0]! + b[2]!) / 2, cy = (b[1]! + b[3]!) / 2;
      const on = keysMeeting(b, z);
      const out: WantedTile<PlaneTileKey>[] = on.map((k) => {
        const dx = (k.x + 0.5) * s - cx, dy = (k.y + 0.5) * s - cy;
        return { key: k, priority: Math.hypot(dx, dy) / s };
      });
      const ring = view.ring ?? 1;
      if (ring > 0) {
        const grown = [b[0]! - ring * s, b[1]! - ring * s, b[2]! + ring * s, b[3]! + ring * s];
        const seen = new Set(on.map((k) => `${k.x}/${k.y}`));
        const [mx, my] = view.motion ?? [0, 0];
        const ml = Math.hypot(mx, my);
        // The ring sorts after everything on screen, leaning toward where the view is heading.
        const far = on.length + 1e3;
        for (const k of keysMeeting(grown, z)) {
          if (seen.has(`${k.x}/${k.y}`)) continue;
          const dx = (k.x + 0.5) * s - cx, dy = (k.y + 0.5) * s - cy;
          const lean = ml > 0 ? -(dx * mx + dy * my) / (ml * Math.hypot(dx, dy) || 1) : 0;
          out.push({ key: k, priority: far + Math.hypot(dx, dy) / s + lean, ring: true });
        }
      }
      return out.sort((a, b2) => a.priority - b2.priority);
    },
  };
}

/** Whether boxes `a` and `b` of `dim` dimensions overlap, an edge touching counted out. */
export function boxesMeet(a: TileBox, b: TileBox, dim: number): boolean {
  for (let i = 0; i < dim; i++) if (a[i]! >= b[dim + i]! || b[i]! >= a[dim + i]!) return false;
  return true;
}

/** The plane tiles that hold `bounds` at the finest level where it spans at most `floorTiles` tiles
 *  a side: what a pyramid pins so something can always stand in. `tilePx` must be the scheme's own,
 *  and `floorTiles` at least 2, or it throws a `RangeError`. */
export function planeFloor(scheme: TileScheme<PlaneTileKey, PlaneTileView>, tilePx: number, bounds: TileBox, floorTiles = 2): PlaneTileKey[] {
  const origin = { z: 0, x: 0, y: 0 };
  const own = (scheme.boundsOf(origin)[2]! - scheme.boundsOf(origin)[0]!) * scheme.texelsPerUnit(origin);
  if (Math.abs(own - tilePx) > 1e-9 * own) throw new RangeError(`planeFloor: tilePx ${tilePx} is not the scheme's ${own}`);
  if (!(floorTiles >= 2)) throw new RangeError(`planeFloor: floorTiles ${floorTiles} must be at least 2: a box straddling a tile edge meets 2 a side`);
  const span = Math.max(bounds[2]! - bounds[0]!, bounds[3]! - bounds[1]!);
  if (!(span > 0) || !Number.isFinite(span)) return [];
  // One less than the level the span fills: a box straddling tile edges takes one more a side.
  const z = Math.floor(Math.log2((floorTiles * tilePx) / span)) - 1;
  // A side of no length meets no tile, so a line has it reach a hair past its edge.
  const box = Float64Array.from(bounds);
  for (let i = 0; i < 2; i++) if (!(box[2 + i]! > box[i]!)) box[2 + i] = box[i]! + Math.max(Math.abs(box[i]!), span) * 2 ** -40;
  return [...scheme.keysMeeting(box, z)];
}
