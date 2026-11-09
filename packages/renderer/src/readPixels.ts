import type { GpuDevice } from './gpu/types';

/** A rect of a canvas in whole device pixels, counted from its top-left. */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function checked(gpu: GpuDevice, rect: PixelRect): PixelRect {
  const { width, height } = gpu.canvasSize();
  const { x, y } = rect;
  if (![x, y, rect.width, rect.height].every(Number.isInteger)) {
    throw new RangeError(`weasel: readPixels rect ${x},${y} ${rect.width}×${rect.height} is not whole device pixels`);
  }
  if (x < 0 || y < 0 || rect.width < 0 || rect.height < 0 || x + rect.width > width || y + rect.height > height) {
    throw new RangeError(`weasel: readPixels rect ${x},${y} ${rect.width}×${rect.height} is outside the ${width}×${height} canvas`);
  }
  // The layer counts rows from the bottom.
  return { x, y: height - y - rect.height, width: rect.width, height: rect.height };
}

function topDown(bytes: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(bytes.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) out.set(bytes.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  return out;
}

export function readPixels(gpu: GpuDevice, rect: PixelRect): Promise<Uint8Array> {
  return gpu.readCanvas(checked(gpu, rect)).then((bytes) => topDown(bytes, rect.width, rect.height));
}

export function readPixelsSync(gpu: GpuDevice, rect: PixelRect): Uint8Array {
  if (!gpu.readCanvasSync) throw new Error('weasel: WebGPU reads the canvas back only through readPixels');
  return topDown(gpu.readCanvasSync(checked(gpu, rect)), rect.width, rect.height);
}
