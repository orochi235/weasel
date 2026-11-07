import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { reflectWgsl } from '../wgslReflect';
import { createUniformBlock } from '../wgslUniforms';
import { BufferUsage, MapMode, TextureUsage } from '../flags';
import { identityNdcGroups } from './testNdc';
import { assembleCustomWgsl } from './customPrelude';
import { assembleEffectWgsl } from './effectPrelude';
import { PATH_FILL_VCOLOR_WGSL, PATH_FILL_WGSL } from './pathFill';

let device: GPUDevice;

afterAll(() => device.destroy());

beforeAll(async () => {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('no WebGPU adapter: the browser project launches Chromium with --enable-unsafe-webgpu');
  device = await adapter.requestDevice();
});

async function errorsOf(code: string): Promise<string[]> {
  const info = await device.createShaderModule({ code }).getCompilationInfo();
  return info.messages.filter((m) => m.type === 'error').map((m) => `${m.lineNum}:${m.linePos} ${m.message}`);
}

describe('the kit WGSL', () => {
  it('compiles pathFill, flat and per-vertex color', async () => {
    expect(await errorsOf(PATH_FILL_WGSL)).toEqual([]);
    expect(await errorsOf(PATH_FILL_VCOLOR_WGSL)).toEqual([]);
  });

  it('compiles a custom program on the kit vertex stage, and one with its own', async () => {
    const frag = `
struct Params { u_tint: vec4f }
@group(1) @binding(0) var<uniform> params: Params;
@group(1) @binding(1) var u_tex: texture_2d<f32>;
@group(1) @binding(2) var u_tex_sampler: sampler;
fn fragment(in: Varyings) -> vec4f {
  return textureSample(u_tex, u_tex_sampler, in.uv) * params.u_tint + vec4f(in.world, in.position.xy) * 0.0;
}`;
    expect(await errorsOf(assembleCustomWgsl({ frag }))).toEqual([]);
    const vert = 'fn vertex(v: KitVertex) -> Varyings { var o = kitVertex(v); o.uv = o.uv * 2.0; return o; }';
    expect(await errorsOf(assembleCustomWgsl({ vert, frag }))).toEqual([]);
  });

  it('compiles an effect', async () => {
    const frag = 'fn effect(in: EffectVaryings) -> vec4f { return textureSample(source, source_sampler, in.uv + kit.texel); }';
    expect(await errorsOf(assembleEffectWgsl(frag))).toEqual([]);
  });
});

describe('pathFill drawn with reflected uniforms', () => {
  it('paints its premultiplied color and claims the id target', async () => {
    const size = 4;
    const usage = TextureUsage.RENDER_ATTACHMENT | TextureUsage.COPY_SRC;
    const color = device.createTexture({ size: [size, size], format: 'rgba8unorm', usage });
    const ids = device.createTexture({ size: [size, size], format: 'rgba8unorm', usage });
    const module = device.createShaderModule({ code: PATH_FILL_WGSL });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs', buffers: [{ arrayStride: 8, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }] }] },
      fragment: { module, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }, { format: 'rgba8unorm' }] },
    });

    const block = createUniformBlock(reflectWgsl(PATH_FILL_WGSL), 'Uniforms');
    // Screen pixels 0..4 to clip space, y down.
    block.set('u_proj', [2 / size, 0, 0, 0, -2 / size, 0, -1, 1, 1]);
    block.set('u_model', [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    block.set('u_origin', [0, 0]);
    block.set('u_color', [1, 0.5, 0, 0.5]);
    block.set('u_alpha', 1);
    block.set('u_colorMatrix', [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    block.set('u_colorBias', [0, 0, 0, 0]);
    block.set('u_weaselId', [0x12 / 255, 0x34 / 255, 0x56 / 255, 1 / 255]);
    const ubo = device.createBuffer({ size: block.size, usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST });
    device.queue.writeBuffer(ubo, 0, block.bytes);
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubo } }] });

    // The left half of the target, in screen pixels.
    const verts = new Float32Array([0, 0, 2, 0, 2, 4, 0, 0, 2, 4, 0, 4]);
    const vbo = device.createBuffer({ size: verts.byteLength, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    device.queue.writeBuffer(vbo, 0, verts);

    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [color, ids].map((t) => ({
        view: t.createView(), loadOp: 'clear' as const, storeOp: 'store' as const, clearValue: [0, 0, 0, 0],
      })),
    });
    pass.setPipeline(pipeline);
    identityNdcGroups(device, pipeline, [bind]).forEach((g, i) => pass.setBindGroup(i, g));
    pass.setVertexBuffer(0, vbo);
    pass.draw(6);
    pass.end();
    const read = [color, ids].map((t) => {
      const buf = device.createBuffer({ size: 256 * size, usage: BufferUsage.COPY_DST | BufferUsage.MAP_READ });
      enc.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: 256 }, [size, size]);
      return buf;
    });
    device.queue.submit([enc.finish()]);
    const [c, id] = await Promise.all(read.map(async (b) => {
      await b.mapAsync(MapMode.READ);
      return new Uint8Array(b.getMappedRange().slice(0));
    }));

    // Row 1: x = 0 painted, x = 3 untouched.
    const at = (bytes: Uint8Array, x: number) => Array.from(bytes.slice(256 + 4 * x, 256 + 4 * x + 4));
    expect(at(c, 0)).toEqual([128, 64, 0, 128]);
    expect(at(c, 3)).toEqual([0, 0, 0, 0]);
    expect(at(id, 0)).toEqual([0x12, 0x34, 0x56, 255]);
    expect(at(id, 3)).toEqual([0, 0, 0, 0]);
  });
});
