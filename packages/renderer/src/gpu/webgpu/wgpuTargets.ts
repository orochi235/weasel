/** Render targets on a WebGPU device: offscreen ones, the canvas's, the
 *  resolve out of a multisampled one, and reading ids and the canvas back. Rects arrive
 *  counted from the bottom-left, as the layer counts them, and are turned
 *  over here. */
import type { GpuFilter, GpuRect, GpuTarget, GpuTargetDesc } from '../types';
import { BufferUsage, MapMode, TextureUsage } from './flags';
import { createTexture, type ResourceHost, type Tracked, type WgpuTexture } from './wgpuResources';

export const DEPTH_STENCIL: GPUTextureFormat = 'depth24plus-stencil8';
const ATTACHMENT = TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC | TextureUsage.COPY_DST;

/** What a pass draws into, offscreen or the canvas. */
export interface PassAttachments {
  readonly width: number;
  readonly height: number;
  readonly sampleCount: 1 | 4;
  readonly format: GPUTextureFormat;
  readonly stencil: boolean;
  readonly hasIds: boolean;
  /** Its formats, samples and attachments, as a pipeline key. */
  readonly key: string;
  /** Textures a draw in the pass must not sample. */
  readonly attached: ReadonlySet<WgpuTexture>;
  colorView(): GPUTextureView;
  resolveView(): GPUTextureView | undefined;
  idsView(): GPUTextureView | undefined;
  depthView(): GPUTextureView | undefined;
  markUsed(serial: number): void;
  /** Encode what has to follow every pass over it. */
  finish?(encoder: GPUCommandEncoder): void;
}

export interface WgpuTarget extends GpuTarget, PassAttachments, Tracked {
  readonly color: WgpuTexture | null;
  readonly ids: WgpuTexture | null;
  /** The color of a multisampled target. */
  readonly msaa: GPUTexture | null;
  readonly depth: GPUTexture | null;
  /** A single-sampled copy a multisampled target resolves through. */
  resolved: GPUTexture | null;
}

function attachmentKey(format: GPUTextureFormat, samples: number, stencil: boolean, ids: boolean): string {
  return `${format}x${samples}${stencil ? 's' : ''}${ids ? 'i' : ''}`;
}

function emptyTexture(host: ResourceHost, width: number, height: number, filter: GpuFilter): WgpuTexture {
  return createTexture(host, 'rgba8', { min: filter, mag: filter, wrapS: 'clamp', wrapT: 'clamp' }, { width, height, data: null });
}

export function createTarget(host: ResourceHost, desc: GpuTargetDesc): WgpuTarget {
  const { width, height } = desc;
  const requested = desc.samples ?? 0;
  const samples: 1 | 4 = requested > 1 ? 4 : 1;
  const device = host.device;
  const color = samples === 1 ? emptyTexture(host, width, height, desc.filter ?? 'nearest') : null;
  const msaa = samples === 1 ? null
    : device.createTexture({ label: 'target color ×4', size: [width, height], format: 'rgba8unorm', sampleCount: 4, usage: TextureUsage.RENDER_ATTACHMENT });
  const ids = desc.ids ? emptyTexture(host, width, height, 'nearest') : null;
  const stencil = desc.stencil === true;
  const depth = stencil
    ? device.createTexture({ label: 'target stencil', size: [width, height], format: DEPTH_STENCIL, sampleCount: samples, usage: TextureUsage.RENDER_ATTACHMENT })
    : null;
  const colorView = color?.view ?? msaa!.createView();
  const depthView = depth?.createView();
  const attached = new Set<WgpuTexture>([color, ids].filter((t): t is WgpuTexture => t !== null));
  const perPixel = Math.max(1, requested) * (4 + (stencil ? 4 : 0)) + (ids ? 4 : 0);
  const target: WgpuTarget = {
    kind: 'target', width, height, samples: requested, sampleCount: samples, color, ids, msaa, depth, resolved: null, usedIn: -1,
    format: 'rgba8unorm', stencil, hasIds: ids !== null, key: attachmentKey('rgba8unorm', samples, stencil, ids !== null), attached,
    get bytes() { return width * height * (perPixel + (this.resolved ? 4 : 0)); },
    colorView: () => colorView,
    resolveView: () => undefined,
    idsView: () => ids?.view,
    depthView: () => depthView,
    markUsed(serial) {
      this.usedIn = serial;
      if (color) color.usedIn = serial;
      if (ids) ids.usedIn = serial;
    },
  };
  return target;
}

export function deleteTarget(host: ResourceHost, target: WgpuTarget): void {
  for (const t of [target.color?.gpu, target.ids?.gpu, target.msaa, target.depth, target.resolved]) if (t) host.retire(t);
}

/** The canvas: drawn into a color buffer of its own with a stencil, 4×
 *  multisampled by default, which every pass ends by resolving or copying into
 *  the context's texture. The buffer keeps what was drawn from pass to pass
 *  and frame to frame, as a renderer sharing the canvas with others needs. */
export class CanvasTarget implements PassAttachments {
  readonly stencil = true;
  readonly hasIds = false;
  readonly key: string;
  readonly attached = new Set<WgpuTexture>();
  private color: GPUTexture | null = null;
  /** The multisampled color resolved, which outlives the frame it was drawn
   *  in as a WebGL canvas's preserved buffer does, so it can be read back. */
  private resolved: GPUTexture | null = null;
  private depth: GPUTexture | null = null;
  private views: { color: GPUTextureView; resolved?: GPUTextureView; depth: GPUTextureView } | null = null;

