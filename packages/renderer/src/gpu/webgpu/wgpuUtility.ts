/** The device's own draws: clears confined to a scissor, which a load op
 *  cannot be, and mipmaps, drawn a level at a time from the one above. */
import { ColorWrite } from './flags';
import { stencilState } from './wgpuPipelines';
import { gpuTexture, replaceTexture, type ResourceHost, type WgpuTexture } from './wgpuResources';
import { DEPTH_STENCIL, type PassAttachments } from './wgpuTargets';

const FULL_TRIANGLE_WGSL = /* wgsl */ `
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}
`;

const CLEAR_WGSL = /* wgsl */ `${FULL_TRIANGLE_WGSL}
struct Cleared {
  @location(0) color: vec4f,
  @location(1) id: vec4f,
}
@fragment fn fs() -> Cleared {
  return Cleared(vec4f(0.0), vec4f(0.0));
}
`;

const MIP_WGSL = /* wgsl */ `${FULL_TRIANGLE_WGSL}
@group(0) @binding(0) var above: texture_2d<f32>;
@group(0) @binding(1) var above_sampler: sampler;
@fragment fn fs(@builtin(position) p: vec4f) -> @location(0) vec4f {
  return textureSampleLevel(above, above_sampler, p.xy / vec2f(max(textureDimensions(above) / 2u, vec2u(1u))), 0.0);
}
`;

/** What a clear draw writes: the color attachments, and the stencil bits of `stencilMask`. */
export interface ClearSpec {
  readonly color: boolean;
  readonly stencilMask: number;
}

export class UtilityDraws {
  private readonly clearModule: GPUShaderModule;
  private readonly mipModule: GPUShaderModule;
  private readonly empty: GPUPipelineLayout;
  private readonly clears = new Map<string, GPURenderPipeline>();
  private readonly mips = new Map<GPUTextureFormat, GPURenderPipeline>();
  private readonly linear: GPUSampler;

  constructor(private readonly device: GPUDevice) {
    this.clearModule = device.createShaderModule({ code: CLEAR_WGSL });
    this.mipModule = device.createShaderModule({ code: MIP_WGSL });
    this.empty = device.createPipelineLayout({ bindGroupLayouts: [] });
    this.linear = device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
  }

  /** Draw a clear over the whole target, under whatever scissor the pass has. */
  clear(pass: GPURenderPassEncoder, target: PassAttachments, spec: ClearSpec): void {
    const key = `${target.key}|${spec.color ? 1 : 0}|${spec.stencilMask}`;
    let pipeline = this.clears.get(key);
    if (!pipeline) {
      const writeMask = spec.color ? ColorWrite.ALL : 0;
      const targets: GPUColorTargetState[] = [{ format: target.format, writeMask }];
      if (target.hasIds) targets.push({ format: 'rgba8unorm', writeMask });
      const stencil = spec.stencilMask === 0 ? null
        : { compare: 'always' as const, ref: 0, readMask: 0xFF, writeMask: spec.stencilMask, pass: 'zero' as const };
      pipeline = this.device.createRenderPipeline({
        layout: this.empty,
        vertex: { module: this.clearModule, entryPoint: 'vs' },
        fragment: { module: this.clearModule, entryPoint: 'fs', targets },
        primitive: { topology: 'triangle-list' },
        multisample: { count: target.sampleCount },
        ...(target.stencil && {
          depthStencil: { format: DEPTH_STENCIL, depthWriteEnabled: false, depthCompare: 'always', ...stencilState(stencil) },
        }),
      });
      this.clears.set(key, pipeline);
    }
    pass.setPipeline(pipeline);
    pass.setViewport(0, 0, target.width, target.height, 0, 1);
    pass.draw(3);
  }

  /** Give `texture` every level, each a box filter of the one above, in `encoder`. */
  generateMipmaps(host: ResourceHost, encoder: GPUCommandEncoder, texture: WgpuTexture): void {
    const { width, height } = texture;
    const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    if (texture.mipLevels < levels) {
      const old = texture.gpu;
      const grown = gpuTexture(this.device, texture.format, width, height, levels);
      encoder.copyTextureToTexture({ texture: old }, { texture: grown }, [width, height]);
      replaceTexture(host, texture, grown, width, height, levels);
    }
    const format = texture.gpu.format;
    let pipeline = this.mips.get(format);
    if (!pipeline) {
      pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: this.mipModule, entryPoint: 'vs' },
        fragment: { module: this.mipModule, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      this.mips.set(format, pipeline);
    }
    for (let level = 1; level < levels; level++) {
      const above = texture.gpu.createView({ baseMipLevel: level - 1, mipLevelCount: 1 });
      const group = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: above }, { binding: 1, resource: this.linear }],
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: texture.gpu.createView({ baseMipLevel: level, mipLevelCount: 1 }), loadOp: 'clear', storeOp: 'store',
          clearValue: [0, 0, 0, 0],
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.draw(3);
      pass.end();
    }
  }
}
