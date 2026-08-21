/**
 * Built-in pattern factories — generic line/dot/scatter textures. Each
 * returns a `TextureHandle` you can wrap in a `FillStyle` of
 * `{ fill: 'pattern', pattern }` and pass to anything that accepts a `FillStyle`
 * (`FillStyle`-aware layers, path fills, etc.).
 * Imported from a subpath so consumers that ship their own catalog can
 * avoid the bundle cost.
 *
 * All factories require an explicit `color` (and `bg` for `chunks`). No
 * defaults are baked in — the caller's design system is the source of truth
 * for palette decisions.
 *
 * Each is a thin wrapper over `tileGeometry`, which describes the tile as
 * shapes so `@weasel-js/svg` can emit the same tile as a `<pattern>`.
 * Prefer naming a tile in a `TilePatternSpec` over calling these directly —
 * a spec serializes, a `TextureHandle` does not.
 */

export { tileGeometry, tileSize, drawTileShapes } from './tileGeometry';
export type { TileShape, TileGeometry } from './tileGeometry';

import { createTilePattern } from '.';
import { tileGeometry, drawTileShapes, tileSize } from './tileGeometry';
import type { TilePatternSpec } from '../../core/paint-types';
import type { TextureHandle } from '../../renderer/textures/registerTexture';

function build(spec: TilePatternSpec): TextureHandle | null {
  const geometry = tileGeometry(spec);
  return createTilePattern({
    size: tileSize(spec),
    draw: (oc) => drawTileShapes(oc, geometry),
  });
}

/** Diagonal hatch (forward slash). */
export interface HatchParams {
  color: string;
  size?: number;
  lineWidth?: number;
}

/** Build a diagonal-hatch pattern texture. */
export function hatch(params: HatchParams): TextureHandle | null {
  return build({ tile: 'hatch', ...params });
}

/** Diagonal hatch in both directions. */
export interface CrosshatchParams {
  color: string;
  size?: number;
  lineWidth?: number;
}

/** Build a crosshatch pattern texture. */
export function crosshatch(params: CrosshatchParams): TextureHandle | null {
  return build({ tile: 'crosshatch', ...params });
}

/** Regular grid of filled dots. */
export interface DotsParams {
  color: string;
  size?: number;
  radius?: number;
}

/** Build a dot-grid pattern texture. */
export function dots(params: DotsParams): TextureHandle | null {
  return build({ tile: 'dots', ...params });
}

/**
 * Random scatter of small ellipses on top of a solid background. Driven by a
 * seeded PRNG so the same `seed` produces a deterministic tile.
 *
 * Note: the `bg` field is optional — omit it for a transparent background
 * (the scatter shapes draw directly onto whatever sits beneath the overlay).
 */
export interface ChunksParams {
  color: string;
  bg?: string;
  size?: number;
  /** Coverage: `chunks * chunkSize²` per `size²` tile. Range ~[0, 1]. */
  density?: number;
  chunkSize?: number;
  seed?: number;
}

/** Build a seeded random-scatter pattern texture. */
export function chunks(params: ChunksParams): TextureHandle | null {
  return build({ tile: 'chunks', ...params });
}
