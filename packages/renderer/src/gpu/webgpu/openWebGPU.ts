import { TextureUsage } from './flags';
import { WebGPUDevice } from './WebGPUDevice';

/** What a WebGPU renderer is built from: a device the caller already holds
 *  (`requestRendererDevice`), and the canvas it draws to. */
export interface WebGPUSurface {
  device: GPUDevice;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  /** The canvas's context, when the caller already opened it. */
  context?: GPUCanvasContext;
  /** Draw the canvas 4× multisampled, as a WebGL context's `antialias`
   *  attribute does. Default true. */
  antialias?: boolean;
}

/** Configure `context` as a renderer draws to it, and return its format.
 *  Every canvas takes rgba8unorm. The invalid bgra8unorm textures that chose it
 *  were headless Chromium presenting without the GPU, which fails rgba8unorm
 *  too; on a GPU both present (docs/traps/testing.md, 2026-11-06). */
export function configureCanvas(context: GPUCanvasContext, device: GPUDevice): GPUTextureFormat {
  const format: GPUTextureFormat = 'rgba8unorm';
  context.configure({
    device, format, alphaMode: 'premultiplied',
    usage: TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC | TextureUsage.COPY_DST,
  });
  return format;
}

/** The device over `surface`, its canvas configured premultiplied. A lost device does not come
 *  back: a renderer on it draws nothing until it is rebuilt on a new one. */
export function openWebGPU(surface: WebGPUSurface): { device: WebGPUDevice } {
  const context = surface.context ?? (surface.canvas.getContext('webgpu') as GPUCanvasContext | null);
  if (!context) throw new Error('WeaselRenderer: the canvas would not open a WebGPU context');
  const format = configureCanvas(context, surface.device);
  return { device: new WebGPUDevice(surface.device, surface.canvas, context, format, surface.antialias ?? true) };
}
