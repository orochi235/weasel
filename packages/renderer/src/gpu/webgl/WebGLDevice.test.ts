/**
 * What the WebGL backend sends for the layer's calls. The recorder has no
 * pixels, so these pin the calls; the browser tests read what they paint.
 */
import { describe, expect, it } from 'vitest';
import { makeGLRecorder, type GLRecorder } from '../../testing/glRecorder';
import { PREMULTIPLIED } from '../blend';
import type { GpuDrawState, GpuStencilState } from '../types';
import { WebGLDevice } from './WebGLDevice';

const VERT = '#version 300 es\nin vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); }\n';
const FRAG = '#version 300 es\nprecision highp float;\nuniform sampler2D u_a;\nuniform sampler2D u_b;\n'
  + 'out vec4 o;\nvoid main() { o = texture(u_a, vec2(0.0)) + texture(u_b, vec2(0.0)); }\n';

function setup(): { rec: GLRecorder; gpu: WebGLDevice } {
  const rec = makeGLRecorder();
  const gpu = new WebGLDevice(rec.gl);
  gpu.beginFrame();
  return { rec, gpu };
}

function drawable(gpu: WebGLDevice) {
  const program = gpu.createProgram({ glsl: { vert: VERT, frag: FRAG } });
  program.lookupUniforms(['u_a', 'u_b']);
  const vertices = gpu.createBuffer('vertex', new Float32Array(6), 'static');
  const indices = gpu.createBuffer('index', new Uint32Array([0, 1, 2]), 'static');
  const geometry = gpu.createGeometry({
    vertexBuffers: [{ buffer: vertices, stride: 0, attributes: [{ location: 0, components: 2, offset: 0 }] }],
    indexBuffer: indices, indexFormat: 'uint32',
  });
  const state = (over: Partial<GpuDrawState> = {}): GpuDrawState => ({
    program, blend: PREMULTIPLIED, colorWrite: true, stencil: null, ids: false, ...over,
  });
  return { program, geometry, state };
}

const names = (rec: GLRecorder): string[] => rec.calls.map((c) => c.name);
const argsOf = (rec: GLRecorder, name: string): unknown[][] =>
  rec.calls.filter((c) => c.name === name).map((c) => [...c.args]);

describe('WebGLDevice draw state', () => {
  it('sends only what differs from the last draw, and forgets it all at a frame start', () => {
    const { rec, gpu } = setup();
    const { geometry, state } = drawable(gpu);
    const stencil: GpuStencilState = { compare: 'equal', ref: 2, readMask: 2, writeMask: 0xFF, pass: 'keep' };
    gpu.draw(state({ stencil }), geometry, 3);
    rec.reset();
    gpu.draw(state({ stencil }), geometry, 3);
    expect(names(rec)).toEqual(['drawElements']);

    gpu.beginFrame();
    rec.reset();
    gpu.draw(state({ stencil }), geometry, 3);
    expect(names(rec)).toEqual(expect.arrayContaining(['useProgram', 'enable', 'stencilFunc', 'stencilOp', 'stencilMask', 'bindVertexArray']));
  });

  it('turns blending off for an unblended draw and back on with its factors', () => {
    const { rec, gpu } = setup();
    const { geometry, state } = drawable(gpu);
    gpu.draw(state({ blend: null }), geometry, 3);
    gpu.draw(state({ blend: { source: 'zero', destination: 'source-alpha' } }), geometry, 3);
    const { gl } = rec;
    expect(argsOf(rec, 'disable')).toContainEqual([gl.BLEND]);
    expect(argsOf(rec, 'blendFunc')).toContainEqual([gl.ZERO, gl.SRC_ALPHA]);
  });

  it('zeroes only the stencil bits asked for', () => {
    const { rec, gpu } = setup();
    rec.reset();
    gpu.clearStencilBits(0x01);
    expect(rec.calls.map((c) => [c.name, ...c.args])).toEqual([
      ['stencilMask', 0x01], ['clear', rec.gl.STENCIL_BUFFER_BIT],
    ]);
  });
});

