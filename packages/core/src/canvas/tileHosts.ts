/** The tile host a renderer's tiled layers bake into: one per renderer, since its tiles are that renderer's textures. */
import type { WeaselRenderer } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { createTileHost, type TileHost } from 'core/layers/tileHost';

const hosts = new WeakMap<WeaselRenderer, TileHost>();

/** The tile host of `renderer`, or undefined while it has never drawn a tiled layer. */
export function tileHostOf(renderer: WeaselRenderer): TileHost | undefined {
  return hosts.get(renderer);
}

/** The tile host a frame of `layers` draws through: made the first time one of them is tiled, and
 *  kept after, so the frame that stops tiling a layer frees its tiles. */
export function frameTileHost(renderer: WeaselRenderer, layers: readonly RenderLayer<unknown>[]): TileHost | undefined {
  let host = hosts.get(renderer);
  if (host === undefined && layers.some((l) => l.tiles !== undefined)) hosts.set(renderer, host = createTileHost(renderer.tiles));
  return host;
}
