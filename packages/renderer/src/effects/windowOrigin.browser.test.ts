/**
 * `u_windowOrigin` against real WebGL2: an effect pass can find where its
 * buffer sits in the drawing buffer.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WeaselRenderer, registerEffect } from '@weasel-js/renderer';
import type { DrawCommand } from '../DrawCommand';

const SIZE = 128;

const ORIGIN_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_windowOrigin;
out vec4 outColor;
void main() { outColor = vec4(u_windowOrigin / 255.0, 0.0, 1.0); }
`;

let renderer: WeaselRenderer | undefined;
afterEach(() => { renderer?.dispose(); renderer = undefined; });

function pixelAt(commands: DrawCommand[], x: number, y: number): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render(commands);
  const px = new Uint8Array(4);
  gl.readPixels(x, SIZE - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return Array.from(px);
}

describe('u_windowOrigin', () => {
  it("is the top-left device pixel of the group's buffer", () => {
    const program = registerEffect('browser-fx-window-origin', { glsl: ORIGIN_FRAG });
    const square: DrawCommand = {
      kind: 'path',
      path: { kind: 'rect', x: 10, y: 20, width: 10, height: 10 },
      fill: { paint: { color: '#ffffff' } },
    };
    expect(pixelAt([{ kind: 'group', effects: [{ program, reach: 0 }], children: [square] }], 15, 25))
      .toEqual([9, 19, 0, 255]);
  });
});
