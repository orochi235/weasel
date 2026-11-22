import type { DrawCommand } from '../DrawCommand';
import type { DrawContext } from '../draw';
import { drawStream } from '../drawStream';
import { windowProjection } from '../draw/effects';
import type { GpuDevice, GpuTarget } from '../gpu/types';
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
  drawTile(gpu, tiles.scratchFor(size), commands, size, contextFor, true);
  return tiles.keep(size);
}

/** Draw `commands` into `scratch`, `size` texels a side, clearing it first when `clear`. */
function drawTile(
  gpu: GpuDevice, scratch: GpuTarget, commands: readonly DrawCommand[], size: number,
  contextFor: (target: NonNullable<DrawContext['renderTarget']>) => DrawContext, clear: boolean,
): void {
  const window = { x: 0, y: 0, width: size, height: size };
  const pass = { target: scratch, viewport: window };
  const renderTarget = { pass, fragOrigin: [0, 0] as const, window };
  gpu.beginFrame();
  gpu.beginPass({ ...pass, ...(clear ? { clear: { color: true, stencil: true } } : {}) });
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
}

/**
 * A tile baked over several calls, for one too costly to draw in a frame: each `draw` adds commands
 * over what the earlier ones drew, and `finish` keeps the result as a tile.
 */
export interface TileBake {
  readonly size: number;
  /** Draw `commands`, in the tile's texel space, over what is there. False once the context was lost. */
  draw(commands: readonly DrawCommand[]): boolean;
  /** Keep what was drawn as a tile, or null where the context was lost. Ends the bake. */
  finish(): TileTexture | null;
  /** End the bake and free what it holds. Idempotent. */
  cancel(): void;
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

  /** Start a tile `size` texels a side baked over several calls, cleared to transparent; null where
   *  the context is lost. Call between frames, as `bake`. */
  begin(size: number): TileBake | null {
    if (!this.usable()) return null;
    const scratch = this.textures.ownScratch(size);
    const generation = this.textures.generation;
    let open = true;
    const live = () => open && this.usable() && this.textures.generation === generation;
    const run = (commands: readonly DrawCommand[], clear: boolean) => {
      this.beginFrame();
      try {
        drawTile(this.gpu, scratch, commands, size, this.contextFor, clear);
      } finally {
        this.endFrame();
      }
    };
    run([], true);
    const cancel = () => {
      open = false;
      this.textures.free(scratch);
    };
    return {
      size,
      draw: (commands) => {
        if (!live()) return false;
        run(commands, false);
        return true;
      },
      finish: () => {
        const tile = live() ? this.textures.keep(size, scratch) : null;
        cancel();
        return tile;
      },
      cancel,
    };
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
