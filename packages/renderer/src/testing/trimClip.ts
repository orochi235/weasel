/**
 * A trimmed stroke clipped from its cached ribbon in the shader, against the
 * same stroke rebuilt trimmed on the CPU. On a straight edge both end on the
 * same line square to it, but the two are cut into different triangles, and
 * the rasterizer holds no vertex exactly, so a pixel center or sample within
 * its snapping distance of a triangle's edge can go the other way. On a curve the rebuilt run ends on the curve and the clipped
 * one on the chord beside it, so pixels beside the chord a cut lands on may
 * differ too. Nothing else may.
 */
import { afterEach, expect, it } from 'vitest';
import { pathFromD, pointAlongPath, polylineFromPoints, type Path } from '@weasel-js/geom';
import { clipRibbon, clipWindow, tessellateStroke } from '@weasel-js/stroke';
import type { CommandPaint, CommandStroke, Stroke, StrokeTrim } from '@weasel-js/paint';
import { WeaselRenderer } from '@weasel-js/renderer';
import type { DrawCommand } from '../DrawCommand';
import { glProgramHandle } from '../gpu/webgl/GlProgram';

const W = 200;
const H = 160;
const TOLERANCE = 0.25;

const renderers: WeaselRenderer[] = [];

/** Disposes every renderer `paint` made, after each test of the file that calls it. */
export function disposeAfterEach(): void {
  afterEach(() => {
    for (const r of renderers) r.dispose();
    renderers.length = 0;
  });
}

interface Frame { px: Uint8Array; programs: number }

export function paint(commands: DrawCommand[], antialias: boolean, clip: boolean): Frame {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, preserveDrawingBuffer: true, antialias })!;
  const r = new WeaselRenderer({ gl, width: W, height: H, dpr: 1, flattenTolerance: TOLERANCE });
  renderers.push(r);
  if (!clip) Object.defineProperty(r._batchVariants(), 'trimClip', { value: false });
  let used = 0;
  const select = gl.useProgram.bind(gl);
  const trimmed = glProgramHandle(r._batchVariants().trimmedRibbon());
  gl.useProgram = (p) => { if (p === trimmed) used++; select(p); };
  r.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return { px, programs: used };
}

/** The stroke alone: with nothing staged before it, any ribbon past the batch's smallest cap clips. */
export function frame(path: Path, stroke: CommandStroke): DrawCommand[] {
  return [{ kind: 'path', path, stroke }];
}

export const zigzag = polylineFromPoints(Array.from({ length: 41 }, (_, k) => ({ x: 10.3 + k * 4.47, y: k % 2 ? 40.2 : 112.6 })));
const SHAPES: [string, Path, boolean][] = [
  ['a zigzag', zigzag, false],
  ['a closed star', pathFromD('M 100 8 L 118.2 58.9 L 172.4 59.2 L 129.3 91.8 L 145.1 146.7 L 100 115.4 L 54.9 146.7 L 70.7 91.8 L 27.6 59.2 L 81.8 58.9 Z'), false],
  ['a curve', pathFromD('M 12 140 C 40 -20 90 -20 100 80 S 170 180 190 20'), true],
];

export const TRIMS: StrokeTrim[] = [{ end: 0.23 }, { start: 0.31, end: 0.67 }, { start: 0.58 }, { start: 0.04, end: 0.96 }, {}];

/** Where each cut a trim makes lands on the path. */
export function cutsOf(path: Path, trim: StrokeTrim): { x: number; y: number }[] {
  return [trim.start, trim.end].filter((t): t is number => typeof t === 'number' && t > 0 && t < 1)
    .map((t) => pointAlongPath(path, t)!.point);
}

/** Every triangle edge of either build of `stroke` along `path`, as x0, y0, x1, y1. */
export function edgesOf(path: Path, stroke: CommandStroke, insets: { start?: number; end?: number } = {}): number[] {
  const { trim, ...untrimmed } = stroke as Stroke;
  const opts = { flattenTolerance: TOLERANCE, startInset: insets.start, endInset: insets.end };
  const ribbon = clipRibbon(path, untrimmed, opts);
  const meshes = [tessellateStroke(path, stroke as Stroke, opts), ribbon.mesh, clipWindow(ribbon, path, trim!, 1)?.ends];
  const out: number[] = [];
  for (const mesh of meshes) {
    if (!mesh) continue;
    const v = mesh.vertices, idx = mesh.indices;
    for (let t = 0; t < idx.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const p = idx[t + k] * 2, q = idx[t + (k + 1) % 3] * 2;
        out.push(v[p], v[p + 1], v[q], v[q + 1]);
      }
    }
  }
  return out;
}

