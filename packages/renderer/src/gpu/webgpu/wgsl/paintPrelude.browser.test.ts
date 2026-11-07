/**
 * A registered paint kind written to the paint prelude draws on WebGPU what
 * its GLSL draws on WebGL, through the shared harness.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Paint } from '@weasel-js/paint';
import { mat3 } from '@weasel-js/geom';
import { registerPaintDrawKind } from '../../../paintKinds';
import type { DrawCommand } from '../../../DrawCommand';
import { closeBackends, openBackends, parityDevice, releaseDevice, renderBoth, report } from '../../../testing/parityHarness';

const W = 48;
const H = 32;

const VERT = `#version 300 es
in vec2 a_position;
uniform mat3 u_proj;
uniform mat3 u_model;
uniform vec2 u_origin;
uniform mat3 u_worldInv;
out vec2 v_world;
void main() {
  vec3 screen = u_model * vec3(a_position - u_origin, 1.0);
  gl_Position = vec4((u_proj * vec3(screen.xy, 1.0)).xy, 0.0, 1.0);
  v_world = (u_worldInv * vec3(screen.xy, 1.0)).xy;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_world;
uniform vec4 u_tint;
out vec4 outColor;
void main() {
  float a = step(0.5, fract(v_world.x / 8.0)) * u_tint.a;
  outColor = vec4(u_tint.rgb * a, a);
}`;

const WGSL = `
struct Params { u_tint: vec4f }
@group(1) @binding(0) var<uniform> params: Params;
fn fragment(in: PaintVaryings) -> vec4f {
  let a = step(0.5, fract(in.world.x / 8.0)) * params.u_tint.a;
  return vec4f(params.u_tint.rgb * a, a);
}`;

const KIND = 'test/prelude-stripes';
let dispose: () => void = () => {};
let bound = 0;

beforeAll(async () => {
  await parityDevice();
  dispose = registerPaintDrawKind({
    id: KIND,
    programs: { [KIND]: { glsl: { vert: VERT, frag: FRAG }, wgsl: { frag: WGSL } } },
    bind: (ctx) => {
      const inverse = ctx.spaceInverse(undefined);
      if (inverse) bound++;
      return inverse ? { program: KIND, uniforms: { u_worldInv: mat3.toUniform(inverse), u_tint: [0.2, 0.4, 0.8, 1] } } : null;
    },
  });
});

afterAll(() => {
  dispose();
  releaseDevice();
});

afterEach(() => closeBackends());

describe('a paint kind on the paint prelude', () => {
  it('draws the same stripes on both backends', async () => {
    const b = await openBackends({ width: W, height: H, dpr: 1 });
    const stripes: DrawCommand = {
      kind: 'path', path: { kind: 'rect', x: 4, y: 4, width: 40, height: 24 },
      fill: { paint: { kind: KIND } as unknown as Paint },
    };
    const d = await renderBoth(b, [stripes]);
    expect(d.over, report('paint prelude stripes', d)).toBe(0);
    // Both backends bound the paint, so the match is of stripes, not of two blanks.
    expect(bound).toBeGreaterThanOrEqual(2);
  });
});
