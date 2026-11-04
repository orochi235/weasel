/**
 * Id frames against real WebGL2: which id each pixel ends up holding. The
 * recorder test pins the call sequence; only a context shows that the id
 * output compiles into every program and lands in the attachment.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  WeaselRenderer, registerProgram, blur, idMask, type IdBuffer,
} from '@weasel-js/renderer';
import type { DrawCommand } from './DrawCommand';

const W = 40;
const H = 20;

let renderer: WeaselRenderer | undefined;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

function open(dpr = 1): WeaselRenderer {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr });
  return renderer;
}

const box = (x: number, y: number, w: number, h: number, color = '#ff0000'): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y, width: w, height: h },
  fill: { paint: { color } },
});
const tagged = (pickId: number, ...children: DrawCommand[]): DrawCommand => ({ kind: 'group', pickId, children });
const at = (b: IdBuffer, x: number, y: number): number => b.data[(y - b.y) * b.width + (x - b.x)];

/** Opaque inside a circle filling its bounds, transparent outside it. */
const DISC = registerProgram('ids-browser-disc', '', `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
void main() {
  float a = length(v_uv - 0.5) < 0.5 ? 1.0 : 0.0;
  outColor = vec4(0.0, 0.0, a, a);
}
`);

/** Discards everything left of the middle of its bounds. */
const RIGHT_HALF = registerProgram('ids-browser-right-half', '', `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
void main() {
  if (v_uv.x < 0.5) discard;
  outColor = vec4(0.0, 1.0, 0.0, 1.0);
}
`);

describe('renderIds, in a real context', () => {
  it('holds the topmost id at each pixel, and 0 where nothing drew', () => {
    const ids = open().renderIds([
      tagged(1, box(0, 0, 20, 20)),
      tagged(2, box(10, 0, 20, 20)),
    ]);
    expect(at(ids, 5, 10)).toBe(1);
    expect(at(ids, 15, 10)).toBe(2);
    expect(at(ids, 25, 10)).toBe(2);
    expect(at(ids, 35, 10)).toBe(0);
  });

  it('keeps an id apart for each of a batched run\'s neighbors', () => {
    const ids = open().renderIds([1, 2, 3, 4].map((n) => tagged(n, box((n - 1) * 10, 0, 10, 20))));
    expect([5, 15, 25, 35].map((x) => at(ids, x, 10))).toEqual([1, 2, 3, 4]);
  });

  it('takes what a custom shader paints, not its bounds', () => {
    const disc: DrawCommand = { kind: 'shader', program: DISC, uniforms: {}, bounds: { x: 0, y: 0, w: 20, h: 20 } };
    const half: DrawCommand = { kind: 'shader', program: RIGHT_HALF, uniforms: {}, bounds: { x: 20, y: 0, w: 20, h: 20 } };
    const ids = open().renderIds([tagged(5, disc), tagged(6, half)]);
    expect(at(ids, 10, 10)).toBe(5);
    expect(at(ids, 1, 1)).toBe(0);
    expect(at(ids, 22, 10)).toBe(0);
    expect(at(ids, 35, 10)).toBe(6);
  });

  it('lets a child carry an id of its own, and 0 claim a pixel for nothing', () => {
    const ids = open().renderIds([
      tagged(1, box(0, 0, 40, 20), tagged(2, box(10, 0, 10, 20)), tagged(0, box(30, 0, 10, 20))),
    ]);
    expect([5, 15, 25, 35].map((x) => at(ids, x, 10))).toEqual([1, 2, 1, 0]);
  });

  it('takes the children\'s ids through a group\'s effects, and the group\'s where a blur spreads past them', () => {
    const ids = open().renderIds([
      box(0, 0, 40, 20, '#ffffff'),
      {
        kind: 'group', pickId: 9, effects: blur({ radius: 4 }),
        children: [tagged(3, box(15, 5, 10, 10, '#000000'))],
      },
    ]);
    expect(at(ids, 20, 10)).toBe(3);
    expect(at(ids, 13, 10)).toBe(9);
    expect(at(ids, 2, 10)).toBe(0);
  });

  it('claims with a fragment of at least minAlpha', () => {
    const faint: DrawCommand = { kind: 'group', pickId: 4, alpha: 0.3, children: [box(0, 0, 40, 20)] };
    expect(at(open().renderIds([faint]), 10, 10)).toBe(4);
    renderer!.dispose();
    expect(at(open().renderIds([faint], undefined, { minAlpha: 0.5 }), 10, 10)).toBe(0);
  });

  it('reads one device pixel for a point, at the renderer\'s density', () => {
    const ids = open(2).renderIds([tagged(1, box(0, 0, 10, 20)), tagged(2, box(10, 0, 10, 20))], undefined, {
      rect: { x: 10.25, y: 3, width: 0, height: 0 },
    });
    expect(ids).toMatchObject({ x: 20, y: 6, width: 1, height: 1 });
    expect([...ids.data]).toEqual([2]);
  });

  it('leaves the canvas drawing as it was', () => {
    const r = open();
    const gl = r._gl();
    r.render([box(0, 0, 40, 20, '#00ff00')]);
    r.renderIds([tagged(1, box(0, 0, 40, 20, '#ff0000'))]);
    const px = new Uint8Array(4);
    gl.readPixels(5, 5, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    expect([...px]).toEqual([0, 255, 0, 255]);
  });

  it('leaves out the groups an exclude names, so what is beneath them shows', () => {
    const cmds = [tagged(1, box(0, 0, 40, 20)), tagged(2, box(10, 0, 20, 20), tagged(3, box(15, 0, 5, 20)))];
    const ids = open().renderIds(cmds, undefined, { exclude: new Set([2]) });
    expect([5, 12, 17, 25].map((x) => at(ids, x, 10))).toEqual([1, 1, 1, 1]);
    const point = renderer!.renderIds(cmds, undefined, { rect: { x: 17, y: 10, width: 0, height: 0 }, exclude: new Set([3]) });
    expect([...point.data]).toEqual([2]);
  });

  it('gives a mask of the ids asked for', () => {
    const ids = open().renderIds([tagged(1, box(0, 0, 20, 20)), tagged(2, box(20, 0, 20, 20))]);
    const mask = idMask(ids, new Set([2]));
    expect(mask[10 * W + 5]).toBe(0);
    expect(mask[10 * W + 25]).toBe(1);
  });
});
