import type { GpuDevice, GpuPassDesc } from './gpu/types';
import type { RenderTarget } from './rendererTypes';

/** A rect of the drawing buffer, in device pixels. */
export interface DeviceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A renderer's rect in device pixels, top-left origin, for a CSS size of
 *  `widthCss` x `heightCss` placed by `target`. A tile rounds its edges rather
 *  than its size, so two that share a CSS edge share a device one. */
export function deviceRectFor(
  target: RenderTarget | null, widthCss: number, heightCss: number, dpr: number,
): DeviceRect {
  const ox = target?.origin.x ?? 0;
  const oy = target?.origin.y ?? 0;
  const x = Math.round(ox * dpr);
  const y = Math.round(oy * dpr);
  const width = Math.round((ox + widthCss) * dpr) - x;
  return { x, y, width, height: Math.round((oy + heightCss) * dpr) - y };
}

/** The canvas pass a renderer at `device` draws in: its rect as GL addresses
 *  it, from the buffer's bottom left, scissored to it when a `target` says it
 *  shares the drawing buffer. Begun anew each frame, because a co-tenant on the
 *  same context moves viewport and scissor between frames. */
export function canvasPassFor(
  device: DeviceRect, target: RenderTarget | null, gpu: Pick<GpuDevice, 'canvasSize'>,
): GpuPassDesc {
  const { x, y, width, height } = device;
  if (!target) return { target: null, viewport: { x: 0, y: 0, width, height }, scissor: null };
  const rect = { x, y: gpu.canvasSize().height - y - height, width, height };
  return { target: null, viewport: rect, scissor: rect };
}

/** Size a canvas's drawing buffer for a CSS size at `dpr`. */
export function sizeCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas, width: number, height: number, dpr: number,
): void {
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
}
