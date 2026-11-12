/**
 * The GPU layer over a WebGPU device. Uniforms go through one ring buffer at
 * dynamic offsets (`UniformRing`); everything else a draw is drawn under
 * picks a pipeline, made once per program and state (`wgpuPipelines.ts`).
 */
import type {
  GpuBuffer, GpuBufferUsage, GpuDevice, GpuDrawState, GpuGeometry, GpuGeometryDesc, GpuLimits, GpuPassDesc,
  GpuProgram, GpuProgramSource, GpuRect, GpuSampling, GpuTarget, GpuTargetDesc, GpuTexture, GpuTextureData,
  GpuTextureFormat,
} from '../types';
import { BufferUsage, ShaderStage } from './flags';
import { Frame, UniformRing } from './wgpuFrame';
import { DEFAULT_ATTRIBUTE, needsDefaultAttribute, pipelineFor } from './wgpuPipelines';
import { NDC_GROUP, WgpuProgram, type WgpuProgramHost } from './wgpuProgram';
import * as res from './wgpuResources';
import {
  CanvasTarget, createTarget, deleteTarget, encodeReadIds, encodeReadTexture, encodeResolve, type WgpuTarget,
} from './wgpuTargets';
import { UtilityDraws } from './wgpuUtility';
import { deviceIsLost, watchDeviceLoss } from './deviceLoss';

const RING_BYTES = 4 << 20;

export class WebGPUDevice implements GpuDevice, WgpuProgramHost {
  readonly language = 'wgsl' as const;
  readonly limits: GpuLimits;
  readonly ringBuffer: GPUBuffer;
  readonly ndcLayout: GPUBindGroupLayout;
  readonly dummyTexture: res.WgpuTexture;
  readonly standardLayout = navigator.gpu?.wgslLanguageFeatures?.has('uniform_buffer_standard_layout') ?? false;
  private readonly frame: Frame;
  private readonly ring: UniformRing;
  private readonly utility: UtilityDraws;
  private readonly samplers: res.Samplers;
  private readonly ndcGroup: GPUBindGroup;
  private readonly defaultAttribute: GPUBuffer;
  private readonly canvas: CanvasTarget;