describe('WebGLDevice textures', () => {
  it('hands out a unit per sampler in the order first set, and writes each sampler once', () => {
    const { rec, gpu } = setup();
    const { program, geometry, state } = drawable(gpu);
    const sampling = { min: 'linear', mag: 'linear', wrapS: 'clamp', wrapT: 'clamp' } as const;
    const a = gpu.createTexture('rgba8', sampling, { width: 1, height: 1, data: new Uint8Array(4) });
    const b = gpu.createTexture('rgba8', sampling, { width: 1, height: 1, data: new Uint8Array(4) });
    rec.reset();
    program.setTexture('u_b', b);
    program.setTexture('u_a', a);
    program.setTexture('u_b', a);
    expect(argsOf(rec, 'uniform1i').map((args) => args[1])).toEqual([0, 1]);
    rec.reset();
    gpu.draw(state(), geometry, 3);
    // Unit 0 is already the active one: the uploads used it.
    const handle = (a as unknown as { handle: unknown }).handle;
    expect(rec.calls.filter((c) => c.name === 'activeTexture' || c.name === 'bindTexture').map((c) => [c.name, ...c.args]))
      .toEqual([['bindTexture', rec.gl.TEXTURE_2D, handle], ['activeTexture', rec.gl.TEXTURE0 + 1], ['bindTexture', rec.gl.TEXTURE_2D, handle]]);
  });

  it('premultiplies an image upload when asked, and puts the flag back', () => {
    const { rec, gpu } = setup();
    const source = { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
    const sampling = { min: 'linear', mag: 'linear', wrapS: 'clamp', wrapT: 'clamp' } as const;
    rec.reset();
    gpu.createTexture('rgba8', sampling, { source, premultiply: true });
    gpu.createTexture('rgba8', sampling, { source, premultiply: false });
    expect(rec.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL).toBe(0x9241);
    expect(argsOf(rec, 'pixelStorei')).toEqual([[0x9241, true], [0x9241, false]]);
    const order = names(rec).filter((n) => n === 'pixelStorei' || n === 'texImage2D');
    expect(order).toEqual(['pixelStorei', 'texImage2D', 'pixelStorei', 'texImage2D']);
  });

  it('empties a unit holding the texture a pass draws into', () => {
    const { rec, gpu } = setup();
    const { program, geometry, state } = drawable(gpu);
    const target = gpu.createTarget({ width: 4, height: 4 });
    program.setTexture('u_a', target.color);
    gpu.draw(state(), geometry, 3);
    rec.reset();
    gpu.beginPass({ target, viewport: { x: 0, y: 0, width: 4, height: 4 } });
    expect(argsOf(rec, 'bindTexture')).toContainEqual([rec.gl.TEXTURE_2D, null]);
  });
});

describe('WebGLDevice id targets', () => {
  it('draws the id attachment only for a draw that writes ids, and clears both', () => {
    const { rec, gpu } = setup();
    const { geometry, state } = drawable(gpu);
    const target = gpu.createTarget({ width: 4, height: 4, stencil: true, ids: true });
    const { gl } = rec;
    gpu.beginPass({ target, viewport: { x: 0, y: 0, width: 4, height: 4 } });
    rec.reset();
    gpu.draw(state({ ids: false }), geometry, 3);
    gpu.draw(state({ ids: true }), geometry, 3);
    gpu.draw(state({ colorWrite: false, ids: true }), geometry, 3);
    expect(argsOf(rec, 'drawBuffers')).toEqual([
      [[gl.COLOR_ATTACHMENT0, gl.NONE]], [[gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]], [[gl.NONE, gl.COLOR_ATTACHMENT1]],
    ]);
    gpu.endPass();
    rec.reset();
    gpu.beginPass({ target, viewport: { x: 0, y: 0, width: 4, height: 4 }, clear: { color: true } });
    expect(argsOf(rec, 'drawBuffers')).toEqual([[[gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]]]);
    expect(names(rec).indexOf('drawBuffers')).toBeLessThan(names(rec).indexOf('clear'));
  });

  it('writes no color under a stencil-only draw on an id target', () => {
    const { rec, gpu } = setup();
    const { geometry, state } = drawable(gpu);
    const target = gpu.createTarget({ width: 4, height: 4, stencil: true, ids: true });
    gpu.beginPass({ target, viewport: { x: 0, y: 0, width: 4, height: 4 } });
    rec.reset();
    gpu.draw(state({ colorWrite: false, ids: false }), geometry, 3);
    expect(argsOf(rec, 'colorMask')).toEqual([[false, false, false, false]]);
    expect(argsOf(rec, 'drawBuffers')).toEqual([]);
  });
});

describe('WebGLDevice resolve', () => {
  it('blits a whole multisampled buffer straight into its destination', () => {
    const { rec, gpu } = setup();
    const scratch = gpu.createTarget({ width: 8, height: 8, samples: 4, stencil: true });
    const surface = gpu.createTarget({ width: 8, height: 8 });
    rec.reset();
    gpu.resolve(scratch, surface, 8, 8, 0, 0);
    expect(argsOf(rec, 'blitFramebuffer')).toEqual([[0, 0, 8, 8, 0, 0, 8, 8, rec.gl.COLOR_BUFFER_BIT, rec.gl.NEAREST]]);
  });

  it('resolves part of a multisampled buffer through a single-sampled copy of the whole', () => {
    // ANGLE's Metal backend writes past the rect a multisampled blit names.
    const { rec, gpu } = setup();
    const scratch = gpu.createTarget({ width: 8, height: 8, samples: 4, stencil: true });
    const surface = gpu.createTarget({ width: 16, height: 16 });
    const before = scratch.bytes;
    rec.reset();
    gpu.resolve(scratch, surface, 4, 4, 2, 3);
    expect(argsOf(rec, 'blitFramebuffer')).toEqual([
      [0, 0, 4, 4, 0, 0, 4, 4, rec.gl.COLOR_BUFFER_BIT, rec.gl.NEAREST],
      [0, 0, 4, 4, 2, 3, 6, 7, rec.gl.COLOR_BUFFER_BIT, rec.gl.NEAREST],
    ]);
    expect(scratch.bytes).toBe(before + 8 * 8 * 4);
  });

  it('rebinds the pass target and its scissor after a resolve', () => {
    const { rec, gpu } = setup();
    const scratch = gpu.createTarget({ width: 8, height: 8, samples: 4, stencil: true });
    const surface = gpu.createTarget({ width: 8, height: 8 });
    const rect = { x: 0, y: 0, width: 8, height: 8 };
    gpu.beginPass({ target: scratch, viewport: rect, scissor: rect });
    gpu.endPass();
    gpu.resolve(scratch, surface, 8, 8, 0, 0);
    expect(argsOf(rec, 'enable').at(-1)).toEqual([rec.gl.SCISSOR_TEST]);
    rec.reset();
    gpu.beginPass({ target: scratch, viewport: rect, scissor: rect });
    expect(argsOf(rec, 'bindFramebuffer')).toHaveLength(1);
  });
});
