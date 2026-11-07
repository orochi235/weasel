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
import { mat3, pathFromD, pointAlongPath, polylineFromPoints, type Affine, type Path } from '@weasel-js/geom';
import { clipRibbon, clipWindow, strokeSpaceOf, tessellateStroke, type StrokeMetric } from '@weasel-js/stroke';
import { quantizeStrokeScale } from '../cache/strokeMeshCache';
import { stencilledEvenOdd } from './stencilledEvenOdd';
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

/** Every triangle edge of either build of `stroke` along `path`, as x0, y0, x1, y1, on
 *  screen under `view`, built in `metric` where one is given. */
export function edgesOf(
  path: Path, stroke: CommandStroke, insets: { start?: number; end?: number } = {},
  metric?: StrokeMetric, view: Affine = [1, 0, 0, 1, 0, 0], seam = 1,
): number[] {
  const { trim, ...untrimmed } = stroke as Stroke;
  const opts = { flattenTolerance: TOLERANCE, startInset: insets.start, endInset: insets.end, metric };
  const ribbon = clipRibbon(path, untrimmed, opts);
  const meshes = [tessellateStroke(path, stroke as Stroke, opts), ribbon.mesh, clipWindow(ribbon, path, trim!, seam)?.ends];
  const out: number[] = [];
  const [a, b, c, d, e, f] = view;
  const push = (x: number, y: number) => out.push(a * x + c * y + e, b * x + d * y + f);
  for (const mesh of meshes) {
    if (!mesh) continue;
    const v = mesh.vertices, idx = mesh.indices;
    for (let t = 0; t < idx.length; t += 3) {
      for (let k = 0; k < 3; k++) {
        const p = idx[t + k] * 2, q = idx[t + (k + 1) % 3] * 2;
        push(v[p], v[p + 1]);
        push(v[q], v[q + 1]);
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

/**
 * Every paint the clip marks and covers rather than drawing straight. Its
 * reference is the stroke rebuilt in the same paint made opaque, drawn in a
 * group of its own at the paint's alpha: the rebuilt ribbon covers some
 * ground twice at a sharp turn, which a stroke's paint must not show. Each
 * may differ by `tolerance` in a channel: the rebuilt ribbon is small enough
 * to batch, which reads a gradient off a ramp, and vertex colors interpolate
 * across triangles the two builds cut differently. Vertex colors are drawn on
 * the curve alone: where a sharp turn's quads overlap, the clipped ribbon's
 * earlier segment paints the overlap, and the rebuilt one splits it at the
 * bisector, so each shows a different anchor's color there.
 */
const PAINTS: [string, Pick<CommandStroke, 'paint' | 'vertexColors'>, CommandPaint, number, number][] = [
  ['translucent', { paint: { color: '#ffb000', opacity: 0.5 } }, { color: '#ffb000' }, 0.5, 1],
  ['a gradient', { paint: GRADIENT }, GRADIENT, 1, 3],
  ['a translucent gradient', { paint: { ...GRADIENT, opacity: 0.6 } as CommandPaint }, GRADIENT, 0.6, 3],
  ['vertex colors', {
    paint: { color: '#ffffff', opacity: 0.7 },
    vertexColors: Array.from({ length: 41 }, (_, k) => [k / 40, 0.4, 1 - k / 40, 1]).flat(),
  }, { color: '#ffffff' }, 0.7, 3],
];

/** One test per shape and paint, each against every trim. */
export function paintCases(antialias: boolean): void {
  for (const [name, path, curved] of SHAPES) {
    for (const [painted, fields, opaquePaint, alpha, tolerance] of PAINTS) {
      if (fields.vertexColors && !curved) continue;
      it(`paints what the rebuilt one does: ${name}, ${painted}${antialias ? ', multisampled' : ''}`, () => {
        for (const trim of TRIMS) {
          const stroke: CommandStroke = { width: 9, cap: 'round', join: 'round', ...fields, trim };
          const clipped = paint(frame(path, stroke), antialias, true);
          const once: DrawCommand[] = [{ kind: 'path', path, stroke: { ...stroke, paint: opaquePaint } }];
          const rebuilt = paint(alpha < 1 ? [{ kind: 'group', isolate: true, alpha, children: once }] : once, antialias, false);
          expect(clipped.programs, JSON.stringify(trim)).toBe(1);
          expect(inked(clipped.px)).toBeGreaterThan(0);
          const near = antialias ? 0.75 : 1 / 16;
          const edges = edgesOf(path, stroke);
          const off = offCuts(clipped.px, rebuilt.px, cutsOf(path, trim), edges, near, curved ? 14 : 0, tolerance);
          expect(off.slice(0, 8).map((at) => `${at} ${pixelAt(clipped.px, at)} vs ${pixelAt(rebuilt.px, at)}`), JSON.stringify(trim)).toEqual([]);
        }
      });
    }
  }
}

function pixelAt(px: Uint8Array, at: string): string {
  const [x, y] = at.split(',').map(Number);
  const i = ((H - 1 - Math.floor(y)) * W + Math.floor(x)) * 4;
  return Array.from(px.subarray(i, i + 4)).join('/');
}

/** A view that stretches and shears, so a `{ px }` stroke is built in its metric. */
const STRETCH: Affine = [0.8, 0, 0.25, 0.95, 0, 0];

/** One test per open shape, translucent and opaque, each against every trim, in a stretched view. */
export function metricCases(antialias: boolean): void {
  const [a, b, c, d] = STRETCH;
  const { scale, metric } = strokeSpaceOf(a, b, c, d);
  const px = 9;
  const seam = 1 / Math.sqrt(Math.abs(a * d - b * c));
  for (const [name, path, curved] of SHAPES) {
    for (const opacity of [1, 0.5]) {
      it(`clips in the view's metric what the rebuilt one draws: ${name}, opacity ${opacity}${antialias ? ', multisampled' : ''}`, () => {
        for (const trim of TRIMS) {
          const stroke: CommandStroke = { width: { px }, cap: 'round', join: 'round', paint: { color: '#30a0ff', opacity }, trim };
          const view = (children: DrawCommand[]): DrawCommand[] => [{ kind: 'group', transform: mat3.fromAffine(STRETCH), children }];
          const clipped = paint(view(frame(path, stroke)), antialias, true);
          const once = view(frame(path, { ...stroke, paint: { color: '#30a0ff' } }));
          const rebuilt = paint(opacity < 1 ? [{ kind: 'group', isolate: true, alpha: opacity, children: once }] : once, antialias, false);
          expect(clipped.programs, JSON.stringify(trim)).toBe(1);
          expect(inked(clipped.px)).toBeGreaterThan(0);
          const width = px / quantizeStrokeScale(px, scale);
          const edges = edgesOf(path, { ...stroke, width }, {}, metric ?? undefined, STRETCH, seam);
          const cuts = cutsOf(path, trim).map(({ x, y }) => ({ x: a * x + c * y, y: b * x + d * y }));
          const near = antialias ? 0.75 : 1 / 16;
          const off = offCuts(clipped.px, rebuilt.px, cuts, edges, near, curved ? 14 : 0, 1);
          expect(off.slice(0, 8).map((at) => `${at} ${pixelAt(clipped.px, at)} vs ${pixelAt(rebuilt.px, at)}`), JSON.stringify(trim)).toEqual([]);
        }
      });
    }
  }
}

/** Every paint a stroke takes, opaque or not, for comparing a stroke with itself. */
const ALL_PAINTS: [string, Pick<CommandStroke, 'paint' | 'vertexColors'>][] = [
  ['opaque', { paint: { color: '#ffb000' } }],
  ...PAINTS.map(([name, fields]): [string, Pick<CommandStroke, 'paint' | 'vertexColors'>] => [name, fields]),
];

/**
 * A stroke trimmed to the whole of itself against the same stroke with no
 * trim, which must draw alike pixel for pixel: a tween that ends at the full
 * stroke and then drops its trim does not change a pixel. Sharp turns
 * included, which is where a translucent ribbon could blend twice and a
 * vertex-colored one split its colors another way.
 */
export function wholeCases(antialias: boolean): void {
  for (const [name, path] of SHAPES) {
    for (const [painted, fields] of ALL_PAINTS) {
      it(`draws a whole trim as no trim: ${name}, ${painted}${antialias ? ', multisampled' : ''}`, () => {
        const stroke: CommandStroke = { width: 9, cap: 'round', join: 'round', ...fields };
        for (const view of [undefined, STRETCH]) {
          const at = (s: CommandStroke): DrawCommand[] => (view
            ? [{ kind: 'group', transform: mat3.fromAffine(view), children: frame(path, { ...s, width: { px: 9 } }) }]
            : frame(path, s));
          const untrimmed = paint(at(stroke), antialias, true).px;
          for (const trim of [{}, { start: 0, end: 1 }]) {
            const whole = paint(at({ ...stroke, trim }), antialias, true).px;
            expect(offCuts(whole, untrimmed, [], [], 0, 0), `${JSON.stringify(trim)}${view ? ' stretched' : ''}`).toEqual([]);
          }
        }
      });
    }
  }
}

/** A curved clip, which only the stencil cuts. */
const ROUND_CLIP = pathFromD('M 100 10 C 160 10 190 50 190 80 C 190 120 150 150 100 150 C 40 150 10 120 10 80 C 10 40 50 10 100 10 Z');
const SECOND_CLIP = pathFromD('M 0 0 L 150 0 C 170 60 170 100 150 160 L 0 160 Z');

/** Wrappers around a drawing, each one something else in the renderer that holds the stencil. */
const STENCIL_USERS: [string, (children: DrawCommand[]) => DrawCommand[]][] = [
  ['a curved clip', (children) => [{ kind: 'group', clip: ROUND_CLIP, children }]],
  ['two nested curved clips', (children) => [{ kind: 'group', clip: ROUND_CLIP, children: [{ kind: 'group', clip: SECOND_CLIP, children }] }]],
  ['an isolated group under a clip', (children) => [{ kind: 'group', clip: ROUND_CLIP, children: [{ kind: 'group', isolate: true, children }] }]],
  ['a retained group', (children) => [{ kind: 'group', retain: 'trim-stencil', children }]],
  ['even-odd fills drawn through the stencil either side', (children) => [
    { kind: 'path', path: stencilledEvenOdd(pathFromD('M 20 20 L 180 20 L 180 70 L 20 70 Z')), fill: { paint: { color: '#20c060', opacity: 0.5 } } },
    ...children,
    { kind: 'path', path: stencilledEvenOdd(pathFromD('M 20 90 L 180 90 L 180 140 L 20 140 Z')), fill: { paint: { color: '#c02060', opacity: 0.5 } } },
  ]],
];

/** A translucent trimmed stroke inside each stencil user, against the stroke painted once inside the same. */
export function stencilCases(antialias: boolean): void {
  for (const [name, wrap] of STENCIL_USERS) {
    it(`marks and covers inside ${name}${antialias ? ', multisampled' : ''}`, () => {
      for (const trim of TRIMS) {
        const stroke: CommandStroke = { width: 9, cap: 'round', join: 'round', paint: { color: '#ffb000', opacity: 0.5 }, trim };
        const clipped = paint(wrap(frame(zigzag, stroke)), antialias, true);
        const once: DrawCommand = { kind: 'group', isolate: true, alpha: 0.5, children: frame(zigzag, { ...stroke, paint: { color: '#ffb000' } }) };
        const rebuilt = paint(wrap([once]), antialias, false);
        expect(clipped.programs, JSON.stringify(trim)).toBe(1);
        expect(inked(clipped.px)).toBeGreaterThan(0);
        const near = antialias ? 0.75 : 1 / 16;
        const off = offCuts(clipped.px, rebuilt.px, cutsOf(zigzag, trim), edgesOf(zigzag, stroke), near, 0, 1);
        expect(off.slice(0, 8).map((at) => `${at} ${pixelAt(clipped.px, at)} vs ${pixelAt(rebuilt.px, at)}`), JSON.stringify(trim)).toEqual([]);
      }
    });
  }
}
