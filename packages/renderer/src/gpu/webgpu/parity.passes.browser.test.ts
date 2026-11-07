/**
 * WebGL and WebGPU in one page, for what draws through passes of its own: a
 * group's effects, a custom shader, an id frame, and a retained group drawn
 * in tiles and panned. Each case logs its line of the parity table.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mat3, pathFromD, type GlMat3 } from '@weasel-js/geom';
import { blur } from '../../effects/builtins';
import { registerProgram } from '../../shaders/registerProgram';
import type { DrawCommand } from '../../DrawCommand';
import type { RetainedSurfaces } from '../../retain/RetainedSurfaces';
import type { WeaselRenderer } from '../../WeaselRenderer';
import { closeBackends, openBackends, parityDevice, releaseDevice, renderBoth, report, requireGpu } from '../../testing/parityHarness';

const W = 64;
const H = 48;

const GROUND: DrawCommand = {
  kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#f4efe6' } },
};

const rect = (x: number, y: number, w: number, h: number, color: string): DrawCommand => ({
  kind: 'path', path: { kind: 'rect', x, y, width: w, height: h }, fill: { paint: { color } },
});

afterAll(() => releaseDevice());

beforeAll(async () => {
  await parityDevice();
});

beforeEach(requireGpu);

afterEach(() => closeBackends());

const TINTED = registerProgram('parity-tinted-uv', {
  glsl: {
    frag: `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec4 u_tint;
out vec4 o;
void main() { o = vec4(v_uv, 0.5, 1.0) * u_tint; }`,
  },
  wgsl: {
    frag: `struct Params { u_tint: vec4f }
@group(1) @binding(0) var<uniform> params: Params;
fn fragment(in: Varyings) -> vec4f { return vec4f(in.uv, 0.5, 1.0) * params.u_tint; }`,
  },
});

/** A vec3 with a float packed into its last four bytes, then a vec2: what the reflected layout must place. */
const PACKED = registerProgram('parity-packed-uniforms', {
  glsl: {
    frag: `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec3 u_tint;
uniform float u_gain;
uniform vec2 u_shift;
out vec4 o;
void main() { o = vec4(u_tint * (v_uv.x + u_shift.x) * u_gain, 1.0) * (0.5 + 0.5 * v_uv.y + u_shift.y); }`,
  },
  wgsl: {
    frag: `struct Params { u_tint: vec3f, u_gain: f32, u_shift: vec2f }
@group(1) @binding(0) var<uniform> params: Params;
fn fragment(in: Varyings) -> vec4f {
  return vec4f(params.u_tint * (in.uv.x + params.u_shift.x) * params.u_gain, 1.0) * (0.5 + 0.5 * in.uv.y + params.u_shift.y);
}`,
  },
});

describe('WebGL and WebGPU draw the same passes', () => {
  it('a group blurred by its effect', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    const d = await renderBoth(b, [GROUND, {
      kind: 'group', effects: blur({ radius: 4 }),
      children: [rect(12, 10, 16, 20, '#202060'), rect(30, 18, 24, 8, 'rgba(220, 40, 40, 0.8)')],
    }]);
    expect(d.over, report('group effect (blur)', d)).toBe(0);
  });

  it('a custom shader with WGSL', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    const d = await renderBoth(b, [GROUND, {
      kind: 'shader', program: TINTED, uniforms: { u_tint: [1, 0.8, 0.6, 1] }, bounds: { x: 6, y: 4, w: 50, h: 38 },
    }]);
    expect(d.over, report('custom shader (WGSL)', d)).toBe(0);
  });

  it('a custom shader packing a float against a vec3', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    const d = await renderBoth(b, [GROUND, {
      kind: 'shader', program: PACKED, uniforms: { u_tint: [0.9, 0.4, 0.2], u_gain: 0.8, u_shift: [0.1, -0.2] },
      bounds: { x: 6, y: 4, w: 50, h: 38 },
    }]);
    expect(d.over, report('custom shader (vec3 + f32 + vec2 uniforms)', d)).toBe(0);
  });

  it('the ids an id frame reads back', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    const commands: DrawCommand[] = [
      { kind: 'group', pickId: 1, children: [rect(0, 0, 40, 30, '#ff0000')] },
      { kind: 'group', pickId: 2, children: [{ kind: 'path', path: pathFromD('M30 4 A16 16 0 1 1 29.99 4 Z'), fill: { paint: { color: '#00ff00' } } }] },
      { kind: 'group', pickId: 3, alpha: 0.5, effects: blur({ radius: 2 }), children: [rect(8, 30, 20, 12, '#0000ff')] },
    ];
    const [gl, gpu] = [await b.gl.renderIdsAsync(commands), await b.gpu.renderIdsAsync(commands)];
    expect(gpu.width).toBe(gl.width);
    let over = 0;
    const first: string[] = [];
    for (let i = 0; i < gl.data.length; i++) {
      if (gl.data[i] === gpu.data[i]) continue;
      over++;
      if (first.length < 8) first.push(`${i % gl.width},${Math.floor(i / gl.width)}: ${gl.data[i]} / ${gpu.data[i]}`);
    }
    const ids = new Set(gl.data);
    const line = report('renderIdsAsync ids', { max: over > 0 ? 1 : 0, over, first });
    expect(ids.has(1) && ids.has(2) && ids.has(3), line).toBe(true);
    expect(over, line).toBe(0);
    expect(() => b.gpu.renderIds(commands)).toThrow(/renderIdsAsync/);
  });

  it.each([false, true])('a retained group drawn in tiles, then panned (antialias %s)', async (antialias) => {
    const b = await openBackends({ width: W, height: H, dpr: 2, antialias });
    for (const r of [b.gl, b.gpu]) (r as unknown as { retained: RetainedSurfaces }).retained.tile = 37;
    const children: DrawCommand[] = [];
    for (let i = -3; i < 9; i++) {
      for (let j = -2; j < 7; j++) children.push(rect(i * 11 + 0.3, j * 9 + 0.7, 6.2, 4.9, `rgba(${(i * 40) & 255}, ${(j * 60) & 255}, 180, 0.7)`));
    }
    children.push({ kind: 'path', path: pathFromD('M-20 60 C 10 -10, 50 90, 90 10'), stroke: { paint: { color: '#ff3366' }, width: 1.7 } });
    const layer = (view: GlMat3): DrawCommand => ({ kind: 'group', transform: view, retain: 'L', children });
    const stats = (r: WeaselRenderer) => r.lastFrameStats().retained;
    for (const [x, y] of [[0, 0], [13, 7], [-21, 5]]) {
      const view = mat3.translated(mat3.identity(), x, y);
      const d = await renderBoth(b, [GROUND, layer(view)], view, antialias);
      const line = report(`retained group panned (${x}, ${y})${antialias ? ', antialiased (interiors)' : ''}`, d);
      expect(stats(b.gpu), line).toEqual(stats(b.gl));
      expect(d.over, line).toBe(0);
    }
  });
});
