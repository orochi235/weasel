import { beforeAll, describe, expect, it } from 'vitest';
import { reflectWgsl } from '../wgslReflect';
import { createUniformBlock, type UniformValue } from '../wgslUniforms';
import { KIT_WGSL_PROGRAMS, type KitWgslProgram } from './kitPrograms';
import { HULL_ORIGIN_BIAS, HULL_ORIGIN_SPAN } from '../../../batchHull';
import { withHull } from '../../../shaders/batchFill';
import { batchFillWgsl, BATCH_FILL_LOCATIONS } from './batchFill';
import { COMPOSITE_LOCATIONS, COMPOSITE_WGSL } from './composite';
import { assembleEffectWgsl } from './effectPrelude';
import { BLUR_EFFECT_WGSL } from './effects';
import { GRAD_FILL_LOCATIONS, GRAD_FILL_WGSL } from './gradFill';
import { PATH_FILL_LOCATIONS, PATH_FILL_WGSL } from './pathFill';

async function requestTestDevice(): Promise<GPUDevice> {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('no WebGPU adapter: the browser project launches Chromium with --enable-unsafe-webgpu');
  return adapter.requestDevice();
}

/** The vertex format of each attribute name the kit's programs use. */
const ATTRIBUTE_FORMATS: Readonly<Record<string, GPUVertexFormat>> = {
  a_position: 'float32x2', a_uv: 'float32x2', a_vertexColor: 'float32x4', a_post: 'float32', a_texSlot: 'float32',
  a_trim: 'float32x4',
};

const FLOATS: Readonly<Record<string, number>> = { float32: 1, float32x2: 2, float32x4: 4 };

/** One interleaved buffer holding `locations`' attributes in location order. */
function vertexLayout(locations: Readonly<Record<string, number>>): GPUVertexBufferLayout {
  const attributes: GPUVertexAttribute[] = [];
  let offset = 0;
  for (const [name, shaderLocation] of Object.entries(locations).sort((a, b) => a[1] - b[1])) {
    const format = ATTRIBUTE_FORMATS[name];
    attributes.push({ shaderLocation, offset, format });
    offset += 4 * FLOATS[format];
  }
  return { arrayStride: offset, attributes };
}

