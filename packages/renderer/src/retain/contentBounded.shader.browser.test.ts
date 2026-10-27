/**
 * A retained group holding a custom shader, against real WebGL2: bounded by
 * the shader's `bounds`, and drawing the same pixels into that surface as
 * straight onto the canvas, including a shader that reads `gl_FragCoord`
 * through `u_fragOrigin`, whose pattern would shift if the surface's offset
 * reached it.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand, GroupDrawCommand } from '../DrawCommand';
import { _resetProgramRegistryForTests, registerProgram } from '../shaders/registerProgram';

const W = 48;
const H = 32;
const DPR = 2;
const DW = W * DPR;
const DH = H * DPR;

const GROUND: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#336699' } } },
];

const HEAD = '#version 300 es\nprecision highp float;\nin vec2 v_uv;\nout vec4 o;\n';
const BY_UV = `${HEAD}void main() { o = vec4(v_uv.x, v_uv.y, 0.5, 1.0); }`;
/** A pattern of the fragment's device pixel, so a shifted origin shows. */
const BY_ORIGIN = `${HEAD}uniform vec2 u_fragOrigin;
void main() {
  vec2 p = gl_FragCoord.xy - u_fragOrigin;
  o = vec4(fract(p.x / 7.0), fract(p.y / 5.0), 0.25, 1.0);
}`;
const BY_FRAG_COORD = `${HEAD}void main() { o = vec4(fract(gl_FragCoord.x / 7.0), fract(gl_FragCoord.y / 5.0), 0.25, 1.0); }`;

let renderer: WeaselRenderer | undefined;
let gl: WebGL2RenderingContext;

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
  _resetProgramRegistryForTests();
});

function open(width = DW, height = DH): WeaselRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: DPR });
  return renderer;
}

function read(r: WeaselRenderer, commands: DrawCommand[], width = DW, height = DH): Uint8Array {
  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0.1, 0.8, 0.3, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  r.render(commands);
  const px = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
}

function maxDiff(a: Uint8Array, b: Uint8Array): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

/** The pixel at device (x, y) from the bottom left of a `width`-wide buffer. */
function atGl(px: Uint8Array, x: number, y: number, width = DW): number[] {
  const i = (y * width + x) * 4;
  return [px[i], px[i + 1], px[i + 2], px[i + 3]];
}

function layer(id: string, frag: string): (retain?: string) => GroupDrawCommand {
  const program = registerProgram(id, '', frag);
  const children: DrawCommand[] = [{ kind: 'shader', program, uniforms: {}, bounds: { x: 8, y: 6, w: 20, h: 14 } }];
  return (retain) => ({ kind: 'group', retain, children });
}

function compare(r: WeaselRenderer, make: (retain?: string) => GroupDrawCommand, width = DW, height = DH) {
  const direct = read(r, [...GROUND, make()], width, height);
  read(r, [...GROUND, make('layer')], width, height);
  const kept = read(r, [...GROUND, make('layer')], width, height);
  return { direct, kept, stats: r.lastFrameStats().retained };
}

const canvasBytes = DW * DH * 4;

describe('a retained custom shader, in a real context', () => {
  it('keeps a surface covering only its bounds', () => {
    const { direct, kept, stats } = compare(open(), layer('by-uv', BY_UV));
    expect(stats.composited).toBe(1);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(1);
    expect(stats.bytes).toBeGreaterThan(0);
    expect(stats.bytes).toBeLessThan(canvasBytes / 3);
  });

  it('reads gl_FragCoord through u_fragOrigin the same in its surface as on the canvas', () => {
    const { direct, kept, stats } = compare(open(), layer('by-origin', BY_ORIGIN));
    expect(stats.composited).toBe(1);
    expect(stats.bytes).toBeLessThan(canvasBytes / 3);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(1);
    // Device (30, 40) from the bottom left lies inside the bounds.
    const [red, green] = atGl(kept, 30, 40);
    expect(Math.abs(red - ((30.5 / 7) % 1) * 255)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(green - ((40.5 / 5) % 1) * 255)).toBeLessThanOrEqual(1.5);
  });

  it('keeps a whole-buffer surface for a shader reading gl_FragCoord without u_fragOrigin', () => {
    const { direct, kept, stats } = compare(open(), layer('by-frag-coord', BY_FRAG_COORD));
    expect(stats.composited).toBe(1);
    expect(stats.bytes).toBeGreaterThanOrEqual(canvasBytes);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(1);
  });

  it('gives u_fragOrigin the tile\'s corner on a shared canvas', () => {
    const r = open(DW * 2, DH);
    r.setTarget({ origin: { x: W, y: 0 } });
    const { direct, kept, stats } = compare(r, layer('by-origin-tile', BY_ORIGIN), DW * 2, DH);
    expect(stats.composited).toBe(1);
    expect(maxDiff(direct, kept)).toBeLessThanOrEqual(1);
    // The tile's own device (30, 40) is the canvas's (DW + 30, 40).
    const [red] = atGl(direct, DW + 30, 40, DW * 2);
    expect(Math.abs(red - ((30.5 / 7) % 1) * 255)).toBeLessThanOrEqual(1.5);
  });
});
