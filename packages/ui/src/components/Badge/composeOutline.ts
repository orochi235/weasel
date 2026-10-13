import type { BaseSampler } from './bases/types';
import { EFFECTS, type BadgeEffectSpec } from './effects';

const SAMPLES = 600;
/** CSS px. */
const GRAZE = 0.05;

interface Box { w: number; h: number }

function closedPath(at: (sCss: number) => { x: number; y: number }, totalCss: number): string {
  let d = '';
  for (let i = 0; i < SAMPLES; i++) {
    const p = at((i / SAMPLES) * totalCss);
    d += `${i === 0 ? 'M' : ' L'} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`;
  }
  return `${d} Z`;
}

/**
 * Where `bloat` and every perimeter-warping effect move the point of `base` at arc length
 * `s`, in CSS px, with the point itself. Each effect's offset is summed, so stacked effects
 * compose additively. Null when nothing moves the outline.
 */
function displacer(base: BaseSampler, effects: readonly BadgeEffectSpec[] | undefined, bloatCss: number, phase: number) {
  const offsetMods = (effects ?? []).flatMap((eff) => {
    const mod = EFFECTS[eff.type];
    if (!mod?.offsetAt) return [];
    return [{ offsetAt: mod.offsetAt, params: { ...(mod.defaults ?? {}), ...(eff.params ?? {}) } }];
  });
  if (offsetMods.length === 0 && bloatCss === 0) return null;
  const totalCss = base.totalCss;
  return (sm: number) => {
    const pt = base.perimeterAt(sm);
    let dx = pt.nx * bloatCss;
    let dy = pt.ny * bloatCss;
    for (const m of offsetMods) {
      const o = m.offsetAt(sm, { params: m.params, phase, totalCss, perimeterAt: base.perimeterAt });
      dx += o.dx;
      dy += o.dy;
    }
    return { pt, dx, dy };
  };
}

/** Whether `(x, y)` lies inside the closed polygon through `ring`. */
function inside(ring: readonly { x: number; y: number }[], x: number, y: number): boolean {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) within = !within;
  }
  return within;
}

/**
 * How far, in CSS px, `bloat` and the effects move any point of `base`'s outline that they
 * move into `base`'s own inside: the clearance content needs from `base` to stay inside the
 * composed outline. A point moved outward counts too when it lands inside, as one does that
 * crosses a notch narrower than the distance it moves.
 */
export function inwardReach(base: BaseSampler, effects: readonly BadgeEffectSpec[] | undefined, bloatCss: number, box: Box): number {
  const moved = displacer(base, effects, bloatCss, 0);
  if (!moved) return 0;
  const sx = 100 / box.w;
  const sy = 100 / box.h;
  const samples = Array.from({ length: SAMPLES }, (_, i) => moved((i / SAMPLES) * base.totalCss));
  const ring = samples.map((sample) => sample.pt);
  let reach = 0;
  for (const { pt, dx, dy } of samples) {
    const far = Math.hypot(dx, dy);
    if (far <= reach) continue;
    // Tested a hair outward, so a point slid along its own edge does not read as inside.
    const lx = pt.x + (dx + pt.nx * GRAZE) * sx;
    const ly = pt.y + (dy + pt.ny * GRAZE) * sy;
    if (dx * pt.nx + dy * pt.ny < 0 || inside(ring, lx, ly)) reach = far;
  }
  return reach;
}

/** The base outline with `bloat` and every perimeter-warping effect applied. */
export function composeOutline(
  base: BaseSampler,
  effects: readonly BadgeEffectSpec[] | undefined,
  bloatCss: number,
  box: Box,
  phase: number,
): BaseSampler {
  const moved = displacer(base, effects, bloatCss, phase);
  if (!moved) return base;
  const sx = 100 / box.w;
  const sy = 100 / box.h;
  const totalCss = base.totalCss;
  const warpedXY = (sCss: number) => {
    const { pt, dx, dy } = moved(((sCss % totalCss) + totalCss) % totalCss);
    return { x: pt.x + dx * sx, y: pt.y + dy * sy };
  };
  // The normal is recomputed from the warped tangent, so decorations follow the
  // actual bumpy outline.
  const perimeterAt = (s: number) => {
    const sm = ((s % totalCss) + totalCss) % totalCss;
    const pt = warpedXY(sm);
    const eps = totalCss / (SAMPLES * 2);
    const wA = warpedXY(sm - eps);
    const wB = warpedXY(sm + eps);
    // Convert finite-difference tangent back to "CSS px" by un-scaling per-axis.
    const tx = (wB.x - wA.x) / sx;
    const ty = (wB.y - wA.y) / sy;
    const tl = Math.hypot(tx, ty) || 1;
    // Outward normal: clockwise rotation of tangent, in CSS space. Call sites multiply nx/ny
    // by sx/sy, the convention base perimeters use.
    return { x: pt.x, y: pt.y, nx: ty / tl, ny: -tx / tl };
  };
  return { bodyPath: closedPath(warpedXY, totalCss), perimeterAt, totalCss };
}

/** `outline` pushed `offsetCss` px outward along its normals: the path a focus ring follows. */
export function offsetOutline(outline: BaseSampler, offsetCss: number, box: Box): string {
  const sx = 100 / box.w;
  const sy = 100 / box.h;
  return closedPath((s) => {
    const pt = outline.perimeterAt(s);
    return { x: pt.x + pt.nx * offsetCss * sx, y: pt.y + pt.ny * offsetCss * sy };
  }, outline.totalCss);
}
