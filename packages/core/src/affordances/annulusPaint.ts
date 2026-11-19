import type { DrawCommand } from '@weasel-js/renderer';
import type { CommandFill, CommandStroke } from '@weasel-js/paint';
import { PATH_L, PATH_M, PATH_Z, lerp } from '@weasel-js/geom';
import type { AffordanceRegion } from './types';

type AnnulusShape = Extract<AffordanceRegion['shape'], { kind: 'annulus' }>;
type Pt = { x: number; y: number };
type Cut = { l: number; r: number; t: number; b: number };
type Run = { pts: Pt[]; closed: boolean };
/** The parts of a segment `a → b` to keep, as sorted parameter intervals in `[0, 1]`. */
type Keep = (a: Pt, b: Pt) => Array<[number, number]>;

/** Segments around the whole ellipse; 24 a quarter is smooth at typical zooms. */
const ELLIPSE_SAMPLES = 96;

/**
 * The draw commands painting an annulus region: the (contracted) outer ellipse
 * minus the (expanded) inner rect, in target-local coords carried to the screen
 * by `toScreen`. The fill is the ring split into disjoint pieces, one above the
 * rect, one below and one either side, so it is the ring under either fill rule
 * wherever the rect sits. The stroke is the ring's own outline: the ellipse
 * outside the rect and the rect inside the ellipse. Empty when the band collapses.
 */
export function annulusCommands(
  shape: AnnulusShape,
  semiAxes: { rx: number; ry: number },
  insetLocal: { x: number; y: number },
  toScreen: (x: number, y: number) => [number, number],
  fill: CommandFill | undefined,
  stroke: CommandStroke | undefined,
): DrawCommand[] {
  const rx = semiAxes.rx - insetLocal.x;
  const ry = semiAxes.ry - insetLocal.y;
  if (rx <= 0 || ry <= 0) return [];
  const { cx, cy } = shape;
  const cut: Cut = {
    l: shape.innerX - insetLocal.x,
    r: shape.innerX + shape.innerWidth + insetLocal.x,
    t: shape.innerY - insetLocal.y,
    b: shape.innerY + shape.innerHeight + insetLocal.y,
  };
  const ellipse: Pt[] = [];
  for (let i = 0; i < ELLIPSE_SAMPLES; i++) {
    const a = (2 * Math.PI * i) / ELLIPSE_SAMPLES;
    ellipse.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  const out: DrawCommand[] = [];
  if (fill) {
    const pieces = ringPieces(ellipse, cut).map((pts) => ({ pts, closed: true }));
    if (pieces.length > 0) out.push({ kind: 'path', path: polygonOf(pieces, toScreen), fill });
  }
  if (stroke) {
    const rect = [{ x: cut.l, y: cut.t }, { x: cut.r, y: cut.t }, { x: cut.r, y: cut.b }, { x: cut.l, y: cut.b }];
    const lines = [
      ...runsOf(ellipse, (a, b) => outsideCut(a, b, cut)),
      ...runsOf(rect, (a, b) => insideEllipse(a, b, cx, cy, rx, ry)),
    ];
    if (lines.length > 0) out.push({ kind: 'path', path: { ...polygonOf(lines, toScreen), openFill: 'none' }, stroke });
  }
  return out;
}

/** The ring as disjoint convex pieces: the ellipse above the cut, below it, and
 *  left and right of it within its rows. */
function ringPieces(ellipse: Pt[], cut: Cut): Pt[][] {
  const rows = (p: Pt[]) => clip(clip(p, 'y', cut.t, false), 'y', cut.b, true);
  return [
    clip(ellipse, 'y', cut.t, true),
    clip(ellipse, 'y', cut.b, false),
    clip(rows(ellipse), 'x', cut.l, true),
    clip(rows(ellipse), 'x', cut.r, false),
  ].filter((p) => p.length >= 3);
}

/** Sutherland–Hodgman against one half-plane: keeps `p[axis] <= v` when `below`, else `>= v`. */
function clip(poly: Pt[], axis: 'x' | 'y', v: number, below: boolean): Pt[] {
  const inside = (p: Pt) => (below ? p[axis] <= v : p[axis] >= v);
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) out.push(at(a, b, (v - a[axis]) / (b[axis] - a[axis])));
  }
  return out;
}

