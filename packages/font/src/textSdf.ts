/**
 * GLSL ES 3.0 sources for the built-in MSDF text shader.
 *
 * Vertex inputs (interleaved, stride 20 bytes = 5 × float):
 *   a_position   vec2   screen-space x,y of the glyph quad vertex
 *   a_uv         vec2   atlas UV (0..1)
 *   a_baselineY  float  line baseline Y in screen space (for synth-italic skew)
 *
 * Uniforms:
 *   u_proj         mat3        screen → clip projection
 *   u_model        mat3        cumulative group transform
 *   u_atlas        sampler2D   the MSDF atlas texture (bound to TEXTURE0)
 *   u_color        vec4        text color (straight RGBA)
 *   u_alpha        float       group alpha multiplier
 *   u_colorMatrix  mat4        color transform applied to u_color before alpha modulation
 *   u_colorBias    vec4        bias added after the matrix (identity = zero bias)
 *
 * Output: PREMULTIPLIED alpha — `vec4(color.rgb * a, a)` per conventions §2.
 * Blend func: ONE / ONE_MINUS_SRC_ALPHA.
 *
 * MSDF channel layout: msdf-bmfont-xml outputs R,G,B channels as independent
 * signed-distance fields covering different edge directions. The true SDF
 * value is the median of R,G,B; this recovers sharp outlines while averaging
 * out single-channel aliasing artifacts.
 *
 * Antialiasing (`aaWidth`, both shaders): the smoothstep band must be one
 * *screen* pixel wide, so it is derived per-fragment from `fwidth(sdfVal)` —
 * the rate the field changes between adjacent fragments. That single quantity
 * already folds in font size, zoom, and DPR: minify the glyph and the field
 * changes faster, so the band widens in field units to stay one pixel on
 * screen; magnify it and the band narrows.
 *
 * A *constant* band cannot be correct at more than one scale, and this shader
 * used one (0.05) until 2026-07-29. At 16px text the band collapsed to well
 * under a pixel and glyph edges quantized to hard stair-steps; at display
 * sizes the same constant read mushy. `fwidth` is core in GLSL ES 3.00, so
 * no extension guard is needed. The `max()` floor keeps a degenerate
 * derivative (flat field, or a driver returning 0) from producing a
 * zero-width band, which would be the aliased behavior all over again.
 */

export const TEXT_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
in float a_baselineY;
uniform mat3 u_proj;
uniform mat3 u_model;
uniform float u_synthItalic;
out vec2 v_uv;
void main() {
  // Synthetic italic: shift x by (a_baselineY - a_position.y) * tan(angle).
  // Above-baseline vertices (lower y in screen coords) lean further right.
  vec2 skewed = vec2(
    a_position.x + (a_baselineY - a_position.y) * tan(u_synthItalic),
    a_position.y
  );
  vec3 screen = u_model * vec3(skewed, 1.0);
  vec3 clip   = u_proj  * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = a_uv;
}
`;

export const TEXT_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_atlas;
uniform vec4 u_color;
uniform float u_alpha;
uniform float u_synthBold;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

void main() {
  vec3 sdf = texture(u_atlas, v_uv).rgb;
  float sdfVal = median(sdf.r, sdf.g, sdf.b);
  // Screen-space AA band — see the file header. Half of fwidth spans ~1px.
  float aaW = max(0.5 * fwidth(sdfVal), 0.0005);
  // u_synthBold shifts the SDF threshold to thicken strokes when the
  // resolver fell back from a missing bold variant to the regular atlas.
  float threshold = 0.5 - u_synthBold;
  float msdfAlpha = smoothstep(threshold - aaW, threshold + aaW, sdfVal);
  vec4 src = vec4(u_color.rgb, u_color.a);
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * msdfAlpha * u_alpha;
  outColor = vec4(mapped.rgb * a, a);
}
`;

/**
 * Single-channel sibling of TEXT_FRAG_SRC for runtime canvas-SDF glyphs
 * (DynamicGlyphAtlas R8 pages): the R channel IS the distance field, so no
 * median. Threshold semantics (0.5 edge, u_synthBold shift) match the MSDF
 * shader because the bake encodes the edge at ~128.
 *
 * Accepted trade: corner rounding away from the bake size, mildest near it.
 * `glyphRasterizer.ts` carries the measurements and the reason neither a
 * larger bake nor extra taps would improve the small-text end.
 */
export const TEXT_FRAG_R8_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_atlas;
uniform vec4 u_color;
uniform float u_alpha;
uniform float u_synthBold;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;

void main() {
  float sdfVal = texture(u_atlas, v_uv).r;
  // Screen-space AA band — see the file header. Half of fwidth spans ~1px.
  float aaW = max(0.5 * fwidth(sdfVal), 0.0005);
  float threshold = 0.5 - u_synthBold;
  float sdfAlpha = smoothstep(threshold - aaW, threshold + aaW, sdfVal);
  vec4 src = vec4(u_color.rgb, u_color.a);
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * sdfAlpha * u_alpha;
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const TEXT_SDF_UNIFORMS = [
  'u_proj', 'u_model', 'u_atlas', 'u_color', 'u_alpha',
  'u_synthBold', 'u_synthItalic', 'u_colorMatrix', 'u_colorBias',
] as const;

export const TEXT_SDF_ATTRIBUTES = ['a_position', 'a_uv', 'a_baselineY'] as const;
