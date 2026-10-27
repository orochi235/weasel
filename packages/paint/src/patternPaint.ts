/**
 * The pattern members of `Paint`: the built-in tiles, each its own kind,
 * `image` for a tile that is a picture, and `texture` for a tile the consumer
 * rasterized itself.
 */

import type { Paint, PaintUnits } from './paint';
import type { PatternTransform } from './patternTransform';
import type { TextureHandle } from './texture';

/**
 * Where a pattern's tile sits, shared by every pattern kind.
 *
 * `units` names the space the tile's origin and scale live in, not the space
 * of any geometry (a pattern has none). Under `'bounds'` the tile anchors to
 * the painted node's box, so the pattern travels with the node and a resize
 * reveals more tiles rather than stretching them; `fillInPoseFrame` resolves
 * that to a `'local'` paint with an explicit `origin` before the renderer
 * sees it.
 *
 * `transform` rotates, scales or skews the tile about `origin` (SVG's
 * `patternTransform`, less its translation). See `PatternTransform`.
 */
export interface PatternPlacement {
  units?: PaintUnits;
  origin?: { x: number; y: number };
  transform?: PatternTransform;
  opacity?: number;
}

/**
 * A built-in tile, described as plain data: what a tile paint says about the
 * tile itself, apart from where it sits. `resolvePatternSpec()` turns one into
 * a `TextureHandle` at paint time, memoized so identical specs share a texture.
 *
 * `size` is the tile's edge length, and doubles as its extent in paint
 * space — a bigger `size` rasterizes a bigger tile rather than magnifying
 * a small one, which is why there is no separate scale field.
 */
export type TilePatternSpec =
  | { kind: 'hatch'; color: string; size?: number; lineWidth?: number }
  | { kind: 'crosshatch'; color: string; size?: number; lineWidth?: number }
  | { kind: 'dots'; color: string; size?: number; radius?: number }
  | {
    kind: 'chunks';
    color: string;
    /** Omit for a transparent tile background. */
    bg?: string;
    size?: number;
    density?: number;
    chunkSize?: number;
    seed?: number;
  };

/** The built-in tile kinds. */
export type TileKind = TilePatternSpec['kind'];

/** A paint of one of the built-in tiles. Plain data, so it survives
 *  serialization. */
export type TilePaint = TilePatternSpec & PatternPlacement;

/**
 * A tile's extent in paint-space units. Either side omitted takes the
 * source's own pixel size on that axis.
 */
export interface TileExtent {
  width?: number;
  height?: number;
}

/**
 * A paint that repeats a picture. `src` is anything an `<img>` loads — a URL,
 * a `blob:` URL, or a `data:` URI — and is the paint's whole record of the
 * image, so a paint holding a `data:` URI persists and exports with no
 * storage beside it. Until the image decodes the fill draws nothing.
 */
export type ImagePatternPaint = { kind: 'image'; src: string } & TileExtent & PatternPlacement;

/**
 * A paint of a tile the consumer built itself via `createTilePattern()`. The
 * handle is a session-scoped registry key, so a paint carrying one cannot be
 * persisted or exported; prefer a tile kind, or `image` for a picture.
 */
export type TexturePaint = { kind: 'texture'; texture: TextureHandle } & TileExtent & PatternPlacement;

/** Every paint that repeats a tile. */
export type PatternPaint = TilePaint | ImagePatternPaint | TexturePaint;

/** The pattern kinds a renderer cannot draw as they stand: each is resolved
 *  to a `texture` paint first. */
export type ResolvablePatternKind = TileKind | 'image';

/** The built-in tile kinds, in the order a picker offers them. */
export const TILE_KINDS: readonly TileKind[] = ['hatch', 'crosshatch', 'dots', 'chunks'];

const TILE_KIND_SET: ReadonlySet<string> = new Set(TILE_KINDS);

/** Whether `kind` names a built-in tile. */
export function isTileKind(kind: string | undefined): kind is TileKind {
  return kind !== undefined && TILE_KIND_SET.has(kind);
}

/** Whether a paint is one of the built-in tiles. */
export function isTilePaint(paint: Paint): paint is TilePaint {
  return isTileKind(paint.kind);
}

/** Whether a paint repeats a picture. */
export function isImagePatternPaint(paint: Paint): paint is ImagePatternPaint {
  return paint.kind === 'image';
}

/** Whether a paint repeats a tile: a built-in one, a picture, or a
 *  consumer's texture. */
export function isPatternPaint(paint: Paint): paint is PatternPaint {
  return paint.kind === 'texture' || paint.kind === 'image' || isTileKind(paint.kind);
}

/** A pattern paint's placement alone, holding only the fields it sets. */
export function patternPlacementOf(paint: PatternPaint): PatternPlacement {
  const { units, origin, transform, opacity } = paint;
  return {
    ...(units !== undefined ? { units } : {}),
    ...(origin !== undefined ? { origin } : {}),
    ...(transform !== undefined ? { transform } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
  };
}

/** A tile paint's description of the tile alone, its placement left behind. */
export function tileSpecOf(paint: TilePaint): TilePatternSpec {
  const { units: _units, origin: _origin, transform: _transform, opacity: _opacity, ...spec } = paint;
  return spec;
}
