/**
 * What the WebGL backend sends for the layer's calls. The recorder has no
 * pixels, so these pin the calls; the browser tests read what they paint.
 */
import { describe, expect, it } from 'vitest';
import { createGLRecorder, type GLRecorder } from '../../testing/glRecorder';
import { PREMULTIPLIED } from '../blend';
import type { GpuDrawState, GpuStencilState } from '../types';
import { WebGLDevice } from './WebGLDevice';

const VERT = '#version 300 es\nin vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); }\n';
const FRAG = '#version 300 es\nprecision highp float;\nuniform sampler2D u_a;\nuniform sampler2D u_b;\n'
  + 'out vec4 o;\nvoid main() { o = texture(u_a, vec2(0.0)) + texture(u_b, vec2(0.0)); }\n';

function setup(): { rec: GLRecorder; gpu: WebGLDevice } {
  const rec = createGLRecorder();
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

  it('puts back at frame start the blend equation and rasterizer state another user of the context may have left set', () => {
    const { rec } = setup();
    const { gl } = rec;
    expect(argsOf(rec, 'blendEquation')).toEqual([[gl.FUNC_ADD]]);
    expect(argsOf(rec, 'disable')).toEqual(expect.arrayContaining([
      [gl.RASTERIZER_DISCARD], [gl.SAMPLE_ALPHA_TO_COVERAGE], [gl.SAMPLE_COVERAGE], [gl.POLYGON_OFFSET_FILL],
    ]));
    expect(gl.RASTERIZER_DISCARD).toBe(0x8C89);
  });

  it('puts back at frame start the stencil clear value another user of the context may have left set', () => {
    const { rec } = setup();
    expect(argsOf(rec, 'clearStencil')).toEqual([[0]]);
  });

  it('zeroes only the stencil bits asked for', () => {
    const { rec, gpu } = setup();
    gpu.beginPass({ target: null, viewport: { x: 0, y: 0, width: 4, height: 4 } });
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

  it('uploads a decoded image into an r8 texture as its red channel, as later writes to it expect', () => {
    const { rec, gpu } = setup();
    const source = { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
    const sampling = { min: 'linear', mag: 'linear', wrapS: 'clamp', wrapT: 'clamp' } as const;
    const { gl } = rec;
    for (const premultiply of [false, true]) {
      rec.reset();
      gpu.createTexture('r8', sampling, { source, premultiply });
      expect(argsOf(rec, 'texImage2D')).toEqual([[gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, source]]);
    }
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

  it('puts the premultiply flag back when the image upload throws', () => {
    const rec = createGLRecorder();
    const gl = new Proxy(rec.gl, {
      get: (target, name) => name === 'texImage2D'
        ? () => { throw new DOMException('tainted', 'SecurityError'); }
        : Reflect.get(target, name),
    });
    const gpu = new WebGLDevice(gl);
    const source = { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData;
    const sampling = { min: 'linear', mag: 'linear', wrapS: 'clamp', wrapT: 'clamp' } as const;
    rec.reset();
    expect(() => gpu.createTexture('rgba8', sampling, { source, premultiply: true })).toThrow('tainted');
    expect(argsOf(rec, 'pixelStorei').at(-1)).toEqual([0x9241, false]);
  });

  it('puts back at frame start the unpack state another user of the context may have left set', () => {
    const rec = createGLRecorder();
    const gpu = new WebGLDevice(rec.gl);
    gpu.beginFrame();
    const gl = rec.gl;
    expect(argsOf(rec, 'bindBuffer')).toContainEqual([gl.PIXEL_UNPACK_BUFFER, null]);
    expect(argsOf(rec, 'pixelStorei')).toEqual(expect.arrayContaining([
      [gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false], [gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL],
      [gl.UNPACK_ALIGNMENT, 4], [gl.UNPACK_ROW_LENGTH, 0], [gl.UNPACK_SKIP_ROWS, 0], [gl.UNPACK_SKIP_PIXELS, 0],
    ]));
    expect(gl.PIXEL_UNPACK_BUFFER).toBe(0x88EC);
    expect(gl.UNPACK_SKIP_PIXELS).toBe(0x0CF4);
  });

  it('unbinds, once a frame, a sampler object another user of the context left on a unit it draws with', () => {
    const { rec, gpu } = setup();
    const { program, geometry, state } = drawable(gpu);
    const texture = gpu.createTexture('rgba8', { min: 'nearest', mag: 'nearest', wrapS: 'clamp', wrapT: 'clamp' }, { width: 1, height: 1, data: null });
    program.setTexture('u_a', texture);
    program.setTexture('u_b', texture);
    gpu.draw(state(), geometry, 3);
    gpu.draw(state(), geometry, 3);
    expect(argsOf(rec, 'bindSampler')).toEqual([[0, null], [1, null]]);
    gpu.beginFrame();
    rec.reset();
    gpu.draw(state(), geometry, 3);
    expect(argsOf(rec, 'bindSampler')).toEqual([[0, null], [1, null]]);
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

  it('samples nothing for a texture the pass draws into, as WebGPU does, rather than binding a feedback loop', () => {
    const { rec, gpu } = setup();
    const { program, geometry, state } = drawable(gpu);
    const target = gpu.createTarget({ width: 4, height: 4, ids: true });
    const other = gpu.createTexture('rgba8', { min: 'nearest', mag: 'nearest', wrapS: 'clamp', wrapT: 'clamp' }, { width: 1, height: 1, data: null });
    program.setTexture('u_a', target.color);
    program.setTexture('u_b', target.ids);
    gpu.beginPass({ target, viewport: { x: 0, y: 0, width: 4, height: 4 } });
    rec.reset();
    gpu.draw(state(), geometry, 3);
    const bound = argsOf(rec, 'bindTexture').map(([, tex]) => tex);
    expect(bound).not.toContain((target.color as unknown as { handle: WebGLTexture }).handle);
    expect(bound).not.toContain((target.ids as unknown as { handle: WebGLTexture }).handle);
    gpu.endPass();
    program.setTexture('u_b', other);
    rec.reset();
    gpu.draw(state(), geometry, 3);
    expect(argsOf(rec, 'bindTexture').map(([, tex]) => tex)).toEqual([
      (target.color as unknown as { handle: WebGLTexture }).handle, (other as unknown as { handle: WebGLTexture }).handle,
    ]);
  });
});

describe('WebGLDevice textures it cannot sample', () => {
  const handleOf = (t: unknown): WebGLTexture => (t as { handle: WebGLTexture }).handle;
  const NEAREST = { min: 'nearest', mag: 'nearest', wrapS: 'clamp', wrapT: 'clamp' } as const;
  /** The texture created with one transparent texel, which WebGPU samples for a texture it cannot. */
  const transparent = (rec: GLRecorder): WebGLTexture[] => {
    const out: WebGLTexture[] = [];
    let bound: WebGLTexture | null = null;
    for (const c of rec.calls) {
      if (c.name === 'bindTexture') bound = c.args[1] as WebGLTexture | null;
      if (c.name === 'texImage2D' && c.args[3] === 1 && c.args[4] === 1
          && c.args[8] instanceof Uint8Array && (c.args[8] as Uint8Array).every((b) => b === 0)) out.push(bound!);
    }
    return out;
  };

  it('samples transparent black for a texture deleted while a program still holds it, as WebGPU does', () => {
    const { rec, gpu } = setup();
    const { program, geometry, state } = drawable(gpu);
    const tex = gpu.createTexture('rgba8', NEAREST, { width: 2, height: 2, data: null });
    program.setTexture('u_a', tex);
    gpu.draw(state(), geometry, 3);
    gpu.deleteTexture(tex);
    rec.reset();
    gpu.draw(state(), geometry, 3);
    const bound = argsOf(rec, 'bindTexture').map(([, t]) => t);
    expect(bound).not.toContain(handleOf(tex));
    expect(bound.at(-1)).toBe(transparent(rec)[0]);
  });

  it('samples transparent black for a texture the pass draws into, as WebGPU does', () => {
    const { rec, gpu } = setup();
    const { program, geometry, state } = drawable(gpu);
    const target = gpu.createTarget({ width: 4, height: 4 });
    program.setTexture('u_a', target.color);
    gpu.beginPass({ target, viewport: { x: 0, y: 0, width: 4, height: 4 } });
    rec.reset();
    gpu.draw(state(), geometry, 3);
    const [dummy] = transparent(rec);
    expect(dummy).toBeTruthy();
    expect(argsOf(rec, 'bindTexture').at(-1)).toEqual([rec.gl.TEXTURE_2D, dummy]);
  });

  it('frees its transparent texel when the last renderer drawing through it is done', () => {
    const { rec, gpu } = setup();
    const { program, geometry, state } = drawable(gpu);
    gpu.retain();
    gpu.retain();
    program.setTexture('u_a', null);
    gpu.draw(state(), geometry, 3);
    const [dummy] = transparent(rec);
    gpu.dispose();
    expect(argsOf(rec, 'deleteTexture')).toEqual([]);
    gpu.dispose();
    expect(argsOf(rec, 'deleteTexture')).toEqual([[dummy]]);
  });
});

describe('WebGLDevice sampler arrays', () => {
  it('refuses a texture index outside the sampler, which would take another sampler\'s unit', () => {
    const { gpu } = setup();
    const program = gpu.createProgram({ glsl: { vert: VERT, frag: '#version 300 es\nprecision highp float;\n'
      + 'uniform sampler2D u_a[2];\nuniform sampler2D u_b;\nout vec4 o;\n'
      + 'void main() { o = texture(u_a[1], vec2(0.0)) + texture(u_b, vec2(0.0)); }\n' } });
    program.lookupUniforms(['u_b']);
    program.lookupUniformArrays(new Map([['u_a', { type: 'sampler2D', size: 2 }]]));
    const tex = gpu.createTexture('rgba8', { min: 'nearest', mag: 'nearest', wrapS: 'clamp', wrapT: 'clamp' }, { width: 1, height: 1, data: null });
    program.setTexture('u_a', tex, 1);
    program.setTexture('u_b', tex);
    expect(() => program.setTexture('u_a', tex, 2)).toThrow(RangeError);
    expect(() => program.setTexture('u_b', tex, 1)).toThrow(RangeError);
    expect(() => program.setTexture('u_a', tex, -1)).toThrow(RangeError);
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

describe('WebGLDevice read-backs', () => {
  it('reads the canvas and ids into client memory under default pack state', () => {
    const { rec, gpu } = setup();
    const { gl } = rec;
    const rect = { x: 0, y: 0, width: 3, height: 1 };
    const target = gpu.createTarget({ width: 4, height: 4, ids: true });
    for (const read of [() => gpu.readCanvasSync(rect), () => gpu.readIdsSync(target, rect)]) {
      rec.reset();
      read();
      expect(argsOf(rec, 'bindBuffer')).toEqual([[gl.PIXEL_PACK_BUFFER, null]]);
      expect(argsOf(rec, 'pixelStorei')).toEqual([
        [gl.PACK_ALIGNMENT, 4], [gl.PACK_ROW_LENGTH, 0], [gl.PACK_SKIP_ROWS, 0], [gl.PACK_SKIP_PIXELS, 0],
      ]);
      expect(names(rec).indexOf('pixelStorei')).toBeLessThan(names(rec).indexOf('readPixels'));
    }
    expect(gl.PIXEL_PACK_BUFFER).toBe(0x88EB);
  });
});

describe('WebGLDevice calls that rebind the framebuffer inside a pass', () => {
  it('draws into and clears the stencil of the pass target after a read-back or a new target', () => {
    const { rec, gpu } = setup();
    const { geometry, state } = drawable(gpu);
    const target = gpu.createTarget({ width: 4, height: 4, stencil: true, ids: true });
    const rect = { x: 0, y: 0, width: 1, height: 1 };
    gpu.beginPass({ target, viewport: { x: 0, y: 0, width: 4, height: 4 } });
    const bound = () => argsOf(rec, 'bindFramebuffer').at(-1);
    const passFbo = bound();
    for (const rebind of [() => gpu.readCanvasSync(rect), () => gpu.createTarget({ width: 2, height: 2 })]) {
      rebind();
      gpu.clearStencilBits(0x01);
      expect(bound()).toEqual(passFbo);
      rebind();
      gpu.draw(state({ ids: true }), geometry, 3);
      expect(bound()).toEqual(passFbo);
    }
  });
});

describe('WebGLDevice ids of a target without them', () => {
  it('answers no id without reading the color', () => {
    const { rec, gpu } = setup();
    const target = gpu.createTarget({ width: 4, height: 4 });
    rec.reset();
    expect(gpu.readIdsSync(target, { x: 0, y: 0, width: 2, height: 1 })).toEqual(new Uint8Array(8));
    expect(names(rec)).not.toContain('readPixels');
  });
});

describe('WebGLDevice targets', () => {
  it('makes a single-sampled target with a color texture for one sample a pixel', () => {
    const { rec, gpu } = setup();
    rec.reset();
    const target = gpu.createTarget({ width: 4, height: 4, samples: 1 });
    expect(target.samples).toBe(0);
    expect(target.color).not.toBeNull();
    expect(names(rec)).not.toContain('renderbufferStorageMultisample');
  });

  it('refuses a multisampled target with ids, which would be an incomplete framebuffer', () => {
    const { gpu } = setup();
    expect(() => gpu.createTarget({ width: 4, height: 4, samples: 4, ids: true })).toThrow('multisampled target cannot have ids');
  });
});

describe('WebGLDevice geometry', () => {
  it('reads a stride-0 buffer of several attributes as interleaved vertices, as WebGPU does', () => {
    const { rec, gpu } = setup();
    const buffer = gpu.createBuffer('vertex', new Float32Array(12), 'static');
    rec.reset();
    gpu.createGeometry({
      vertexBuffers: [{ buffer, stride: 0, attributes: [{ location: 0, components: 2, offset: 0 }, { location: 1, components: 4, offset: 8 }] }],
      indexBuffer: gpu.createBuffer('index', new Uint32Array([0, 1, 2]), 'static'), indexFormat: 'uint32',
    });
    expect(argsOf(rec, 'vertexAttribPointer')).toEqual([[0, 2, rec.gl.FLOAT, false, 24, 0], [1, 4, rec.gl.FLOAT, false, 24, 8]]);
  });
});

describe('WebGLDevice uniforms', () => {
  it('writes nothing for a ranged write of no numbers', () => {
    const { rec, gpu } = setup();
    const { program } = drawable(gpu);
    program.lookupUniforms(['u_n']);
    rec.reset();
    program.set('u_n', 'vec4', new Float32Array(8), 4, 0);
    program.set('u_n', 'vec4', new Float32Array(8), 8);
    expect(argsOf(rec, 'uniform4fv')).toEqual([]);
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

describe('WebGLDevice limits', () => {
  it('reads the canvas sample count with the default framebuffer bound, and puts back the one that was', () => {
    const rec = createGLRecorder();
    const { gl } = rec;
    const fbo = { __id: 'offscreen' };
    let drawBound: unknown = fbo;
    const answering = new Proxy(gl, {
      get(target, prop) {
        if (prop === 'getParameter') {
          return (name: number) => {
            target.getParameter(name);
            if (name === gl.DRAW_FRAMEBUFFER_BINDING) return drawBound;
            if (name === gl.SAMPLES) return drawBound === null ? 4 : 0;
            return null;
          };
        }
        if (prop === 'bindFramebuffer') {
          return (kind: number, bound: unknown) => {
            target.bindFramebuffer(kind, bound as WebGLFramebuffer | null);
            drawBound = bound;
          };
        }
        return Reflect.get(target, prop) as unknown;
      },
    });
    const gpu = new WebGLDevice(answering);
    expect(gpu.limits.samples).toBe(4);
    expect(drawBound).toBe(fbo);
  });
});
