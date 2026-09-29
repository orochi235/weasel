/**
 * Array uniforms and re-registered programs against real WebGL2. The unit
 * tests can only show the renderer asked for `u_colors[0]`; these show every
 * slot of the array reached the shader, and a re-registered source reached
 * the screen on the next frame.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import { registerProgram, _resetProgramRegistryForTests, type ShaderUniform } from './shaders/registerProgram';

const W = 4;

function frag(pick: string): string {
  return `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec4 u_colors[4];
out vec4 outColor;
void main() {
  int i = int(clamp(floor(v_uv.x * 4.0), 0.0, 3.0));
  outColor = ${pick};
}`;
}

function setup(): { gl: WebGL2RenderingContext; renderer: WeaselRenderer } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 1;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  return { gl, renderer: new WeaselRenderer({ gl, width: W, height: 1, dpr: 1 }) };
}

function draw(renderer: WeaselRenderer, gl: WebGL2RenderingContext, id: string, uniforms: Record<string, ShaderUniform>): number[][] {
  renderer.render([{ kind: 'shader', program: { id }, uniforms, bounds: { x: 0, y: 0, w: W, h: 1 } }]);
  const px = new Uint8Array(W * 4);
  gl.readPixels(0, 0, W, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return Array.from({ length: W }, (_, i) => Array.from(px.slice(i * 4, i * 4 + 4)));
}

const COLORS = new Float32Array([
  1, 0, 0, 1,
  0, 1, 0, 1,
  0, 0, 1, 1,
  1, 1, 1, 1,
]);

afterEach(() => { _resetProgramRegistryForTests(); });

describe('array uniforms in a real context', () => {
  it('fills every slot of a vec4 array from one flat Float32Array', () => {
    const { gl, renderer } = setup();
    renderer.registerProgram(registerProgram('browser-array', '', frag('u_colors[i]')));
    expect(draw(renderer, gl, 'browser-array', { u_colors: COLORS })).toEqual([
      [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255],
    ]);
    renderer.dispose();
  });

  it('draws a re-registered source on the next frame and deletes the old program', () => {
    const { gl, renderer } = setup();
    renderer.registerProgram(registerProgram('browser-hot', '', frag('u_colors[i]')));
    draw(renderer, gl, 'browser-hot', { u_colors: COLORS });
    const before = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;

    registerProgram('browser-hot', '', frag('u_colors[3 - i]'));
    expect(draw(renderer, gl, 'browser-hot', { u_colors: COLORS })).toEqual([
      [255, 255, 255, 255], [0, 0, 255, 255], [0, 255, 0, 255], [255, 0, 0, 255],
    ]);
    expect(gl.getParameter(gl.CURRENT_PROGRAM)).not.toBe(before);
    expect(gl.isProgram(before)).toBe(false);
    renderer.dispose();
  });
});
