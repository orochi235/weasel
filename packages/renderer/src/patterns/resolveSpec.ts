/**
 * `TilePatternSpec` → `TextureHandle`. The bridge between a tile paint and the
 * GL texture that paints it.
 *
 * Memoized on the spec's field values, so identical specs across nodes share
 * one texture and a re-render never re-rasterizes. The memo keeps the
 * `PATTERN_TILE_CACHE_LIMIT` tiles most recently resolved or drawn and
 * unregisters the rest. A handle outliving its tile still draws: its id is
 * the spec, and the texture registry asks this module to rebuild it.
 */

import {
  isImagePatternPaint, isTileKind, isTilePaint, patternPlacementOf, tileSpecOf,
  type CommandPaint, type Paint, type PosedPaint, type TilePaint, type TilePatternSpec,
} from '@weasel-js/paint';
import {
  ownTextureIds, registerTextureAs, textureRegistry, unregisterTexture,
  type TextureHandle,
} from '../textures/registerTexture';
import { rasterizeTile } from './rasterizeTile';
import { resolveImagePattern } from './resolveImage';
import { drawTileShapes, tileGeometry, tileSize } from './tileGeometry';

/** How many built-in tiles stay rasterized at once. A scene drawing more
 *  distinct specs than this in one frame rebuilds the overflow every frame. */
export const PATTERN_TILE_CACHE_LIMIT = 256;

const ID_PREFIX = 'pattern:';

/** Texture id → handle, least recently used first. */
const cache = new Map<string, TextureHandle | null>();

/** Stable across key order — specs arriving from JSON have no guaranteed
 *  field order, and two orderings must not rasterize two tiles. */
function specId(spec: TilePatternSpec): string {
  const bag = spec as unknown as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(bag).sort()) sorted[k] = bag[k];
  return ID_PREFIX + JSON.stringify(sorted);
}

/** @internal Test helper — do not call from product code. */
export function _resetPatternSpecCacheForTests(): void {
  cache.clear();
}

/**
 * Build (or fetch) the texture for a spec. Returns `null` when the tile
 * can't be rasterized — no `OffscreenCanvas`, same as `createTilePattern`.
 */
export function resolvePatternSpec(spec: TilePatternSpec): TextureHandle | null {
  // A whole tile paint is a valid argument, and its placement is no part of
  // the tile.
  const tile = tileSpecOf(spec as TilePaint);
  const id = specId(tile);
  const hit = cache.get(id);
  if (hit !== undefined) {
    markUsed(id);
    return hit;
  }
  return build(id, tile);
}

function markUsed(id: string): void {
  const hit = cache.get(id);
  if (hit === undefined) return;
  cache.delete(id);
  cache.set(id, hit);
}

function build(id: string, spec: TilePatternSpec): TextureHandle | null {
  const bitmap = isTileKind(spec.kind)
    ? rasterizeTile({
      size: tileSize(spec),
      draw: (oc) => drawTileShapes(oc, tileGeometry(spec)),
    })
    : null;
  const handle = bitmap ? registerTextureAs(id, bitmap) : null;
  cache.delete(id);
  cache.set(id, handle);
  while (cache.size > PATTERN_TILE_CACHE_LIMIT) evict(cache.keys().next().value!);
  return handle;
}

function evict(id: string): void {
  cache.delete(id);
  const source = textureRegistry.get(id)?.source;
  unregisterTexture({ id });
  if (source && 'close' in source) source.close();
}

function revive(id: string): void {
  let spec: unknown;
  try {
    spec = JSON.parse(id.slice(ID_PREFIX.length));
  } catch {
    return;
  }
  if (typeof spec !== 'object' || spec === null || !('kind' in spec)) return;
  build(id, spec as TilePatternSpec);
}

ownTextureIds(ID_PREFIX, { revive, touched: markUsed });

/**
 * Swap a tile or image paint for the `texture` paint that draws it, placement
 * and extent kept, leaving every other fill untouched. The built-in painters
 * run this alongside `fillInPoseFrame`; a consumer emitting its own draw
 * commands runs it at the same place it runs that one.
 *
 * A tile that can't rasterize drops the fill rather than painting garbage. An
 * image always resolves, and draws nothing until it has decoded.
 */
export function resolveFillPattern(fill: PosedPaint): CommandPaint | null;
export function resolveFillPattern(fill: Paint): Paint | null;
export function resolveFillPattern(fill: Paint): Paint | null {
  if (isImagePatternPaint(fill)) {
    const { width, height } = fill;
    return {
      kind: 'texture',
      texture: resolveImagePattern(fill),
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...patternPlacementOf(fill),
    };
  }
  if (!isTilePaint(fill)) return fill;
  const texture = resolvePatternSpec(fill);
  return texture ? { kind: 'texture', texture, ...patternPlacementOf(fill) } : null;
}
