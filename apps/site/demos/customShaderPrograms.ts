import { registerProgram, type ShaderProgramHandle } from '@weasel-js/renderer';

// GLSL

const PLASMA_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform vec2  u_mouse;
out vec4 outColor;
void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  float t = u_time;
  float v = sin(p.x * 4.0 + t) + sin(p.y * 4.0 + t * 1.3)
          + sin((p.x + u_mouse.x * 2.0 - 1.0) * 6.0 + t * 0.7)
          + sin(length(p - (u_mouse * 2.0 - 1.0)) * 8.0 - t * 1.1);
  v *= 0.25;
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.66) + v));
  outColor = vec4(col, 1.0);
}`;

export const RIPPLE_SECONDS = 1.5;
const RIPPLE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform sampler2D u_image;
uniform vec3 u_ripples[8];
uniform float u_rippleCount;
out vec4 outColor;
void main() {
  vec2 uv = v_uv;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_rippleCount) break;
    vec3 r = u_ripples[i];
    float age = u_time - r.z;
    if (age < 0.0 || age > ${RIPPLE_SECONDS.toFixed(1)}) continue;
    float radius = age * 0.7;
    float ring = exp(-30.0 * pow(distance(v_uv, r.xy) - radius, 2.0));
    vec2 dir = normalize(v_uv - r.xy + 1e-6);
    uv -= dir * ring * 0.04 * (1.0 - age / ${RIPPLE_SECONDS.toFixed(1)});
  }
  // A registered texture is premultiplied already, which is what outColor takes.
  outColor = texture(u_image, uv);
}`;

const VORONOI_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform vec2 u_seeds[8];
uniform float u_seedCount;
out vec4 outColor;
void main() {
  float bestD = 1e9;
  int bestI = 0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= u_seedCount) break;
    float d = distance(v_uv, u_seeds[i]);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  float h = float(bestI) / max(1.0, u_seedCount) + u_time * 0.05;
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.66) + h));
  outColor = vec4(col, 1.0);
}`;

// WGSL: the same three programs against the kit's prelude (Varyings, top-left uv).

const PLASMA_WGSL = /* wgsl */ `
struct Params { u_mouse: vec2f, u_time: f32 }
@group(1) @binding(0) var<uniform> params: Params;
fn fragment(in: Varyings) -> vec4f {
  let p = in.uv * 2.0 - 1.0;
  let t = params.u_time;
  let m = params.u_mouse;
  var v = sin(p.x * 4.0 + t) + sin(p.y * 4.0 + t * 1.3)
        + sin((p.x + m.x * 2.0 - 1.0) * 6.0 + t * 0.7)
        + sin(length(p - (m * 2.0 - 1.0)) * 8.0 - t * 1.1);
  v *= 0.25;
  let col = 0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.66) + v));
  return vec4f(col, 1.0);
}`;

const RIPPLE_WGSL = /* wgsl */ `
struct Params { u_ripples: array<vec3f, 8>, u_time: f32, u_rippleCount: f32 }
@group(1) @binding(0) var<uniform> params: Params;
@group(1) @binding(1) var u_image: texture_2d<f32>;
@group(1) @binding(2) var u_image_sampler: sampler;
fn fragment(in: Varyings) -> vec4f {
  var uv = in.uv;
  for (var i = 0; i < 8; i++) {
    if (f32(i) >= params.u_rippleCount) { break; }
    let r = params.u_ripples[i];
    let age = params.u_time - r.z;
    if (age < 0.0 || age > ${RIPPLE_SECONDS.toFixed(1)}) { continue; }
    let radius = age * 0.7;
    let ring = exp(-30.0 * pow(distance(in.uv, r.xy) - radius, 2.0));
    let dir = normalize(in.uv - r.xy + 1e-6);
    uv -= dir * ring * 0.04 * (1.0 - age / ${RIPPLE_SECONDS.toFixed(1)});
  }
  return textureSample(u_image, u_image_sampler, uv);
}`;

const VORONOI_WGSL = /* wgsl */ `
struct Params { u_seeds: array<vec2f, 8>, u_time: f32, u_seedCount: f32 }
@group(1) @binding(0) var<uniform> params: Params;
fn fragment(in: Varyings) -> vec4f {
  var bestD = 1e9;
  var bestI = 0;
  for (var i = 0; i < 8; i++) {
    if (f32(i) >= params.u_seedCount) { break; }
    let d = distance(in.uv, params.u_seeds[i]);
    if (d < bestD) { bestD = d; bestI = i; }
  }
  let h = f32(bestI) / max(1.0, params.u_seedCount) + params.u_time * 0.05;
  let col = 0.5 + 0.5 * cos(6.2831 * (vec3f(0.0, 0.33, 0.66) + h));
  return vec4f(col, 1.0);
}`;

// Module-scope registration, once per page load: each backend draws the language it speaks.
export const PLASMA_PROGRAM: ShaderProgramHandle = registerProgram('demo-plasma', { glsl: { frag: PLASMA_FRAG }, wgsl: { frag: PLASMA_WGSL } });
export const RIPPLE_PROGRAM: ShaderProgramHandle = registerProgram('demo-ripple', { glsl: { frag: RIPPLE_FRAG }, wgsl: { frag: RIPPLE_WGSL } });
export const VORONOI_PROGRAM: ShaderProgramHandle = registerProgram('demo-voronoi', { glsl: { frag: VORONOI_FRAG }, wgsl: { frag: VORONOI_WGSL } });
export const SHADERS = [PLASMA_PROGRAM, RIPPLE_PROGRAM, VORONOI_PROGRAM];
