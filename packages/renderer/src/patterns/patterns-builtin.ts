/**
 * Built-in pattern factories — generic line/dot/scatter textures. Each
 * returns a `TextureHandle` you can wrap in a `Paint` of
 * `{ kind: 'texture', texture }`. Imported from a subpath so consumers that
 * ship their own catalog can avoid the bundle cost.
 *
 * All factories require an explicit `color`; no defaults are baked in.
 *
 * Prefer a tile paint (`{ kind: 'hatch', color }`) over calling these directly —
 * it serializes, a `TextureHandle` does not.
 *
 * @packageDocumentation
 */

export { tileGeometry, tileSize, drawTileShapes } from './tileGeometry';
export type { TileShape, TileGeometry } from './tileGeometry';

import { createTilePattern } from './';
import { tileGeometry, drawTileShapes, tileSize } from './tileGeometry';
import type { TilePatternSpec } from '@weasel-js/paint';
import type { TextureHandle } from '../textures/registerTexture';

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
  return build({ kind: 'hatch', ...params });
}

/** Diagonal hatch in both directions. */
export interface CrosshatchParams {
  color: string;
  size?: number;
  lineWidth?: number;
}

/** Build a crosshatch pattern texture. */
export function crosshatch(params: CrosshatchParams): TextureHandle | null {
  return build({ kind: 'crosshatch', ...params });
}

/** Regular grid of filled dots. */
export interface DotsParams {
  color: string;
  size?: number;
  radius?: number;
}

/** Build a dot-grid pattern texture. */
export function dots(params: DotsParams): TextureHandle | null {
  return build({ kind: 'dots', ...params });
}

/**
 * Random scatter of small ellipses on top of a solid background. Driven by a
 * seeded PRNG so the same `seed` produces a deterministic tile. Omit `bg` for
 * a transparent background.
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
  return build({ kind: 'chunks', ...params });
}
