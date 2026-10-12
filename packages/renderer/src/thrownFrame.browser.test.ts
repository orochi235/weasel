/**
 * The frame after one that threw part-way, against real WebGL2. A command
 * with a color nobody can parse is the reachable throw.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import { registerEffect } from './effects/types';
import type { DrawCommand } from './DrawCommand';

const SIZE = 8;

const FULL = { kind: 'rect', x: 0, y: 0, width: SIZE, height: SIZE } as const;
const HALF_RED: DrawCommand = { kind: 'path', path: FULL, fill: { color: '#ff0000', opacity: 0.5 } };
const THROWS: DrawCommand = { kind: 'path', path: FULL, fill: { color: 'no-such-color' } };

const COPY_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
out vec4 outColor;
void main() { outColor = texture(u_source, v_uv); }
`;

let renderer: WeaselRenderer | undefined;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

function setup(): { gl: WebGL2RenderingContext; renderer: WeaselRenderer } {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  return { gl, renderer };
}

/** The canvas's own center pixel, whatever framebuffer the renderer left bound. */
function center(gl: WebGL2RenderingContext): number[] {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const px = new Uint8Array(4);
  gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return Array.from(px);
}

function expectHalfRed(px: number[]): void {
  expect(px[0]).toBeGreaterThan(120);
  expect(px[0]).toBeLessThan(136);
  expect(px[3]).toBeGreaterThan(120);
  expect(px[3]).toBeLessThan(136);
}

describe('the frame after one that threw', () => {
  it('does not draw what the thrown frame had staged', () => {
    const { gl, renderer } = setup();
    expect(() => renderer.render([HALF_RED, THROWS])).toThrow();
    renderer.render([HALF_RED]);
    expectHalfRed(center(gl));
  });

  it('draws to the canvas after a throw inside a group with effects', () => {
    const { gl, renderer } = setup();
    const effects = [{ program: registerEffect('browser-fx-thrown', COPY_FRAG) }];
    expect(() => renderer.render([{ kind: 'group', effects, children: [THROWS] }])).toThrow();
    renderer.render([HALF_RED]);
    expectHalfRed(center(gl));
  });

  it('takes back the effect buffer a thrown frame was holding', () => {
    const { gl, renderer } = setup();
    const effects = [{ program: registerEffect('browser-fx-thrown', COPY_FRAG) }];
    const frame: DrawCommand[] = [{ kind: 'group', effects, children: [THROWS] }];
    const created = vi.spyOn(gl, 'createFramebuffer');
    expect(() => renderer.render(frame)).toThrow();
    const afterFirst = created.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) expect(() => renderer.render(frame)).toThrow();
    expect(created.mock.calls.length).toBe(afterFirst);
  });
});
