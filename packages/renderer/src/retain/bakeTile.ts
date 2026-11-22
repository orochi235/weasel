import type { DrawCommand } from '../DrawCommand';
import type { DrawContext } from '../draw';
import { drawStream } from '../drawStream';
import { windowProjection } from '../draw/effects';
import type { GpuDevice } from '../gpu/types';
import type { TileTexture, TileTextures } from './TileTextures';

/**
 * Draw `commands` into a new tile `size` texels a side. The commands are in the tile's own texel
 * space, a texel to the unit, y down, as a frame's are in CSS pixels; `contextFor` builds the frame
 * context that draws into the scratch buffer. The canvas's frame is untouched: bake before `render`.
 */
export function bakeTile(
  tiles: TileTextures, gpu: GpuDevice, commands: readonly DrawCommand[], size: number,
  contextFor: (target: NonNullable<DrawContext['renderTarget']>) => DrawContext,
): TileTexture {
  const scratch = tiles.scratchFor(size);
  const window = { x: 0, y: 0, width: size, height: size };
  const pass = { target: scratch, viewport: window };
  const renderTarget = { pass, fragOrigin: [0, 0] as const, window };
  gpu.beginFrame();
  gpu.beginPass({ ...pass, clear: { color: true, stencil: true } });
  const ctx: DrawContext = {
    ...contextFor(renderTarget),
    widthCss: size, heightCss: size, deviceWidth: size, deviceHeight: size,
    projection: windowProjection(window, 1),
  };
  try {
    drawStream(ctx, commands, [], [], ctx.stats ?? { drawCalls: 0 });
  } finally {
    gpu.endPass();
  }
  return tiles.keep(size);
}

/** A renderer's baked tiles: what a tiled layer bakes into and draws from. */
export class RendererTiles {
  constructor(
    private readonly textures: TileTextures,
    private readonly gpu: GpuDevice,
    private readonly usable: () => boolean,
    private readonly beginFrame: () => void,
    private readonly contextFor: (target: NonNullable<DrawContext['renderTarget']>) => DrawContext,
    private readonly endFrame: () => void,
  ) {}

  /**
   * Draw `commands`, in a tile's own texel space (a texel to the unit, y down), into a new texture
   * `size` texels a side. Call between frames, never inside `render`. Null where the context is
   * lost. Kept until `release`, or until the context is lost, which bumps `generation`.
   */
  bake(commands: readonly DrawCommand[], size: number): TileTexture | null {
    if (!this.usable()) return null;
    this.beginFrame();
    try {
      return bakeTile(this.textures, this.gpu, commands, size, this.contextFor);
    } finally {
      this.endFrame();
    }
  }

  release(tile: TileTexture): void {
    this.textures.release(tile);
  }

  /** @internal The texture a tile command samples. */
  textureOf(tile: TileTexture): ReturnType<TileTextures['textureOf']> {
    return this.textures.textureOf(tile);
  }

  /** Free the scratch buffer bakes draw in, once a frame baked nothing. */
  idle(): void {
    this.textures.dropScratch();
  }

  /** GPU memory the tiles hold, the pool and the scratch buffer included. */
  get bytes(): number { return this.textures.bytes; }
  get count(): number { return this.textures.count; }
  /** Moves when every tile was lost at once: a holder starts over. */
  get generation(): number { return this.textures.generation; }
}
