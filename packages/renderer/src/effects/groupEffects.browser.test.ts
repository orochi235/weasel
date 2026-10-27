/**
 * A group with effects against real WebGL2: what reaches the framebuffer.
 * `effects.test.ts` pins the call sequence; a pass that runs and writes no
 * fragments looks identical there.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { WeaselRenderer } from '../WeaselRenderer';
import { registerEffect } from './types';
import { registerTexture } from '../textures/registerTexture';
import { blur } from './builtins';
import type { DrawCommand } from '../DrawCommand';

const SIZE = 8;

const COPY_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
out vec4 outColor;
void main() { outColor = texture(u_source, v_uv); }
`;

const RED: DrawCommand = {
  kind: 'path',
  path: { kind: 'rect', x: 0, y: 0, width: SIZE, height: SIZE },
  fill: { paint: { color: '#ff0000' } },
};

let renderer: WeaselRenderer | undefined;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** Render `commands` and return a reader for one CSS pixel, top-left origin. */
function paint(commands: DrawCommand[]): (x: number, y: number) => number[] {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render(commands);
  const px = new Uint8Array(SIZE * SIZE * 4);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (x, y) => {
    const i = ((SIZE - 1 - y) * SIZE + x) * 4;
    return Array.from(px.slice(i, i + 4));
  };
}

function copy(): { program: ReturnType<typeof registerEffect> } {
  return { program: registerEffect('browser-fx-copy', COPY_FRAG) };
}

describe('a group with effects, in a real context', () => {
  it('draws its children through the effect', () => {
    const at = paint([{ kind: 'group', effects: [copy()], children: [RED] }]);
    expect(at(4, 4)).toEqual([255, 0, 0, 255]);
  });

  it('composites at its own alpha', () => {
    const at = paint([{ kind: 'group', effects: [copy()], alpha: 0.5, children: [RED] }]);
    const [r, g, b, a] = at(4, 4);
    expect(r).toBeGreaterThan(120);
    expect(r).toBeLessThan(136);
    expect([g, b]).toEqual([0, 0]);
    expect(a).toBeGreaterThan(120);
    expect(a).toBeLessThan(136);
  });

  it('composites through its own color matrix', () => {
    const redToBlue = [
      0, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      1, 0, 0, 0, 0,
      0, 0, 0, 1, 0,
    ];
    const at = paint([{ kind: 'group', effects: [copy()], colorMatrix: redToBlue, children: [RED] }]);
    expect(at(4, 4)).toEqual([0, 0, 255, 255]);
  });

  it('is cut by its own rect clip, placed under its own transform', () => {
    const at = paint([{
      kind: 'group',
      effects: [copy()],
      transform: new Float32Array([1, 0, 0, 0, 1, 0, 4, 0, 1]),
      clip: { kind: 'rect', x: 0, y: 0, width: 2, height: SIZE },
      children: [{ ...RED, path: { kind: 'rect', x: -4, y: 0, width: SIZE, height: SIZE } }],
    }]);
    expect(at(5, 4)).toEqual([255, 0, 0, 255]);
    expect(at(2, 4)).toEqual([0, 0, 0, 0]);
    expect(at(7, 4)).toEqual([0, 0, 0, 0]);
  });

  it('is cut by its own clip when the clip needs the stencil', () => {
    const at = paint([{
      kind: 'group',
      effects: [copy()],
      clip: pathFromD('M0 0 L8 0 L0 8 Z'),
      children: [RED],
    }]);
    expect(at(1, 1)).toEqual([255, 0, 0, 255]);
    expect(at(6, 6)).toEqual([0, 0, 0, 0]);
  });

  it('survives a last child that ends by popping a stencil clip', () => {
    const at = paint([{
      kind: 'group',
      effects: [copy()],
      children: [{ kind: 'group', clip: pathFromD('M0 0 L8 0 L0 8 Z'), children: [RED] }],
    }]);
    expect(at(1, 1)).toEqual([255, 0, 0, 255]);
    expect(at(6, 6)).toEqual([0, 0, 0, 0]);
  });

  it('keeps its source bound on the frame an effect\'s own texture first uploads', async () => {
    const program = registerEffect('browser-fx-tint', `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_tint;
out vec4 outColor;
void main() { outColor = texture(u_source, v_uv) * texture(u_tint, vec2(0.5)); }`);
    const white = await createImageBitmap(new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1));
    const at = paint([{
      kind: 'group',
      effects: [{ program, uniforms: { u_tint: registerTexture(white) } }],
      children: [RED],
    }]);
    expect(at(4, 4)).toEqual([255, 0, 0, 255]);
  });
});

