/**
 * GLSL for the color of an image texel. An image texture holds premultiplied
 * texels (`uploadPremultiplied`), and a color matrix works on straight color,
 * so the alpha comes back out before one runs.
 */
export const STRAIGHT_RGB_GLSL = /* glsl */ `
vec3 straightRgb(vec4 premultiplied) {
  return premultiplied.rgb / max(premultiplied.a, 0.0001);
}
`;
