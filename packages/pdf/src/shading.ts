import { boundsOfPath, type GlMat3, mat3, type Path } from '@weasel-js/geom';
import {
  type CommandPaint,
  type CommandPaintUnits,
  gradientGeometry,
  isGradientPaint,
  resolveGradientStops,
  sampleResolvedStops,
} from '@weasel-js/paint';
import { colorFor, type Rgba } from './color';
import type { DrawState, PageCtx } from './drawCommands';
import { name, type PdfDict, type PdfRef, type PdfValue } from './objects';

type Gradient = Extract<CommandPaint, { kind: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>;
type Box = { x0: number; y0: number; x1: number; y1: number };
type Stop = { offset: number; rgba: Rgba };
type Segment = { lo: number; hi: number; c0: Rgba; c1: Rgba };

/** What a gradient fill needs in the content stream once its clip is set. */
export interface PaintShading {
  shading: string;
  softMask: string | null;
  /** The fill's constant alpha: opacity, group alpha and any alpha every stop shares. */
  alpha: number;
  /** Paint space to the current frame, or `null` when the two are the same. */
  matrix: GlMat3 | null;
}

/** A non-rgb `interpolate` is sampled into this many stops, which PDF then blends in RGB. */
const SAMPLED_STOPS = 64;
const CONIC_WEDGES = 360;

/**
 * `paint` as a shading resource for a fill of `path`. `null` for a paint that is not a
 * gradient, and for one whose space has no inverse, which paints nothing.
 */
export function paintShading(ctx: PageCtx, paint: CommandPaint, state: DrawState, path: Path): PaintShading | null {
  if (!isGradientPaint(paint)) return null;
  const toFrame = paintToFrame(ctx, paint, state);
  const toPaint = toFrame && mat3.invert(toFrame);
  if (!toFrame || !toPaint) return null;
  const box = paintBox(path, toPaint);
  let segments = rampSegments(stopsOf(paint, state));
  const geometry = geometryOf(paint, box);
  if (geometry.degenerate) segments = [{ lo: 0, hi: 1, c0: segments[0].c0, c1: segments[0].c0 }];

  let alpha = (paint.opacity ?? 1) * state.alpha;
  const a0 = segments[0].c0[3];
  const uniform = segments.every((s) => s.c0[3] === a0 && s.c1[3] === a0);
  let softMask: string | null = null;
  if (uniform) alpha *= a0;
  else {
    const mask = writeShading(ctx, geometry, rampFunction(segments, (c) => [c[3]]), 'DeviceGray');
    softMask = ctx.resources.softMask(writeMaskGroup(ctx, mask, box));
  }
  const color = writeShading(ctx, geometry, rampFunction(segments, (c) => [c[0], c[1], c[2]]), 'DeviceRGB');
  return { shading: ctx.resources.shading(color), softMask, alpha, matrix: isIdentity(toFrame) ? null : toFrame };
}

/** Paint space to the current frame, resolving `units` as the renderer's `gradientSpaceInverse` does. */
export function paintToFrame(ctx: PageCtx, paint: { units?: CommandPaintUnits }, state: DrawState): GlMat3 | null {
  if (paint.units === 'local') return mat3.identity();
  const fromPage = mat3.invert(state.transform);
  if (!fromPage) return null;
  return paint.units === 'world' && ctx.view ? mat3.multiply(fromPage, ctx.view) : fromPage;
}

function isIdentity(m: GlMat3): boolean {
  return m[0] === 1 && m[1] === 0 && m[3] === 0 && m[4] === 1 && m[6] === 0 && m[7] === 0;
}

/** The path's bounds in paint space, grown a unit so nothing on the edge is left out. */
function paintBox(path: Path, toPaint: GlMat3): Box {
  const b = boundsOfPath(path);
  const corners = [
    mat3.apply(toPaint, b.x, b.y),
    mat3.apply(toPaint, b.x + b.width, b.y),
    mat3.apply(toPaint, b.x, b.y + b.height),
    mat3.apply(toPaint, b.x + b.width, b.y + b.height),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { x0: Math.min(...xs) - 1, y0: Math.min(...ys) - 1, x1: Math.max(...xs) + 1, y1: Math.max(...ys) + 1 };
}

function stopsOf(paint: Gradient, state: DrawState): Stop[] {
  const resolved = resolveGradientStops(paint.stops);
  const space = paint.interpolate ?? 'rgb';
  if (resolved.length === 0) return [{ offset: 0, rgba: colorFor([0, 0, 0, 0], state) }];
  if (space === 'rgb') return resolved.map((s) => ({ offset: s.offset, rgba: colorFor(s.rgba, state) }));
  return Array.from({ length: SAMPLED_STOPS }, (_, i) => {
    const t = i / (SAMPLED_STOPS - 1);
    return { offset: t, rgba: colorFor(sampleResolvedStops(resolved, t, space), state) };
  });
}

const lerp = (a: Rgba, b: Rgba, f: number): Rgba => a.map((v, i) => v + (b[i] - v) * f) as Rgba;

/** The ramp over 0..1 as linear pieces, flat past either end stop, with no piece of zero width. */
function rampSegments(stops: Stop[]): Segment[] {
  const first = stops[0];
  const last = stops[stops.length - 1];
  const raw: Segment[] = [];
  if (first.offset > 0) raw.push({ lo: Math.min(0, first.offset), hi: first.offset, c0: first.rgba, c1: first.rgba });
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    raw.push({ lo: a.offset, hi: b.offset, c0: a.rgba, c1: b.rgba });
  }
  if (last.offset < 1) raw.push({ lo: last.offset, hi: Math.max(1, last.offset), c0: last.rgba, c1: last.rgba });
  const out: Segment[] = [];
  for (const s of raw) {
    const lo = Math.max(s.lo, 0);
    const hi = Math.min(s.hi, 1);
    if (hi <= lo) continue;
    const span = s.hi - s.lo;
    out.push({ lo, hi, c0: lerp(s.c0, s.c1, (lo - s.lo) / span), c1: lerp(s.c0, s.c1, (hi - s.lo) / span) });
  }
  // Every stop sits outside 0..1 on one side, so one color covers the whole ramp.
  if (out.length === 0) {
    const c = first.offset >= 1 ? first.rgba : last.rgba;
    out.push({ lo: 0, hi: 1, c0: c, c1: c });
  }
  return out;
}

function rampFunction(segments: Segment[], channels: (c: Rgba) => number[]): PdfDict {
  const pieces = segments.map(
    (s): PdfDict => ({ FunctionType: 2, Domain: [0, 1], C0: channels(s.c0), C1: channels(s.c1), N: 1 }),
  );
  if (pieces.length === 1) return pieces[0];
  return {
    FunctionType: 3,
    Domain: [0, 1],
    Functions: pieces,
    Bounds: segments.slice(0, -1).map((s) => s.hi),
    Encode: segments.flatMap(() => [0, 1]),
  };
}

type Geometry = { dict: PdfDict; data?: Uint8Array; degenerate?: boolean };

function geometryOf(paint: Gradient, box: Box): Geometry {
  const extend = [true, true];
  if (paint.kind === 'linear-gradient') {
    const { from, to } = paint;
    // A zero-length segment paints the ramp's start everywhere, as the renderer does.
    const degenerate = from.x === to.x && from.y === to.y;
    const coords = degenerate ? [from.x, from.y, from.x + 1, from.y] : [from.x, from.y, to.x, to.y];
    return { dict: { ShadingType: 2, Coords: coords, Extend: extend }, degenerate };
  }
  const { center, radius, angle } = gradientGeometry(paint);
  if (paint.kind === 'radial-gradient') {
    const r = Math.max(radius, 1e-4);
    return { dict: { ShadingType: 3, Coords: [center.x, center.y, 0, center.x, center.y, r], Extend: extend } };
  }
  const reach = Math.max(
    ...[box.x0, box.x1].flatMap((x) => [box.y0, box.y1].map((y) => Math.hypot(x - center.x, y - center.y))),
  );
  return conicMesh(center, angle, reach * 1.01 + 1);
}

/**
 * Wedges about the center, each carrying its slice of the ramp as the function's input; the
 * center vertex takes the slice's midpoint, so a wedge strays at most half a slice from the
 * `atan` the renderer takes.
 */
function conicMesh(center: { x: number; y: number }, angle: number, r: number): Geometry {
  const x0 = center.x - r;
  const y0 = center.y - r;
  const data = new Uint8Array(CONIC_WEDGES * 3 * 11);
  const view = new DataView(data.buffer);
  const coord = (v: number, lo: number) => Math.round(Math.min(1, Math.max(0, (v - lo) / (2 * r))) * 0xffffffff);
  let at = 0;
  const vertex = (x: number, y: number, t: number) => {
    view.setUint8(at, 0);
    view.setUint32(at + 1, coord(x, x0));
    view.setUint32(at + 5, coord(y, y0));
    view.setUint16(at + 9, Math.round(t * 0xffff));
    at += 11;
  };
  const rim = (i: number) => {
    const a = angle + (2 * Math.PI * i) / CONIC_WEDGES;
    vertex(center.x + r * Math.cos(a), center.y + r * Math.sin(a), i / CONIC_WEDGES);
  };
  for (let i = 0; i < CONIC_WEDGES; i++) {
    vertex(center.x, center.y, (i + 0.5) / CONIC_WEDGES);
    rim(i);
    rim(i + 1);
  }
  return {
    dict: {
      ShadingType: 4,
      BitsPerCoordinate: 32,
      BitsPerComponent: 16,
      BitsPerFlag: 8,
      Decode: [x0, x0 + 2 * r, y0, y0 + 2 * r, 0, 1],
    },
    data,
  };
}

function writeShading(ctx: PageCtx, g: Geometry, fn: PdfDict, colorSpace: string): PdfRef {
  const ref = ctx.objects.alloc();
  const dict: Record<string, PdfValue> = { ...g.dict, ColorSpace: name(colorSpace), Function: fn };
  if (g.data) ctx.objects.streamDeflated(ref, dict, g.data);
  else ctx.objects.set(ref, dict);
  return ref;
}

/** A luminosity group painting the gray alpha shading, for an ExtGState's `/SMask`. */
function writeMaskGroup(ctx: PageCtx, mask: PdfRef, box: Box): PdfRef {
  const ref = ctx.objects.alloc();
  const body = Uint8Array.from('/Sh1 sh\n', (c) => c.charCodeAt(0));
  ctx.objects.streamDeflated(
    ref,
    {
      Type: name('XObject'),
      Subtype: name('Form'),
      BBox: [box.x0, box.y0, box.x1, box.y1],
      Group: { Type: name('Group'), S: name('Transparency'), CS: name('DeviceGray') },
      Resources: { Shading: { Sh1: mask } },
    },
    body,
  );
  return ref;
}