/** The parts of `a → b` outside the cut rect. */
function outsideCut(a: Pt, b: Pt, cut: Cut): Array<[number, number]> {
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  // Liang–Barsky: the parameter interval inside the rect.
  for (const [p, q] of [[-dx, a.x - cut.l], [dx, cut.r - a.x], [-dy, a.y - cut.t], [dy, cut.b - a.y]] as const) {
    if (p === 0) {
      if (q < 0) return [[0, 1]];
      continue;
    }
    const u = q / p;
    if (p < 0) t0 = Math.max(t0, u);
    else t1 = Math.min(t1, u);
    if (t0 >= t1) return [[0, 1]];
  }
  const keep: Array<[number, number]> = [];
  if (t0 > 0) keep.push([0, t0]);
  if (t1 < 1) keep.push([t1, 1]);
  return keep;
}

/** The part of `a → b` inside the ellipse. */
function insideEllipse(a: Pt, b: Pt, cx: number, cy: number, rx: number, ry: number): Array<[number, number]> {
  const ux = (a.x - cx) / rx, uy = (a.y - cy) / ry;
  const vx = (b.x - a.x) / rx, vy = (b.y - a.y) / ry;
  const A = vx * vx + vy * vy;
  const B = 2 * (ux * vx + uy * vy);
  const C = ux * ux + uy * uy - 1;
  const disc = B * B - 4 * A * C;
  if (A === 0 || disc <= 0) return [];
  const s = Math.sqrt(disc);
  const t0 = Math.max(0, (-B - s) / (2 * A));
  const t1 = Math.min(1, (-B + s) / (2 * A));
  return t1 > t0 ? [[t0, t1]] : [];
}

/** The kept parts of a closed loop as polylines, joined across vertices and
 *  across the loop's own start; the whole loop, closed, when all of it is kept. */
function runsOf(loop: Pt[], keep: Keep): Run[] {
  const runs: Pt[][] = [];
  let cur: Pt[] | null = null;
  let whole = true;
  let startsAtLoopStart = false;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length];
    const kept = keep(a, b);
    if (kept.length !== 1 || kept[0][0] !== 0 || kept[0][1] !== 1) whole = false;
    if (i === 0 && kept.length > 0 && kept[0][0] === 0) startsAtLoopStart = true;
    if (kept.length === 0) {
      if (cur) runs.push(cur);
      cur = null;
    }
    for (const [t0, t1] of kept) {
      const end = at(a, b, t1);
      if (cur && t0 === 0) cur.push(end);
      else {
        if (cur) runs.push(cur);
        cur = [at(a, b, t0), end];
      }
      if (t1 < 1) {
        runs.push(cur);
        cur = null;
      }
    }
  }
  if (whole) return [{ pts: loop.slice(), closed: true }];
  if (cur) {
    if (startsAtLoopStart && runs.length > 0) runs[0] = cur.concat(runs[0].slice(1));
    else runs.push(cur);
  }
  return runs.map((pts) => ({ pts, closed: false }));
}

function at(a: Pt, b: Pt, t: number): Pt {
  if (t === 0) return a;
  if (t === 1) return b;
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function polygonOf(runs: readonly Run[], toScreen: (x: number, y: number) => [number, number]) {
  const cmds: number[] = [];
  const coords: number[] = [];
  for (const run of runs) {
    run.pts.forEach((p, i) => {
      cmds.push(i === 0 ? PATH_M : PATH_L);
      coords.push(...toScreen(p.x, p.y));
    });
    if (run.closed) cmds.push(PATH_Z);
  }
  return {
    kind: 'polygon' as const,
    commands: new Uint8Array(cmds),
    coords: new Float32Array(coords),
    fillRule: 'nonzero' as const,
  };
}
