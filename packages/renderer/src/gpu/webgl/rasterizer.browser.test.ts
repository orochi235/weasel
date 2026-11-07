/**
 * Which rasterizer the browser project draws WebGL with: the node's GPU on a
 * Mac, SwiftShader on Linux, whose CI runner has none
 * (`scripts/chromium-gpu-args.ts`). Every pixel allowance in this project was
 * measured on one or the other, and a launch that quietly fell back to
 * SwiftShader would pass them all.
 */
import { expect, it } from 'vitest';

it('draws WebGL on the GPU, or on SwiftShader on Linux', () => {
  const gl = document.createElement('canvas').getContext('webgl2', { stencil: true })!;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  expect(/swiftshader/i.test(name), name).toBe(/Linux/.test(navigator.userAgent));
});