  constructor(
    private readonly host: ResourceHost,
    private readonly canvas: HTMLCanvasElement | OffscreenCanvas,
    private readonly context: GPUCanvasContext,
    readonly format: GPUTextureFormat,
    readonly sampleCount: 1 | 4,
  ) {
    this.key = attachmentKey(format, sampleCount, true, false);
  }

  get width(): number { return this.canvas.width; }
  get height(): number { return this.canvas.height; }

  /** Make the multisampled buffers match the canvas, keeping them while they do. */
  private ensure(): { color: GPUTextureView; resolved?: GPUTextureView; depth: GPUTextureView } {
    const { width, height } = this;
    if (this.views && this.color!.width === width && this.color!.height === height) return this.views;
    this.dispose();
    const size = [Math.max(1, width), Math.max(1, height)];
    const device = this.host.device;
    const sampleCount = this.sampleCount;
    const single = TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC;
    this.color = device.createTexture({
      label: 'canvas color', size, format: this.format, sampleCount, usage: sampleCount === 1 ? single : TextureUsage.RENDER_ATTACHMENT,
    });
    if (sampleCount === 4) this.resolved = device.createTexture({ label: 'canvas resolved', size, format: this.format, usage: single });
    this.depth = device.createTexture({ label: 'canvas stencil', size, format: DEPTH_STENCIL, sampleCount, usage: TextureUsage.RENDER_ATTACHMENT });
    this.views = { color: this.color.createView(), resolved: this.resolved?.createView(), depth: this.depth.createView() };
    return this.views;
  }

  /** What the last frame drew, single-sampled; null before the first. */
  frameTexture(): GPUTexture | null { return this.resolved ?? this.color; }

  colorView(): GPUTextureView { return this.ensure().color; }
  resolveView(): GPUTextureView | undefined { return this.ensure().resolved; }
  idsView(): undefined { return undefined; }
  depthView(): GPUTextureView { return this.ensure().depth; }
  markUsed(): void {}

  finish(encoder: GPUCommandEncoder): void {
    const frame = this.frameTexture();
    if (!frame) return;
    const into = this.context.getCurrentTexture();
    const width = Math.min(frame.width, into.width);
    const height = Math.min(frame.height, into.height);
    encoder.copyTextureToTexture({ texture: frame }, { texture: into }, [width, height]);
  }

  dispose(): void {
    for (const t of [this.color, this.resolved, this.depth]) if (t) this.host.retire(t);
    this.color = this.resolved = this.depth = null;
    this.views = null;
  }
}

/** A rect counted from the bottom of something `height` tall, counted from its top. */
export function topDown(rect: GpuRect, height: number): GpuRect {
  return { x: rect.x, y: height - rect.y - rect.height, width: rect.width, height: rect.height };
}

/** Encode the copy of `source`'s bottom-left `width × height` into `dest` at
 *  `x, y` from its bottom-left, resolving it first where it is multisampled. */
export function encodeResolve(
  host: ResourceHost, encoder: GPUCommandEncoder, source: WgpuTarget, dest: WgpuTarget,
  width: number, height: number, x: number, y: number,
): void {
  let from: GPUTexture;
  if (source.msaa) {
    source.resolved ??= host.device.createTexture({ label: 'target resolved', size: [source.width, source.height], format: 'rgba8unorm', usage: ATTACHMENT });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: source.msaa.createView(), resolveTarget: source.resolved.createView(), loadOp: 'load', storeOp: 'store' }],
    });
    pass.end();
    from = source.resolved;
  } else {
    from = source.color!.gpu;
  }
  if (width <= 0 || height <= 0) return;
  encoder.copyTextureToTexture(
    { texture: from, origin: [0, source.height - height] },
    { texture: dest.color!.gpu, origin: [x, dest.height - y - height] },
    [width, height],
  );
}

/** Encode reading `rect` of the id attachment; the promise, once the encoder
 *  is submitted, holds its texels with rows bottom-up. */
export function encodeReadIds(
  device: GPUDevice, encoder: GPUCommandEncoder, target: WgpuTarget, rect: GpuRect,
): () => Promise<Uint8Array> {
  return encodeReadTexture(device, encoder, target.ids?.gpu ?? null, target.height, rect);
}

/** Encode reading `rect` of an RGBA8 `texture` `height` tall; the promise,
 *  once the encoder is submitted, holds its texels with rows bottom-up. */
export function encodeReadTexture(
  device: GPUDevice, encoder: GPUCommandEncoder, texture: GPUTexture | null, height: number, rect: GpuRect,
): () => Promise<Uint8Array> {
  const { width, height: rows } = rect;
  if (width === 0 || rows === 0 || !texture) return () => Promise.resolve(new Uint8Array(width * rows * 4));
  const stride = Math.ceil((width * 4) / 256) * 256;
  const buffer = device.createBuffer({ size: stride * rows, usage: BufferUsage.COPY_DST | BufferUsage.MAP_READ });
  const from = topDown(rect, height);
  encoder.copyTextureToBuffer(
    { texture, origin: [from.x, from.y] }, { buffer, bytesPerRow: stride, rowsPerImage: rows }, [width, rows],
  );
  return async () => {
    const out = new Uint8Array(width * rows * 4);
    try {
      await buffer.mapAsync(MapMode.READ);
    } catch {
      // The device was lost: nothing was drawn, as GL reads nothing back from a lost context.
      buffer.destroy();
      return out;
    }
    const mapped = new Uint8Array(buffer.getMappedRange());
    // Read top-down; the layer's rows run bottom-up.
    for (let row = 0; row < rows; row++) {
      out.set(mapped.subarray(row * stride, row * stride + width * 4), (rows - 1 - row) * width * 4);
    }
    buffer.unmap();
    buffer.destroy();
    return out;
  };
}