function fromEdges(edges: number[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < edges.length; i += 4) {
    const ax = edges[i], ay = edges[i + 1], dx = edges[i + 2] - ax, dy = edges[i + 3] - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

/** Pixels where `a` and `b` differ by more than `tolerance` in a channel, other than within `near` of one of `edges`,
 *  or on a curve within `reach` of a cut, as "x,y". */
export function offCuts(
  a: Uint8Array, b: Uint8Array, cuts: ReturnType<typeof cutsOf>, edges: number[], near: number, reach: number,
  tolerance = 0,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a[i + k] - b[i + k]));
    if (d <= tolerance) continue;
    const p = i / 4;
    const x = p % W + 0.5, y = H - 1 - Math.floor(p / W) + 0.5;
    const excused = cuts.some((c) => Math.hypot(x - c.x, y - c.y) <= reach) || fromEdges(edges, x, y) <= near;
    if (!excused) out.push(`${x},${y}`);
  }
  return out;
}

export const inked = (px: Uint8Array) => {
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) n++;
  return n;
};

/** One test per shape and cap, each against every trim, single-sampled or multisampled. */
export function capCases(antialias: boolean): void {
  for (const [name, path, curved] of SHAPES) {
    for (const cap of ['butt', 'round', 'square'] as const) {
      it(`draws what the rebuilt one does: ${name}, ${cap} caps${antialias ? ', multisampled' : ''}`, () => {
        for (const trim of TRIMS) {
          const stroke: CommandStroke = { width: 9, cap, join: cap === 'round' ? 'round' : 'miter', paint: { color: '#ffb000' }, trim };
          const clipped = paint(frame(path, stroke), antialias, true);
          const rebuilt = paint(frame(path, stroke), antialias, false);
          expect(clipped.programs, JSON.stringify(trim)).toBe(1);
          expect(rebuilt.programs).toBe(0);
          expect(inked(clipped.px)).toBeGreaterThan(0);
          const near = antialias ? 0.75 : 1 / 16;
          const edges = edgesOf(path, stroke);
          expect(offCuts(clipped.px, rebuilt.px, cutsOf(path, trim), edges, near, curved ? 14 : 0), JSON.stringify(trim)).toEqual([]);
        }
      });
    }
  }
}

const GRADIENT: CommandPaint = {
  kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: W, y: H }, units: 'local',
  stops: [{ offset: 0, color: '#2060ff' }, { offset: 1, color: '#ff6020' }],
};

/** Every paint the clip marks and covers rather than drawing straight, with the
 *  per-channel difference each may show: vertex colors interpolate across
 *  triangles the two builds cut differently. */
const PAINTS: [string, Pick<CommandStroke, 'paint' | 'vertexColors'>, number][] = [
  ['translucent', { paint: { color: '#ffb000', opacity: 0.5 } }, 0],
  ['a gradient', { paint: GRADIENT }, 0],
  ['a translucent gradient', { paint: { ...GRADIENT, opacity: 0.6 } as CommandPaint }, 0],
  ['vertex colors', { paint: { color: '#ffffff', opacity: 0.7 }, vertexColors: Array.from({ length: 41 }, (_, k) => [k / 40, 0.4, 1 - k / 40, 1]).flat() }, 3],
];

/** One test per shape and paint, each against every trim. */
export function paintCases(antialias: boolean): void {
  for (const [name, path, curved] of SHAPES) {
    for (const [painted, fields, tolerance] of PAINTS) {
      it(`paints what the rebuilt one does: ${name}, ${painted}${antialias ? ', multisampled' : ''}`, () => {
        for (const trim of TRIMS) {
          const stroke: CommandStroke = { width: 9, cap: 'round', join: 'round', ...fields, trim };
          const clipped = paint(frame(path, stroke), antialias, true);
          const rebuilt = paint(frame(path, stroke), antialias, false);
          expect(clipped.programs, JSON.stringify(trim)).toBe(1);
          expect(inked(clipped.px)).toBeGreaterThan(0);
          const near = antialias ? 0.75 : 1 / 16;
          const edges = edgesOf(path, stroke);
          const off = offCuts(clipped.px, rebuilt.px, cutsOf(path, trim), edges, near, curved ? 14 : 0, tolerance);
          expect(off, JSON.stringify(trim)).toEqual([]);
        }
      });
    }
  }
}
