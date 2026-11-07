/**
 * The command encoder, the open pass, and the uniform ring, and the one rule
 * that keeps them ordered as GL orders its calls: a queue write lands before
 * every command still unsubmitted, so a write to something the open encoder
 * uses submits the encoder first, ending and resuming its pass around it.
 */
import type { GpuPassDesc, GpuRect } from '../types';
import { BufferUsage } from './flags';
import type { ResourceHost, Tracked } from './wgpuResources';
import { topDown, type PassAttachments } from './wgpuTargets';
import type { UtilityDraws } from './wgpuUtility';

/** Uniform values, every draw's at an offset of its own, uploaded in one
 *  write when the encoder that reads them is submitted. Offsets are reused
 *  only once the ring wraps, after a submit, which queue order puts behind
 *  every draw that read the old values. */
export class UniformRing {
  readonly buffer: GPUBuffer;
  readonly mirror: Uint8Array;
  readonly align: number;
  /** How many times the ring has wrapped: an offset from an earlier lap is stale. */
  lap = 0;
  private cursor = 0;
  private pending = 0;

  constructor(private readonly device: GPUDevice, readonly size: number) {
    this.buffer = device.createBuffer({ size, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST });
    this.mirror = new Uint8Array(size);
    this.align = device.limits.minUniformBufferOffsetAlignment;
  }

  /** Room for `bytes` and its offset, or `null` when the ring had to wrap
   *  first, through `flush`, so whatever the caller counted as uploaded this
   *  lap has to be counted again. */
  reserve(bytes: number, flush: () => void): number | null {
    if (bytes > this.size) throw new Error(`weasel: a draw's uniforms take ${bytes} bytes, past the ring's ${this.size}`);
    const at = Math.ceil(this.cursor / this.align) * this.align;
    if (at + bytes > this.size) {
      flush();
      this.lap++;
      this.cursor = this.pending = 0;
      return null;
    }
    this.cursor = at + bytes;
    return at;
  }

  upload(): void {
    if (this.cursor <= this.pending) return;
    this.device.queue.writeBuffer(this.buffer, this.pending, this.mirror, this.pending, this.cursor - this.pending);
    this.pending = this.cursor;
  }
}

/** The pass drawing now, and what has to be set again when it resumes. */
export interface OpenPass {
  readonly desc: GpuPassDesc;
  readonly target: PassAttachments;
  encoder: GPURenderPassEncoder;
  viewport: GpuRect;
  scissor: GpuRect | null;
  /** The viewport fold for the viewport as asked, and where it was last uploaded. */
  readonly ndc: Float32Array;
  ndcOffset: number;
  ndcLap: number;
  /** The viewport lies wholly off the target: every draw is dropped. */
  skip: boolean;
  pipeline: GPURenderPipeline | null;
}

function covers(rect: GpuRect | null | undefined, width: number, height: number): boolean {
  return !rect || (rect.x <= 0 && rect.y <= 0 && rect.x + rect.width >= width && rect.y + rect.height >= height);
}

export class Frame implements ResourceHost {
  serial = 0;
  pass: OpenPass | null = null;
  private encoder: GPUCommandEncoder | null = null;
  private retired: { destroy(): void }[] = [];

  constructor(readonly device: GPUDevice, readonly ring: UniformRing, private readonly utility: UtilityDraws) {}

  commands(): GPUCommandEncoder {
    this.encoder ??= this.device.createCommandEncoder();
    return this.encoder;
  }

  beforeWrite(resource: Tracked): void {
    if (resource.usedIn === this.serial) this.flush();
  }

  retire(object: { destroy(): void }): void {
    this.retired.push(object);
  }

  /** Submit everything encoded so far, the open pass resuming after. */
  flush(): void {
    const open = this.pass;
    if (open) this.close(open);
    this.ring.upload();
    if (this.encoder) this.device.queue.submit([this.encoder.finish()]);
    this.encoder = null;
    this.serial++;
    for (const object of this.retired) object.destroy();
    this.retired = [];
    if (open) this.resume(open);
  }

  /** Run `encode` on the encoder outside any pass, the open one resuming after. */
  outsidePass(encode: (encoder: GPUCommandEncoder) => void): void {
    const open = this.pass;
    if (open) this.close(open);
    encode(this.commands());
    if (open) this.resume(open);
  }

