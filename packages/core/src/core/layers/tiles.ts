/** What marks a canvas layer tiled, and how a tiled layer learns what an edit changed. */
import type { TileBox } from '@weasel-js/tiles';

/** Where a tiled layer's content changed since the host last asked. */
export interface TileDamage {
  /** The boxes changed since the last call, `'all'` when anything may have, or `[]` for nothing. */
  since(): 'all' | readonly TileBox[];
}

/**
 * How a layer is kept as a tile pyramid: its pixels baked into square tiles at power-of-two
 * scales in its own world space, so a zoom draws tiles it holds and bakes only what is missing,
 * under a frame budget, a coarser tile standing in meanwhile. See `docs/concepts.md`, "Tiled layers".
 */
export interface TileOptions {
  /** A tile's side in texels. Default 512. */
  tilePx?: number;
  /** The finest level. Past it the layer draws live, so a deep zoom stays sharp. */
  maxLevel?: number;
  /** The floor, the level pinned so something can always stand in, holds the layer's whole reach in
   *  at most this many tiles a side, at least 2. Default 2. */
  floorTiles?: number;
  /** Crossfade length. Default 160. */
  fadeMs?: number;
  /** Where the layer's content lies, `[x0, y0, x1, y1]` in world units, for the floor: absent or
   *  null, there is no floor, and nothing stands in for a tile until it is baked. */
  bounds?: () => TileBox | null;
  /** Where its content changed. Without one, only the layer's `deps` moving stales its tiles, all of
   *  them, and a layer with neither is taken to be still. */
  damage?: TileDamage;
}

/** What a canvas's tiled layers share: the frame budget and the GPU bound. */
export interface TileBudgetOptions {
  /** Milliseconds a frame may spend baking, shared by every tiled layer. Default 10. */
  ms?: number;
  /** Tiles a frame may bake at most, which caps the GPU work a clock cannot see. Default 4. */
  tiles?: number;
  /** Bytes every tiled layer of the canvas may hold. Default 256 MiB. */
  bytes?: number;
}

/** A tile's side in texels, without its gutter, when `TileOptions.tilePx` is unset. */
export const DEFAULT_TILE_PX = 512;
/** What a canvas's tiled layers share when `TileBudgetOptions` leaves a field unset: 10 ms and 4 tiles a frame, and 256 MiB of tiles. */
export const DEFAULT_TILE_BUDGET = { ms: 10, tiles: 4, bytes: 256 * 1024 * 1024 } as const;
