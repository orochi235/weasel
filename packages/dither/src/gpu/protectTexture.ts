import { registerTexture, unregisterTexture, type TextureHandle } from '@weasel-js/renderer';
import { checkImageSize } from '../shared';

/** A protect mask uploaded for `dither`, one texel per dot, with its size. */
export interface ProtectTexture {
  texture: TextureHandle;
  width: number;
  height: number;
  /** Unregister the texture and free its bitmap. */
  dispose(): void;
}

/** A protect mask (from `protectMask`, in dot space) as a texture `dither`
 *  can read. The caller disposes it when the mask changes or the view goes. */
export async function protectTexture(mask: Uint8Array, width: number, height: number): Promise<ProtectTexture> {
  checkImageSize('protectTexture', width, height);
  if (mask.length !== width * height) {
    throw new RangeError(`protectTexture: mask holds ${mask.length} dots, ${width}×${height} needs ${width * height}`);
  }
  // A bitmap has at least one pixel; `width` and `height` still say the mask holds no dot.
  const bw = Math.max(1, width), bh = Math.max(1, height);
  const data = new Uint8ClampedArray(bw * bh * 4);
  for (let i = 0; i < width * height; i++) {
    const v = mask[i] ? 255 : 0;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const bitmap = await createImageBitmap(new ImageData(data, bw, bh));
  const texture = registerTexture(bitmap);
  return {
    texture, width, height,
    dispose() {
      unregisterTexture(texture);
      bitmap.close();
    },
  };
}
