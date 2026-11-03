import { BAYER_4X4, LUMA } from '../shared';

const list = (xs: readonly number[]) => xs.map((x) => x.toFixed(4)).join(', ');

/**
 * One fragment per device pixel. On an output grid, a dot wider than a pixel
 * takes the mean of its footprint on at most 4×4 taps and quantizes once, so
 * every pixel of the dot agrees; a dot narrower than a pixel cannot be shown,
 * and the pixel quantizes alone, on the Bayer cell of its own device pixel.
 */
export const DITHER_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_resolution;
uniform vec2 u_windowOrigin;
uniform float u_method;      // 0 threshold, 1 bayer
uniform float u_threshold;   // 0-255
uniform vec3 u_background;   // 0-1
uniform vec4 u_ink;          // premultiplied 0-1
uniform vec4 u_blank;        // premultiplied 0-1
uniform vec2 u_pitch;        // device px per dot
uniform vec2 u_gridOrigin;   // device px, top-down
uniform sampler2D u_protect; // one texel per dot, red > 0.5 = protected
uniform vec2 u_protectSize;  // dots; 0 = none
out vec4 outColor;

const float BAYER[16] = float[16](${list(BAYER_4X4)});
const vec3 LUMA = vec3(${list(LUMA)});

float grayOf(vec4 p) {
  return dot(p.rgb + u_background * (1.0 - p.a), LUMA) * 255.0;
}

vec2 uvOf(vec2 devicePx) {
  vec2 local = (devicePx - u_windowOrigin) / u_resolution;
  return vec2(local.x, 1.0 - local.y);
}

void main() {
  vec2 px = u_windowOrigin + vec2(v_uv.x, 1.0 - v_uv.y) * u_resolution;
  vec2 dotIndex = floor((px - u_gridOrigin) / u_pitch);
  vec2 size = abs(u_pitch);
  bool fine = size.x < 1.0 || size.y < 1.0;

  float gray;
  if (fine) {
    gray = grayOf(texture(u_source, v_uv));
  } else {
    // A negative pitch (a flipped axis) puts start on the dot's far edge and
    // steps the taps back across it.
    vec2 start = u_gridOrigin + dotIndex * u_pitch;
    vec2 taps = clamp(ceil(size), vec2(1.0), vec2(4.0));
    vec4 sum = vec4(0.0);
    for (int j = 0; j < 4; j++) {
      if (float(j) >= taps.y) break;
      for (int i = 0; i < 4; i++) {
        if (float(i) >= taps.x) break;
        vec2 uv = uvOf(start + (vec2(float(i), float(j)) + 0.5) * u_pitch / taps);
        // Past the buffer nothing was drawn: the tap is transparent.
        if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) continue;
        sum += texture(u_source, uv);
      }
    }
    gray = grayOf(sum / (taps.x * taps.y));
  }

  bool protectedDot = u_protectSize.x > 0.0
    && all(greaterThanEqual(dotIndex, vec2(0.0))) && all(lessThan(dotIndex, u_protectSize))
    && texelFetch(u_protect, ivec2(dotIndex), 0).r > 0.5;

  float cutoff = u_threshold;
  if (u_method > 0.5 && !protectedDot) {
    vec2 cell = mod(fine ? floor(px) : dotIndex, 4.0);
    cutoff = (BAYER[int(cell.y) * 4 + int(cell.x)] + 0.5) * 16.0 + (u_threshold - 128.0);
  }
  outColor = gray < cutoff ? u_ink : u_blank;
}
`;