  begin(desc: GpuPassDesc, target: PassAttachments): void {
    if (this.pass) this.end();
    target.markUsed(this.serial);
    const pass: OpenPass = {
      desc, target, encoder: null as unknown as GPURenderPassEncoder, viewport: desc.viewport, scissor: desc.scissor ?? null,
      ndc: new Float32Array([1, 1, 0, 0]), ndcOffset: 0, ndcLap: -1, skip: false, pipeline: null,
    };
    const full = covers(desc.scissor, target.width, target.height);
    const clear = desc.clear;
    this.open(pass, full && clear?.color === true, full && clear?.stencil === true);
    this.pass = pass;
    if (!full && (clear?.color || (clear?.stencil && target.stencil))) {
      this.utility.clear(pass.encoder, target, { color: clear.color === true, stencilMask: clear.stencil ? 0xFF : 0 });
      this.applyViewport(pass);
    }
  }

  end(): void {
    const open = this.pass;
    if (!open) return;
    this.pass = null;
    this.close(open);
    this.flush();
  }

  private close(pass: OpenPass): void {
    pass.encoder.end();
    pass.target.finish?.(this.commands());
  }

  private resume(pass: OpenPass): void {
    pass.target.markUsed(this.serial);
    this.open(pass, false, false);
  }

  private open(pass: OpenPass, clearColor: boolean, clearStencil: boolean): void {
    const { target } = pass;
    const color: GPURenderPassColorAttachment = {
      view: target.colorView(), resolveTarget: target.resolveView(), loadOp: clearColor ? 'clear' : 'load', storeOp: 'store',
      clearValue: [0, 0, 0, 0],
    };
    const ids = target.idsView();
    const depth = target.depthView();
    pass.encoder = this.commands().beginRenderPass({
      colorAttachments: ids ? [color, { ...color, view: ids, resolveTarget: undefined }] : [color],
      ...(depth && {
        depthStencilAttachment: {
          view: depth, depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'discard',
          stencilLoadOp: clearStencil ? 'clear' : 'load', stencilStoreOp: 'store', stencilClearValue: 0,
        },
      }),
    });
    pass.pipeline = null;
    this.applyViewport(pass);
    this.applyScissor(pass);
  }

  /** Clamp the viewport to the target, which WebGPU requires, and fold what
   *  lay outside into the clip position the vertex stage writes. */
  applyViewport(pass: OpenPass): void {
    const { width: W, height: H } = pass.target;
    const v = pass.viewport;
    const x0 = Math.max(0, v.x);
    const y0 = Math.max(0, v.y);
    const x1 = Math.min(W, v.x + v.width);
    const y1 = Math.min(H, v.y + v.height);
    pass.skip = x1 <= x0 || y1 <= y0;
    pass.pipeline = null;
    if (pass.skip) return;
    const cw = x1 - x0;
    const ch = y1 - y0;
    const ndc = [v.width / cw, v.height / ch, (2 * (v.x - x0) + v.width - cw) / cw, (2 * (v.y - y0) + v.height - ch) / ch];
    if (ndc.some((n, i) => n !== pass.ndc[i])) {
      pass.ndc.set(ndc);
      pass.ndcLap = -1;
    }
    pass.encoder.setViewport(x0, H - y1, cw, ch, 0, 1);
  }

  applyScissor(pass: OpenPass): void {
    const { width: W, height: H } = pass.target;
    const s = pass.scissor ?? { x: 0, y: 0, width: W, height: H };
    const x0 = Math.min(W, Math.max(0, s.x));
    const y0 = Math.min(H, Math.max(0, s.y));
    const x1 = Math.max(x0, Math.min(W, s.x + s.width));
    const y1 = Math.max(y0, Math.min(H, s.y + s.height));
    const r = topDown({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, H);
    pass.encoder.setScissorRect(r.x, r.y, r.width, r.height);
  }

  clearStencilBits(mask: number): void {
    const pass = this.pass;
    if (!pass || !pass.target.stencil) return;
    this.utility.clear(pass.encoder, pass.target, { color: false, stencilMask: mask });
    this.applyViewport(pass);
  }
}
