/**
 * Probe for retained.tiles.browser.test.ts's first case: draws the same
 * frame many times, tiled and whole, each in a fresh pair of contexts, and
 * logs every difference with its pixels. Besides tiled against whole, each
 * iteration is compared with the first iteration's tiled and whole frames, so
 * a difference that is the GPU disagreeing with itself shows apart from one
 * a tile seam makes. `loaded` runs the same loop with a second context
 * queuing heavy fragment work before every frame. run.sh copies this file
 * beside the test it probes and removes it after.
 */
import { afterEach, describe, it } from 'vitest';
import { mat3, pathFromD } from '@weasel-js/geom';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand } from '../DrawCommand';
import { _resetProgramRegistryForTests, registerProgram } from '../shaders/registerProgram';
import type { RetainedSurfaces } from './RetainedSurfaces';

const ITER = 300;
const W = 64;
const H = 48;
const DPR = 2;
const DW = W * DPR;
const DH = H * DPR;
const TILE = 37;

const GROUND: DrawCommand[] = [
  { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#336699' } } },
];
const HEAD = '#version 300 es\nprecision highp float;\nin vec2 v_uv;\nout vec4 o;\n';
const BY_ORIGIN = `${HEAD}uniform vec2 u_fragOrigin;
void main() {
  vec2 p = gl_FragCoord.xy - u_fragOrigin;
  o = vec4(fract(p.x / 7.0), fract(p.y / 5.0), 0.25, 1.0);
}`;

function world(): DrawCommand[] {
  const cmds: DrawCommand[] = [];
  for (let i = -3; i < 9; i++) {
    for (let j = -3; j < 7; j++) {
      cmds.push({
        kind: 'path', path: { kind: 'rect', x: i * 11 + 0.3, y: j * 9 + 0.7, width: 6.2, height: 4.9 },
        fill: { paint: { color: `rgba(${(i * 40) & 255}, ${(j * 60) & 255}, 180, 0.7)` } },
      });
    }
  }
  cmds.push(
    { kind: 'path', path: pathFromD('M20 20 A13 13 0 1 1 19.99 20 Z'), fill: { paint: { color: '#ffcc00' } } },
    { kind: 'path', path: pathFromD('M-20 60 C 10 -10, 50 90, 90 10'), stroke: { paint: { color: '#ff3366' }, width: 1.7 } },
    {
      kind: 'path', path: { kind: 'rect', x: 40, y: -10, width: 30, height: 70 },
      fill: { paint: { kind: 'linear-gradient', from: { x: 40, y: 0 }, to: { x: 70, y: 0 }, units: 'world', stops: [{ offset: 0, color: 'rgba(0,255,0,0.5)' }, { offset: 1, color: 'rgba(255,0,255,0.5)' }] } },
    },
    {
      kind: 'group', clip: pathFromD('M8 30 L40 22 L36 46 Z'),
      children: [{ kind: 'path', path: pathFromD('M0 20 C 20 60, 40 0, 60 40'), stroke: { paint: { color: '#ffffff' }, width: 3 } }],
    },
  );
  return cmds;
}

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const d of disposers.splice(0)) d();
  _resetProgramRegistryForTests();
});

function context(w = DW, h = DH): WebGL2RenderingContext {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true })!;
}

const storeOf = (r: WeaselRenderer): RetainedSurfaces => (r as unknown as { retained: RetainedSurfaces }).retained;

function draw(tile: number, commands: DrawCommand[]): Uint8Array {
  const gl = context();
  const r = new WeaselRenderer({ gl, width: W, height: H, dpr: DPR });
  storeOf(r).tile = tile;
  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0.1, 0.8, 0.3, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  r.render(commands, mat3.identity());
  const px = new Uint8Array(DW * DH * 4);
  gl.readPixels(0, 0, DW, DH, gl.RGBA, gl.UNSIGNED_BYTE, px);
  r.dispose();
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return px;
}

interface Px { x: number; y: number; a: number[]; b: number[] }
function diff(a: Uint8Array, b: Uint8Array): { max: number; off: number; px: Px[] } {
  let max = 0;
  let off = 0;
  const px: Px[] = [];
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    max = Math.max(max, d);
    if (d > 0) {
      off++;
      const p = i / 4;
      if (px.length < 64) px.push({ x: p % DW, y: Math.floor(p / DW), a: [...a.subarray(i, i + 4)], b: [...b.subarray(i, i + 4)] });
    }
  }
  return { max, off, px };
}

/** A context that keeps the GPU busy: each call queues `n` full-buffer draws
 *  of a fragment loop and flushes without waiting. */
function burner(): (n: number) => void {
  const gl = context(1024, 1024);
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, '#version 300 es\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.0:-1.0,gl_VertexID==2?3.0:-1.0);gl_Position=vec4(p,0.0,1.0);}');
  gl.compileShader(vs);
  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, '#version 300 es\nprecision highp float;uniform float u;out vec4 o;void main(){float s=gl_FragCoord.x*u;for(int i=0;i<400;i++){s=sin(s*1.0001+gl_FragCoord.y);}o=vec4(s,0.0,0.0,1.0);}');
  gl.compileShader(fs);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const u = gl.getUniformLocation(prog, 'u');
  disposers.push(() => gl.getExtension('WEBGL_lose_context')?.loseContext());
  let k = 0;
  return (n) => {
    for (let i = 0; i < n; i++) {
      gl.uniform1f(u, 0.001 * ++k);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.flush();
  };
}

function loop(mode: string, before: (() => void) | null): void {
  let refTiled: Uint8Array | null = null;
  let refWhole: Uint8Array | null = null;
  const count = { tw: 0, tt: 0, ww: 0 };
  const t0 = performance.now();
  for (let i = 0; i < ITER; i++) {
    registerProgram('tiles-by-origin', '', BY_ORIGIN);
    const shader: DrawCommand = {
      kind: 'shader', bounds: { x: 2, y: 3, w: 40, h: 30 }, uniforms: {},
      program: registerProgram('tiles-by-origin', '', BY_ORIGIN),
    };
    const commands = [...GROUND, { kind: 'group', retain: 'L', children: [...world(), shader] } as DrawCommand];
    before?.();
    const tiled = draw(TILE, commands);
    before?.();
    const whole = draw(Infinity, commands);
    refTiled ??= tiled;
    refWhole ??= whole;
    const tw = diff(tiled, whole);
    const tt = diff(tiled, refTiled);
    const ww = diff(whole, refWhole);
    if (tw.off) count.tw++;
    if (tt.off) count.tt++;
    if (ww.off) count.ww++;
    if (tw.off || tt.off || ww.off) {
      console.log(`PROBE ${JSON.stringify({ mode, i, tw, tt, ww })}`);
    }
    if ((i + 1) % 50 === 0) console.log(`PROBE-PROGRESS ${mode} ${i + 1}/${ITER}`);
  }
  console.log(`PROBE-SUMMARY ${JSON.stringify({ mode, iter: ITER, ms: Math.round(performance.now() - t0), ...count })}`);
}

describe('tiles flake probe', () => {
  it('quiet', () => loop('quiet', null), 300_000);
  it('loaded', () => {
    const burn = burner();
    loop('loaded', () => burn(6));
  }, 300_000);
});
