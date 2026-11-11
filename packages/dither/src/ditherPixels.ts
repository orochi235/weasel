import { ATKINSON, FLOYD_STEINBERG, diffuse } from './diffuse';
import { toGray } from './gray';
import { DEFAULT_THRESHOLD, WHITE, bayerCutoff, checkImageSize } from './shared';
import type { DitherOptions, RgbaImage } from './types';

/** `image` quantized to ink: one byte per pixel, 1 = ink. */
export function ditherPixels(image: RgbaImage, options: DitherOptions = {}): Uint8Array {
  const { method = 'threshold', threshold = DEFAULT_THRESHOLD, background = WHITE, protect } = options;
  const { width, height } = image;
  checkImageSize('ditherPixels', width, height);
  if (image.data.length !== width * height * 4) {
    throw new RangeError(`ditherPixels: data holds ${image.data.length} bytes, a ${width}×${height} image needs ${width * height * 4}`);
  }
  if (protect && protect.length !== width * height) {
    throw new RangeError(`ditherPixels: protect holds ${protect.length} pixels, the image ${width * height}`);
  }
  // No pixels, however tall: the loops below would walk every empty row.
  if (width * height === 0) return new Uint8Array(0);
  const gray = toGray(image, background);
  switch (method) {
    case 'threshold': {
      const mask = new Uint8Array(width * height);
      for (let i = 0; i < mask.length; i++) mask[i] = gray[i]! < threshold ? 1 : 0;
      return mask;
    }
    case 'bayer': {
      const mask = new Uint8Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          const cutoff = protect?.[i] ? threshold : bayerCutoff(x, y, threshold);
          mask[i] = gray[i]! < cutoff ? 1 : 0;
        }
      }
      return mask;
    }
    case 'floyd-steinberg':
      return diffuse(gray, width, height, threshold, FLOYD_STEINBERG, 16, protect ?? null);
    case 'atkinson':
      return diffuse(gray, width, height, threshold, ATKINSON, 8, protect ?? null);
  }
}