function vertexBuffer(device: GPUDevice, data: number[]): GPUBuffer {
  const verts = new Float32Array(data);
  const vbo = device.createBuffer({ size: verts.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(vbo, 0, verts);
  return vbo;
}

/** A uniform buffer for struct `struct` of `code`, its members set by name. */
function uniformBuffer(device: GPUDevice, code: string, struct: string,
  values: Record<string, UniformValue>): GPUBuffer {
  const block = createUniformBlock(reflectWgsl(code), struct);
  for (const [name, value] of Object.entries(values)) {
    if (!block.set(name, value)) throw new Error(`${struct} has no member ${name}`);
  }
  const ubo = device.createBuffer({ size: block.size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(ubo, 0, block.bytes);
  return ubo;
}

/** An rgba8 texture `width` wide holding `texels`, row by row from the top. */
function texture(device: GPUDevice, width: number, height: number, texels: number[],
  usage = 0): GPUTexture {
  const t = device.createTexture({
    size: [width, height], format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | usage,
  });
  device.queue.writeTexture({ texture: t }, new Uint8Array(texels), { bytesPerRow: 4 * width }, [width, height]);
  return t;
}

function target(device: GPUDevice, width: number, height: number): GPUTexture {
  return device.createTexture({
    size: [width, height], format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
  });
}

const IDENTITY3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const IDENTITY4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Screen pixels `0..width × 0..height` to clip space, y down. */
function screenToClip(width: number, height: number): number[] {
  return [2 / width, 0, 0, 0, -2 / height, 0, -1, 1, 1];
}

/** `QUAD_VERTICES` as two triangles: position, then uv. */
const QUAD = [-1, -1, 0, 0, 1, -1, 1, 0, 1, 1, 1, 1, -1, -1, 0, 0, 1, 1, 1, 1, -1, 1, 0, 1];

interface Pass {
  pipeline: GPURenderPipeline;
  groups: GPUBindGroup[];
  vbo: GPUBuffer;
  count: number;
}

/** Draw `pass` into `targets` (cleared first), then read each back. Rows of
 *  the result are 256 bytes apart. */
async function drawAndRead(device: GPUDevice, targets: Array<GPUTexture | null>,
  pass: Pass): Promise<Array<Uint8Array | null>> {
  const enc = device.createCommandEncoder();
  const rp = enc.beginRenderPass({
    colorAttachments: targets.map((t) => t && {
      view: t.createView(), loadOp: 'clear' as const, storeOp: 'store' as const, clearValue: [0, 0, 0, 0],
    }),
  });
  rp.setPipeline(pass.pipeline);
  pass.groups.forEach((g, i) => rp.setBindGroup(i, g));
  rp.setVertexBuffer(0, pass.vbo);
  rp.draw(pass.count);
  rp.end();
  const reads = targets.map((t) => {
    if (!t) return null;
    const buf = device.createBuffer({ size: 256 * t.height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    enc.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: 256 }, [t.width, t.height]);
    return buf;
  });
  device.queue.submit([enc.finish()]);
  return Promise.all(reads.map(async (b) => {
    if (!b) return null;
    await b.mapAsync(GPUMapMode.READ);
    return new Uint8Array(b.getMappedRange().slice(0));
  }));
}

/** The RGBA bytes at `(x, y)` of a read-back target. */
function texelAt(bytes: Uint8Array | null, x: number, y: number): number[] {
  if (!bytes) throw new Error('no target read back');
  const i = 256 * y + 4 * x;
  return Array.from(bytes.slice(i, i + 4));
}

/** Whether each channel of `got` is within `tolerance` of `want`. */
function near(got: number[], want: number[], tolerance = 1): boolean {
  return got.length === want.length && got.every((v, i) => Math.abs(v - want[i]) <= tolerance);
}

let device: GPUDevice;
let linear: GPUSampler;

beforeAll(async () => {
  device = await requestTestDevice();
  linear = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
});

function pipeline(code: string, locations: Readonly<Record<string, number>>, targets: number,
  entry: [string, string] = ['vs', 'fs']): GPURenderPipeline {
  const module = device.createShaderModule({ code });
  return device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: entry[0], buffers: [vertexLayout(locations)] },
    fragment: { module, entryPoint: entry[1], targets: Array.from({ length: targets }, () => ({ format: 'rgba8unorm' as const })) },
  });
}

function group(p: GPURenderPipeline, index: number, resources: GPUBindingResource[]): GPUBindGroup {
  return device.createBindGroup({
    layout: p.getBindGroupLayout(index),
    entries: resources.map((resource, binding) => ({ binding, resource })),
  });
}

/** Screen-space rect `x0..x1 × y0..y1` as two triangles of bare positions. */
const rect = (x0: number, y0: number, x1: number, y1: number) => [x0, y0, x1, y0, x1, y1, x0, y0, x1, y1, x0, y1];

const ID = [0x12 / 255, 0x34 / 255, 0x56 / 255, 1 / 255];

describe('the kit WGSL programs drawn', () => {
  it('gradFill reads its linear ramp at each pixel', async () => {
    const p = pipeline(GRAD_FILL_WGSL, GRAD_FILL_LOCATIONS, 2);
    const ubo = uniformBuffer(device, GRAD_FILL_WGSL, 'Uniforms', {
      u_proj: screenToClip(4, 4), u_model: IDENTITY3, u_origin: [0, 0], u_worldInv: IDENTITY3,
      u_colorMatrix: IDENTITY4, u_colorBias: [0, 0, 0, 0], u_alpha: 1, u_opacity: 1, u_rampV: 0.5,
      u_gradKind: 0, u_gradDir: [1, 0], u_gradLen: 4, u_gradRadius: 1, u_gradAngle: 0, u_weaselId: ID,
    });
    const ramp = texture(device, 2, 1, [0, 0, 0, 255, 255, 255, 255, 255]);
    const out = [target(device, 4, 4), target(device, 4, 4)];
    const [c] = await drawAndRead(device, out, {
      pipeline: p, count: 6, vbo: vertexBuffer(device, rect(0, 0, 4, 4)),
      groups: [group(p, 0, [{ buffer: ubo }]), group(p, 1, [ramp.createView(), linear])],
    });
    // t = (x + 0.5) / 4 over a two-texel ramp: texel coordinate 2t - 0.5.
    const want = [0, 64, 191, 255];
    for (let x = 0; x < 4; x++) expect(near(texelAt(c, x, 2), [want[x], want[x], want[x], 255])).toBe(true);
  });

  it('blur spreads a lit texel over the nine-tap kernel', async () => {
    const code = assembleEffectWgsl(BLUR_EFFECT_WGSL);
    const p = pipeline(code, { a_position: 0, a_uv: 1 }, 1, ['weasel_vs', 'weasel_fs']);
    const texels = Array.from({ length: 16 }, (_, x) => (x === 8 ? [255, 255, 255, 255] : [0, 0, 0, 0])).flat();
    const source = texture(device, 16, 1, texels);
    const kit = uniformBuffer(device, code, 'EffectKit', { resolution: [16, 1], texel: [1 / 16, 1], windowOrigin: [0, 0] });
    const params = uniformBuffer(device, code, 'Params', { u_direction: [1, 0], u_radius: 4 });
    const [c] = await drawAndRead(device, [target(device, 16, 1)], {
      pipeline: p, count: 6, vbo: vertexBuffer(device, QUAD),
      groups: [group(p, 0, [{ buffer: kit }, source.createView(), linear]), group(p, 1, [{ buffer: params }])],
    });
    const weights = [0.2270270, 0.1945946, 0.1216216, 0.0540541, 0.0162162, 0];
    for (let k = 0; k <= 5; k++) {
      const v = Math.round(255 * weights[k]);
      expect(near(texelAt(c, 8 + k, 0), [v, v, v, v])).toBe(true);
      expect(near(texelAt(c, 8 - k, 0), [v, v, v, v])).toBe(true);
    }
  });

  it('composite keeps a rendered source the right way up, under its alpha and color matrix', async () => {
    // The source's top half drawn red by pathFill, as the renderer draws a group.
    const fill = pipeline(PATH_FILL_WGSL, PATH_FILL_LOCATIONS, 1);
    const fillUbo = uniformBuffer(device, PATH_FILL_WGSL, 'Uniforms', {
      u_proj: screenToClip(4, 4), u_model: IDENTITY3, u_origin: [0, 0], u_color: [1, 0, 0, 1], u_alpha: 1,
      u_colorMatrix: IDENTITY4, u_colorBias: [0, 0, 0, 0], u_weaselId: ID,
    });
    const source = target(device, 4, 4);
    await drawAndRead(device, [source], {
      pipeline: fill, count: 6, vbo: vertexBuffer(device, rect(0, 0, 4, 2)), groups: [group(fill, 0, [{ buffer: fillUbo }])],
    });

    const p = pipeline(COMPOSITE_WGSL, COMPOSITE_LOCATIONS, 2);
    const swapRedGreen = [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const ubo = uniformBuffer(device, COMPOSITE_WGSL, 'Uniforms', {
      u_colorMatrix: swapRedGreen, u_colorBias: [0, 0, 0.25, 0], u_alpha: 0.5, u_weaselId: ID,
    });
    const [c, id] = await drawAndRead(device, [target(device, 4, 4), target(device, 4, 4)], {
      pipeline: p, count: 6, vbo: vertexBuffer(device, QUAD),
      groups: [group(p, 0, [{ buffer: ubo }]), group(p, 1, [source.createView(), linear])],
    });
    expect(near(texelAt(c, 1, 0), [0, 128, 32, 128])).toBe(true);
    expect(texelAt(c, 1, 3)).toEqual([0, 0, 0, 0]);
    expect(texelAt(id, 1, 0)).toEqual([0x12, 0x34, 0x56, 255]);
    expect(texelAt(id, 1, 3)).toEqual([0, 0, 0, 0]);
  });

  it('the batch hull build clips in GL window space, turned over by u_targetHeight', async () => {
    const code = batchFillWgsl({ matrices: false, hulls: true, area: false });
    const p = pipeline(code, BATCH_FILL_LOCATIONS, 2);
    // One plane, inside where 32 - Y >= 0: GL's bottom two rows, the target's last two.
    const origin = HULL_ORIGIN_BIAS + HULL_ORIGIN_BIAS * HULL_ORIGIN_SPAN;
    const planes = new Int32Array(4 * 64);
    planes.set([0, -1, 32, origin]);
    const ubo = uniformBuffer(device, code, 'Uniforms', {
      u_proj: screenToClip(4, 4), u_model: IDENTITY3, u_color: [1, 1, 1, 1], u_alpha: 1,
      u_colorMatrix: IDENTITY4, u_colorBias: [0, 0, 0, 0], u_fieldScale: new Float32Array(32),
      u_hullPlanes: planes, u_targetHeight: 4, u_weaselId: ID,
    });
    const white = texture(device, 1, 1, [255, 255, 255, 255]).createView();
    const textures: GPUBindingResource[] = Array.from({ length: 16 }, () => white);
    const samplers: GPUBindingResource[] = Array.from({ length: 15 }, () => linear);
    const layout = p.getBindGroupLayout(1);
    const textureGroup = device.createBindGroup({
      layout,
      entries: [
        ...textures.map((resource, binding) => ({ binding, resource })),
        ...samplers.map((resource, i) => ({ binding: 17 + i, resource })),
      ],
    });
    const slot = withHull(0, 0, 1);
    const verts = rect(0, 0, 4, 4);
    const data: number[] = [];
    for (let i = 0; i < verts.length; i += 2) data.push(verts[i], verts[i + 1], 1, 0, 0, 1, 0.5, 0.5, 1, slot);
    const [c] = await drawAndRead(device, [target(device, 4, 4), target(device, 4, 4)], {
      pipeline: p, count: 6, vbo: vertexBuffer(device, data), groups: [group(p, 0, [{ buffer: ubo }]), textureGroup],
    });
    expect(texelAt(c, 1, 0)).toEqual([0, 0, 0, 0]);
    expect(texelAt(c, 1, 1)).toEqual([0, 0, 0, 0]);
    expect(texelAt(c, 1, 2)).toEqual([255, 0, 0, 255]);
    expect(texelAt(c, 1, 3)).toEqual([255, 0, 0, 255]);
  });
});

function targetsOf(p: KitWgslProgram): GPUColorTargetState[] {
  if (p.outputs === 'color') return [{ format: 'rgba8unorm' }];
  if (p.outputs === 'id') return [{ format: 'rgba8unorm', writeMask: 0 }, { format: 'rgba8unorm' }];
  return [{ format: 'rgba8unorm' }, { format: 'rgba8unorm' }];
}

describe('every kit WGSL program', () => {
  it.each(KIT_WGSL_PROGRAMS.map((p) => [p.name, p] as const))('%s compiles and builds a pipeline', async (_, p) => {
    const module = device.createShaderModule({ code: p.code });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);
    expect(errors).toEqual([]);
    device.pushErrorScope('validation');
    await device.createRenderPipelineAsync({
      layout: 'auto',
      vertex: { module, entryPoint: p.effect ? 'weasel_vs' : 'vs', buffers: [vertexLayout(p.locations)] },
      fragment: { module, entryPoint: p.effect ? 'weasel_fs' : 'fs', targets: targetsOf(p) },
    });
    const error = await device.popErrorScope();
    expect(error?.message ?? null).toBeNull();
  });
});
