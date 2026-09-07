/**
 * Effects that ship with the kit.
 *
 * Each is a function returning `Effect[]`, not a single `Effect`, because a
 * separable kernel is genuinely two passes and hiding that behind one entry
 * would make the cost invisible at the callsite:
 *
 *   effects={[...blur({ radius: 4 }), ...vignette({ amount: 0.6 })]}
 */
import type { Effect } from './types';
import { registerEffect } from './types';

const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
uniform vec2 u_direction;
uniform float u_radius;
out vec4 outColor;

void main() {
  // Nine taps on a Gaussian, spread across the requested radius. The weights
  // are a normalized binomial row, so a radius of 0 collapses to a copy.
  const float W[5] = float[5](0.2270270, 0.1945946, 0.1216216, 0.0540541, 0.0162162);
  vec2 step = u_direction * u_texel * (u_radius / 4.0);
  vec4 sum = texture(u_source, v_uv) * W[0];
  for (int i = 1; i < 5; i++) {
    vec2 off = step * float(i);
    sum += texture(u_source, v_uv + off) * W[i];
    sum += texture(u_source, v_uv - off) * W[i];
  }
  outColor = sum;
}
`;

const VIGNETTE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform float u_amount;
uniform float u_feather;
out vec4 outColor;

void main() {
  vec4 src = texture(u_source, v_uv);
  float d = distance(v_uv, vec2(0.5)) * 1.41421356;
  float shade = 1.0 - u_amount * smoothstep(1.0 - u_feather, 1.0, d);
  // Premultiplied in, premultiplied out: scaling all four channels darkens
  // toward transparent black, which is what a vignette over a transparent
  // canvas should do.
  outColor = src * shade;
}
`;

const BLUR = registerEffect('weasel:blur', BLUR_FRAG);
const VIGNETTE = registerEffect('weasel:vignette', VIGNETTE_FRAG);

/**
 * Gaussian blur, as a horizontal pass followed by a vertical one.
 *
 * `radius` is in device pixels and is the distance of the outermost tap, not a
 * standard deviation — 0 is a copy, and the falloff is the same nine-tap
 * kernel at every radius, so a large one is a wide blur rather than a better
 * one. Two passes at O(9) beat one at O(81) and look the same.
 */
export function blur({ radius }: { radius: number }): Effect[] {
  return [
    { program: BLUR, uniforms: { u_direction: [1, 0], u_radius: radius } },
    { program: BLUR, uniforms: { u_direction: [0, 1], u_radius: radius } },
  ];
}

/**
 * Darken toward the corners. `amount` is how dark the corner gets (0..1) and
 * `feather` how much of the radius the falloff occupies.
 */
export function vignette(
  { amount, feather = 0.6 }: { amount: number; feather?: number },
): Effect[] {
  return [{ program: VIGNETTE, uniforms: { u_amount: amount, u_feather: feather } }];
}