describe('a blurred group past the edge of the buffer, in a real context', () => {
  // Wholly above the buffer: only its blur can reach in.
  const ABOVE: DrawCommand = { ...RED, path: { kind: 'rect', x: 0, y: -4, width: SIZE, height: 3 } };

  it('blurs what lies past the edge into it', () => {
    const at = paint([{ kind: 'group', effects: blur({ radius: 6 }), children: [ABOVE] }]);
    expect(at(4, 0)[3]).toBeGreaterThan(0);
    expect(at(4, 0)[0]).toBeGreaterThan(0);
  });

  it('leaves the far side, past its reach, untouched', () => {
    const at = paint([{ kind: 'group', effects: blur({ radius: 6 }), children: [ABOVE] }]);
    expect(at(4, 7)).toEqual([0, 0, 0, 0]);
  });
});

describe('an isolated group, in a real context', () => {
  const BLUE: DrawCommand = { ...RED, fill: { paint: { color: '#0000ff' } } };

  it('fades overlapping children as one surface', () => {
    const at = paint([{ kind: 'group', isolate: true, alpha: 0.5, children: [RED, BLUE] }]);
    const [r, , b, a] = at(4, 4);
    // Blue covers red inside the buffer, so no red reaches the composite.
    expect(r).toBe(0);
    expect(b).toBeGreaterThan(120);
    expect(b).toBeLessThan(136);
    expect(a).toBeGreaterThan(120);
    expect(a).toBeLessThan(136);
  });

  it('lets the red through without it — the difference isolation makes', () => {
    const at = paint([{ kind: 'group', alpha: 0.5, children: [RED, BLUE] }]);
    expect(at(4, 4)[0]).toBeGreaterThan(50);
  });
});

describe('a group composite operator, in a real context', () => {
  const LEFT_BLUE: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 0, y: 0, width: 4, height: SIZE },
    fill: { paint: { color: '#0000ff' } },
  };

  it('xor clears where both cover and keeps each where only one does', () => {
    const TOP_RED: DrawCommand = { ...RED, path: { kind: 'rect', x: 0, y: 0, width: SIZE, height: 4 } };
    const at = paint([TOP_RED, { kind: 'group', composite: 'xor', children: [LEFT_BLUE] }]);
    expect(at(1, 1)).toEqual([0, 0, 0, 0]);
    expect(at(6, 1)).toEqual([255, 0, 0, 255]);
    expect(at(1, 6)).toEqual([0, 0, 255, 255]);
    expect(at(6, 6)).toEqual([0, 0, 0, 0]);
  });

  it('destination-out erases what the group covers', () => {
    const at = paint([RED, { kind: 'group', composite: 'destination-out', children: [LEFT_BLUE] }]);
    expect(at(1, 4)).toEqual([0, 0, 0, 0]);
    expect(at(6, 4)).toEqual([255, 0, 0, 255]);
  });

  it('destination-in keeps the destination only under the group', () => {
    const at = paint([RED, { kind: 'group', composite: 'destination-in', children: [LEFT_BLUE] }]);
    expect(at(1, 4)).toEqual([255, 0, 0, 255]);
    expect(at(6, 4)).toEqual([0, 0, 0, 0]);
  });

  it('draws what follows under source-over again', () => {
    const at = paint([RED, { kind: 'group', composite: 'destination-out', children: [LEFT_BLUE] }, LEFT_BLUE]);
    expect(at(1, 4)).toEqual([0, 0, 255, 255]);
  });
});
