/**
 * `TilePatternSpec` → `TextureHandle`. The bridge between the serializable
 * half of a pattern paint and the GL texture that paints it.
 *
 * Memoized on the spec's field values, so identical specs across nodes share
 * one texture and a re-render never re-rasterizes. Entries live for the
 * session, matching `registerTexture`'s own lifetime.
 */

import type { FillStyle, TilePatternSpec } from '../../core/paint-types';
import type { TextureHandle } from '../../renderer/textures/registerTexture';
import { hatch, crosshatch, dots, chunks } from './patterns-builtin';

const cache = new Map<string, TextureHandle | null>();

/** Stable key across key order — specs arriving from JSON have no guaranteed
 *  field order, and two orderings must not rasterize two tiles. */
function specKey(spec: TilePatternSpec): string {
  const keys = Object.keys(spec).sort();
  const bag = spec as unknown as Record<string, unknown>;
  return keys.map((k) => `${k}=${String(bag[k])}`).join('&');
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
  const key = specKey(spec);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const built = buildTile(spec);
  cache.set(key, built);
  return built;
}

function buildTile(spec: TilePatternSpec): TextureHandle | null {
  const { color, size } = spec;
  switch (spec.tile) {
    case 'hatch':
      return hatch({ color, size, lineWidth: spec.lineWidth });
    case 'crosshatch':
      return crosshatch({ color, size, lineWidth: spec.lineWidth });
    case 'dots':
      return dots({ color, size, radius: spec.radius });
    case 'chunks':
      return chunks({
        color, size, bg: spec.bg,
        density: spec.density, chunkSize: spec.chunkSize, seed: spec.seed,
      });
    default:
      return null;
  }
}

/** Whether a pattern payload is a spec rather than an already-built handle. */
export function isPatternSpec(
  payload: TextureHandle | TilePatternSpec,
): payload is TilePatternSpec {
  return 'tile' in payload;
}

/**
 * Swap a pattern paint's spec payload for the texture that paints it,
 * leaving every other fill untouched. The built-in painters run this
 * alongside `fillInPoseFrame`; a consumer emitting its own draw commands
 * runs it at the same place it runs that one.
 *
 * A spec that can't rasterize drops the fill rather than painting garbage.
 */
export function resolveFillPattern(fill: FillStyle): FillStyle | null {
  if (fill.fill !== 'pattern') return fill;
  if (!isPatternSpec(fill.pattern)) return fill;
  const handle = resolvePatternSpec(fill.pattern);
  return handle ? { ...fill, pattern: handle } : null;
}
