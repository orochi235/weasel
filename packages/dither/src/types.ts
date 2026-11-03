export type DitherMethod = 'threshold' | 'bayer' | 'floyd-steinberg' | 'atkinson';

/** 0–255 per channel. */
export type Rgb = readonly [number, number, number];
/** 0–255 per channel, straight alpha. */
export type Rgba = readonly [number, number, number, number];

/** Top-down, straight (non-premultiplied) RGBA, 4 bytes per pixel: what
 *  `renderSceneToPixels` returns, and what `ImageData` holds. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export interface DitherOptions {
  /** Default `'threshold'`. */
  method?: DitherMethod;
  /** Gray (0–255) below it is ink. Default 128. */
  threshold?: number;
  /** What transparency composites over before gray is taken. Default white. */
  background?: Rgb;
  /** One byte per pixel, nonzero = protected: quantized at plain `threshold`,
   *  and error diffusion neither enters nor leaves it. */
  protect?: Uint8Array;
}
