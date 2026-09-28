import type { RasterImage } from './renderSceneToPixels';

/** Encode a raster as a PNG `Blob` — for download, upload, or the clipboard.
 *  Needs a 2D canvas: `OffscreenCanvas` where there is one, else the DOM's. */
export async function rasterToPng(image: RasterImage): Promise<Blob> {
  const pixels = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('rasterToPng: no 2D context');
    ctx.putImageData(pixels, 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
  }
  if (typeof document === 'undefined') throw new Error('rasterToPng: no canvas in this environment');
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('rasterToPng: no 2D context');
  ctx.putImageData(pixels, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('rasterToPng: encoding failed'))), 'image/png');
  });
}
