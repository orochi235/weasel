import { registerEffect, type Effect, type TextureHandle } from '@weasel-js/renderer';
import { DEFAULT_THRESHOLD, DITHER_METHODS, WHITE, checkMethod } from '../shared';
import type { Rgb, Rgba } from '../types';
import { DITHER_FRAG, DITHER_WGSL } from './frag';
import type { DeviceGrid } from './deviceGrid';

const PROGRAM = registerEffect('weasel:dither', { glsl: DITHER_FRAG, wgsl: DITHER_WGSL });

const INK: Rgba = [0, 0, 0, 255];
const BLANK: Rgba = [0, 0, 0, 0];
const SCREEN: DeviceGrid = { pitch: [1, 1], origin: [0, 0] };

/** How the `dither` effect quantizes what its group drew. */
export interface DitherOptions {
  /** Default `'threshold'`. Error diffusion runs on the CPU only. */
  method?: 'threshold' | 'bayer';
  /** Gray (0–255) below it is ink. Default 128. */
  threshold?: number;
  /** What transparency composites over before gray is taken. Default white. */
  background?: Rgb;
  /** Default opaque black. */
  ink?: Rgba;
  /** Default transparent. */
  blank?: Rgba;
  /** `'screen'` (one dot per device pixel, the default), or an output grid
   *  placed with `deviceGrid`. */
  grid?: 'screen' | DeviceGrid;
  /** A protect mask in dot space, from `createProtectTexture`. Needs an output grid. */
  protect?: { texture: TextureHandle; width: number; height: number };
}

// Past it no protect mask can reach the buffer, and float32 still counts dots one by one.
const DOT_OFFSET_LIMIT = 2 ** 23;

/** `origin` moved by whole Bayer cells (4 dots) to within one cell of the
 *  buffer's top left, and the dots it moved by. `deviceGrid` gives the origin
 *  in float64, and it grows with the view's distance from it; the shader works
 *  in float32, where a far origin would round every dot edge. */
function reduceOrigin(origin: number, pitch: number): [origin: number, dotOffset: number] {
  const cells = Math.floor(origin / (4 * pitch));
  if (!Number.isFinite(cells)) return [origin, 0];
  const offset = Math.min(DOT_OFFSET_LIMIT, Math.max(-DOT_OFFSET_LIMIT, -4 * cells));
  return [origin - cells * 4 * pitch, offset];
}

const premultiplied = ([r, g, b, a]: Rgba): number[] => {
  const k = a / 255;
  return [(r / 255) * k, (g / 255) * k, (b / 255) * k, k];
};

/** Threshold or Bayer dithering as one effect pass. */
export function dither(options: DitherOptions = {}): Effect[] {
  const method = options.method ?? 'threshold';
  if (method !== 'threshold' && method !== 'bayer') {
    if ((DITHER_METHODS as readonly string[]).includes(method as string)) {
      throw new Error(`dither: '${String(method)}' is error diffusion, which runs on the CPU only (ditherPixels)`);
    }
    checkMethod('dither', method, ['threshold', 'bayer']);
  }
  const grid = options.grid === undefined || options.grid === 'screen' ? SCREEN : options.grid;
  if (options.protect && grid === SCREEN) {
    throw new Error('dither: a protect mask is in dots, so it needs an output grid, not the screen');
  }
  const background = options.background ?? WHITE;
  const reach = grid === SCREEN ? 0 : Math.ceil(Math.max(Math.abs(grid.pitch[0]), Math.abs(grid.pitch[1])));
  const [originX, offsetX] = reduceOrigin(grid.origin[0], grid.pitch[0]);
  const [originY, offsetY] = reduceOrigin(grid.origin[1], grid.pitch[1]);
  return [{
    program: PROGRAM,
    reach,
    screenAnchored: method === 'bayer' || grid !== SCREEN,
    uniforms: {
      u_method: method === 'bayer' ? 1 : 0,
      u_threshold: options.threshold ?? DEFAULT_THRESHOLD,
      u_background: [background[0] / 255, background[1] / 255, background[2] / 255],
      u_ink: premultiplied(options.ink ?? INK),
      u_blank: premultiplied(options.blank ?? BLANK),
      u_pitch: [grid.pitch[0], grid.pitch[1]],
      u_gridOrigin: [originX, originY],
      u_dotOffset: [offsetX, offsetY],
      ...(options.protect
        ? { u_protect: options.protect.texture, u_protectSize: [options.protect.width, options.protect.height] }
        : { u_protectSize: [0, 0] }),
    },
  }];
}