  constructor(
    readonly device: GPUDevice,
    private readonly surface: HTMLCanvasElement | OffscreenCanvas,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    antialias: boolean,
  ) {
    this.limits = { maxTextureSize: device.limits.maxTextureDimension2D, samples: antialias ? 4 : 0, stencil: true };
    this.ring = new UniformRing(device, RING_BYTES);
    this.ringBuffer = this.ring.buffer;
    this.utility = new UtilityDraws(device);
    this.frame = new Frame(device, this.ring, this.utility);
    this.samplers = new res.Samplers(device);
    this.ndcLayout = device.createBindGroupLayout({
      entries: [{
        binding: 0, visibility: ShaderStage.VERTEX, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 16 },
      }],
    });
    this.ndcGroup = device.createBindGroup({
      layout: this.ndcLayout, entries: [{ binding: 0, resource: { buffer: this.ringBuffer, size: 16 } }],
    });
    this.defaultAttribute = device.createBuffer({ size: 16, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    device.queue.writeBuffer(this.defaultAttribute, 0, DEFAULT_ATTRIBUTE);
    this.dummyTexture = res.createTexture(this.frame, 'rgba8', { min: 'nearest', mag: 'nearest', wrapS: 'clamp', wrapT: 'clamp' },
      { width: 1, height: 1, data: new Uint8Array(4) });
    this.canvas = new CanvasTarget(this.frame, surface, context, format, antialias ? 4 : 1);
    watchDeviceLoss(device);
  }

  isContextLost(): boolean {
    return deviceIsLost(this.device);
  }

  canvasSize(): { width: number; height: number } {
    return { width: this.surface.width, height: this.surface.height };
  }

  beginFrame(): void {}

  sampler(sampling: GpuSampling): GPUSampler {
    return this.samplers.get(sampling);
  }

  createProgram(source: GpuProgramSource): GpuProgram {
    if (source.wgsl === undefined) throw new Error('weasel: the WebGPU renderer draws a program only from WGSL source');
    return new WgpuProgram(this, source.wgsl);
  }

  deleteProgram(program: GpuProgram): void {
    (program as WgpuProgram).pipelines.clear();
  }

  createBuffer(kind: GpuBuffer['kind'], init: number | ArrayBufferView, usage: GpuBufferUsage): GpuBuffer {
    return res.createBuffer(this.frame, kind, init, usage);
  }

  resizeBuffer(buffer: GpuBuffer, init: number | ArrayBufferView): void {
    res.resizeBuffer(this.frame, buffer as res.WgpuBuffer, init);
  }

  writeBuffer(buffer: GpuBuffer, dstByteOffset: number, data: ArrayBufferView, srcOffset?: number, length?: number): void {
    res.writeBuffer(this.frame, buffer as res.WgpuBuffer, dstByteOffset, data, srcOffset, length);
  }

  deleteBuffer(buffer: GpuBuffer): void {
    this.frame.retire((buffer as res.WgpuBuffer).gpu);
  }

  createGeometry(desc: GpuGeometryDesc): GpuGeometry {
    return res.createGeometry(desc);
  }

  deleteGeometry(): void {}

  createTexture(format: GpuTextureFormat, sampling: GpuSampling, data: GpuTextureData): GpuTexture {
    return res.createTexture(this.frame, format, sampling, data);
  }

  writeTexture(texture: GpuTexture, data: GpuTextureData): void {
    res.writeTexture(this.frame, texture as res.WgpuTexture, data);
  }

  writeSubTexture(texture: GpuTexture, x: number, y: number, width: number, height: number, data: ArrayBufferView): void {
    res.writeSubTexture(this.frame, texture as res.WgpuTexture, x, y, width, height, data);
  }

  generateMipmaps(texture: GpuTexture): void {
    const t = texture as res.WgpuTexture;
    this.frame.beforeWrite(t);
    this.frame.outsidePass((encoder) => this.utility.generateMipmaps(this.frame, encoder, t));
    t.usedIn = this.frame.serial;
  }

  setSampling(texture: GpuTexture, sampling: Partial<GpuSampling>): void {
    const t = texture as res.WgpuTexture;
    t.sampling = { ...t.sampling, ...sampling };
  }

  deleteTexture(texture: GpuTexture): void {
    this.frame.retire((texture as res.WgpuTexture).gpu);
  }

  createTarget(desc: GpuTargetDesc): GpuTarget {
    return createTarget(this.frame, desc);
  }

  deleteTarget(target: GpuTarget): void {
    deleteTarget(this.frame, target as WgpuTarget);
  }

  beginPass(desc: GpuPassDesc): void {
    this.frame.begin(desc, desc.target ? (desc.target as WgpuTarget) : this.canvas);
  }

  endPass(): void {
    this.frame.end();
  }

  setViewport(rect: GpuRect): void {
    const pass = this.frame.pass;
    if (!pass) return;
    pass.viewport = rect;
    this.frame.applyViewport(pass);
  }

  setScissor(rect: GpuRect | null): void {
    const pass = this.frame.pass;
    if (!pass) return;
    pass.scissor = rect;
    this.frame.applyScissor(pass);
  }

  clearStencilBits(mask: number): void {
    this.frame.clearStencilBits(mask);
  }

  draw(state: GpuDrawState, geometry: GpuGeometry, count: number, firstIndex = 0): void {
    const frame = this.frame;
    if (!frame.pass || frame.pass.skip || count === 0) return;
    const program = state.program as WgpuProgram;
    if (program.refused) return;
    const geom = geometry as res.WgpuGeometry;
    program.set1i('u_targetHeight', frame.pass.target.height);
    this.uploadUniforms(program);
    const pass = frame.pass;
    const { target, encoder } = pass;
    const pipeline = pipelineFor(this.device, program, geom, target, state);
    if (!pipeline) return;
    if (pass.pipeline !== pipeline) {
      encoder.setPipeline(pipeline);
      pass.pipeline = pipeline;
    }
    const serial = frame.serial;
    for (let g = 0; g < 2; g++) {
      const textures = program.boundTextures(g, target.attached);
      for (const t of textures) t.usedIn = serial;
      encoder.setBindGroup(g, program.bindGroup(g, textures), program.offsets(g));
    }
    if (program.usesNdc) encoder.setBindGroup(NDC_GROUP, this.ndcGroup, [pass.ndcOffset]);
    geom.buffers.forEach((b, i) => {
      encoder.setVertexBuffer(i, b.gpu);
      b.usedIn = serial;
    });
    if (needsDefaultAttribute(program, geom)) encoder.setVertexBuffer(geom.buffers.length, this.defaultAttribute);
    encoder.setIndexBuffer(geom.indexBuffer.gpu, geom.indexFormat);
    geom.indexBuffer.usedIn = serial;
    if (target.stencil) encoder.setStencilReference(state.stencil?.ref ?? 0);
    encoder.drawIndexed(count, 1, firstIndex);
  }

  /** Put the program's changed blocks, and the pass's viewport fold, in the
   *  ring. A wrap submits and resumes the pass, so this runs before anything
   *  is set on it. */
  private uploadUniforms(program: WgpuProgram): void {
    const ring = this.ring;
    const align = ring.align;
    for (;;) {
      const pass = this.frame.pass!;
      const lap = ring.lap;
      const blocks = program.uploadBytes(lap, align);
      const ndc = program.usesNdc && pass.ndcLap !== lap ? align : 0;
      if (blocks + ndc === 0) return;
      const at = ring.reserve(blocks + ndc, () => this.frame.flush());
      if (at === null) continue;
      program.upload(ring.mirror, at, lap, align);
      if (ndc) {
        new Float32Array(ring.mirror.buffer, at + blocks, 4).set(pass.ndc);
        pass.ndcOffset = at + blocks;
        pass.ndcLap = lap;
      }
      return;
    }
  }

  resolve(source: GpuTarget, dest: GpuTarget, width: number, height: number, x: number, y: number): void {
    const from = source as WgpuTarget;
    const into = dest as WgpuTarget;
    this.frame.outsidePass((encoder) => encodeResolve(this.frame, encoder, from, into, width, height, x, y));
    from.markUsed(this.frame.serial);
    into.markUsed(this.frame.serial);
  }

  readIds(target: GpuTarget, rect: GpuRect): Promise<Uint8Array> {
    let read: () => Promise<Uint8Array> = () => Promise.resolve(new Uint8Array(0));
    this.frame.outsidePass((encoder) => {
      read = encodeReadIds(this.device, encoder, target as WgpuTarget, rect);
    });
    this.frame.flush();
    return read();
  }

  readCanvas(rect: GpuRect): Promise<Uint8Array> {
    let read: () => Promise<Uint8Array> = () => Promise.resolve(new Uint8Array(rect.width * rect.height * 4));
    const texture = this.canvas.frameTexture();
    this.frame.outsidePass((encoder) => {
      read = encodeReadTexture(this.device, encoder, texture, this.surface.height, rect);
    });
    this.frame.flush();
    return read();
  }

  dispose(): void {
    this.frame.end();
    this.canvas.dispose();
    for (const object of [this.ringBuffer, this.defaultAttribute, this.dummyTexture.gpu]) this.frame.retire(object);
    this.frame.flush();
  }
}
