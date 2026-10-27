/**
 * The injective pass of an as-rigid-as-possible solve, for a result that left
 * triangles turned over. It descends on the untangling energy of Garanzha et
 * al. ("Foldover-free maps in 50 lines of code", 2021): a distortion measure
 * whose denominator is a softened area, finite for a turned-over triangle while
 * the softening `eps` is above zero and growing without bound as a triangle
 * flattens once it reaches zero. `eps` shrinks round by round as the turned
 * triangles right themselves; once none is left, the pass holds it at zero and
 * a line search that never lets a triangle flatten keeps the map injective.
 * Each step is the energy's gradient carried through the rigid step's edge
 * system, already factored (the quadratic proxy of Kovalsky, Galun and Lipman,
 * 2016), and bent by the curvature the last few steps saw (`lbfgs`), with the
 * pins held where they are, so a round costs about what a local/global round
 * does and the pins land exactly.
 */
import type { Piece } from './arapPiece';
import { descent, dot, forget, type StepMemory } from './lbfgs';

/** Each rest triangle's inverse edge matrix, four entries per triangle, its area, and its winding (+1, -1, or 0 when flat). */
export interface RestFrames {
  inv: Float64Array;
  area: Float64Array;
  side: Int8Array;
}

export function restFrames(rest: Float64Array, tris: Int32Array): RestFrames {
  const nt = tris.length / 3;
  const inv = new Float64Array(4 * nt), area = new Float64Array(nt), side = new Int8Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = tris[3 * t], b = tris[3 * t + 1], c = tris[3 * t + 2];
    const ux = rest[2 * b] - rest[2 * a], uy = rest[2 * b + 1] - rest[2 * a + 1];
    const vx = rest[2 * c] - rest[2 * a], vy = rest[2 * c + 1] - rest[2 * a + 1];
    const det = ux * vy - uy * vx;
    if (det === 0) continue;
    inv.set([vy / det, -vx / det, -uy / det, ux / det], 4 * t);
    area[t] = Math.abs(det) / 2;
    side[t] = Math.sign(det);
  }
  return { inv, area, side };
}

/** The share of the way to the nearest flattening a step may go. */
const FLIP_MARGIN = 0.8;
const ARMIJO = 1e-4;
/** Weight of the area term against the shape term. */
const AREA = 1;

/** Triangle `t`'s Jacobian at `pos`, as `[j11, j12, j21, j22]`, or null when it has no area at rest. */
function jacobian(piece: Piece, pos: Float64Array, t: number, J: Float64Array): boolean {
  const { tris, frames } = piece;
  if (frames.area[t] === 0) return false;
  const a = tris[3 * t], b = tris[3 * t + 1], c = tris[3 * t + 2];
  const ux = pos[2 * b] - pos[2 * a], uy = pos[2 * b + 1] - pos[2 * a + 1];
  const vx = pos[2 * c] - pos[2 * a], vy = pos[2 * c + 1] - pos[2 * a + 1];
  const m = frames.inv;
  const i = 4 * t;
  J[0] = ux * m[i] + vx * m[i + 2]; J[1] = ux * m[i + 1] + vx * m[i + 3];
  J[2] = uy * m[i] + vy * m[i + 2]; J[3] = uy * m[i + 1] + vy * m[i + 3];
  return true;
}

/** How far along `d` from `pos` the first triangle flattens, or Infinity when none does. */
export function flipBound(piece: Piece, pos: Float64Array, d: Float64Array): number {
  const { tris, frames } = piece;
  let bound = Infinity;
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    const side = frames.side[t / 3];
    if (side === 0) continue;
    const ux = pos[2 * b] - pos[2 * a], uy = pos[2 * b + 1] - pos[2 * a + 1];
    const vx = pos[2 * c] - pos[2 * a], vy = pos[2 * c + 1] - pos[2 * a + 1];
    const dux = d[2 * b] - d[2 * a], duy = d[2 * b + 1] - d[2 * a + 1];
    const dvx = d[2 * c] - d[2 * a], dvy = d[2 * c + 1] - d[2 * a + 1];
    // side * det(u + s du, v + s dv) = c0 + c1 s + c2 s²
    const c0 = side * (ux * vy - uy * vx);
    const c1 = side * (ux * dvy - uy * dvx + dux * vy - duy * vx);
    const c2 = side * (dux * dvy - duy * dvx);
    if (c0 <= 0) return 0;
    bound = Math.min(bound, smallestPositiveRoot(c0, c1, c2));
  }
  return bound;
}

function smallestPositiveRoot(c0: number, c1: number, c2: number): number {
  if (Math.abs(c2) < 1e-14 * (Math.abs(c1) + Math.abs(c0))) return c1 < 0 ? -c0 / c1 : Infinity;
  const disc = c1 * c1 - 4 * c2 * c0;
  if (disc < 0) return Infinity;
  const q = -0.5 * (c1 + Math.sign(c1 || 1) * Math.sqrt(disc));
  const r1 = q / c2, r2 = c0 / q;
  let least = Infinity;
  if (r1 > 0 && r1 < least) least = r1;
  if (r2 > 0 && r2 < least) least = r2;
  return least;
}

/** The softened area: `d` itself well above `eps`, small and positive below zero. */
const chi = (d: number, eps: number) => (d + Math.sqrt(eps * eps + d * d)) / 2;

/**
 * Each triangle's share of the untangling energy before the softened area
 * divides it, and its Jacobian determinant: enough to read the energy again
 * at another softening, and the least area, without another pass.
 */
export interface EnergyTerms {
  shape: Float64Array;
  det: Float64Array;
}

export function energyTerms(piece: Piece): EnergyTerms {
  const n = piece.frames.area.length;
  return { shape: new Float64Array(n), det: new Float64Array(n).fill(Infinity) };
}

/**
 * The untangling energy at `pos`; at `eps` 0, infinite once a triangle has
 * turned over or flattened. With `terms`, each triangle's terms are recorded
 * there too; an infinite energy leaves them partly written.
 */
export function untangleEnergy(piece: Piece, pos: Float64Array, eps: number, terms?: EnergyTerms): number {
  const { tris, frames: { area, inv: m } } = piece;
  let E = 0;
  for (let t = 0; t < area.length; t++) {
    if (area[t] === 0) continue;
    const a = tris[3 * t], b = tris[3 * t + 1], cc = tris[3 * t + 2], i = 4 * t;
    const ux = pos[2 * b] - pos[2 * a], uy = pos[2 * b + 1] - pos[2 * a + 1];
    const vx = pos[2 * cc] - pos[2 * a], vy = pos[2 * cc + 1] - pos[2 * a + 1];
    const j0 = ux * m[i] + vx * m[i + 2], j1 = ux * m[i + 1] + vx * m[i + 3];
    const j2 = uy * m[i] + vy * m[i + 2], j3 = uy * m[i + 1] + vy * m[i + 3];
    const d = j0 * j3 - j1 * j2;
    const c = chi(d, eps);
    if (!(c > 0)) return Infinity;
    const shape = area[t] * (j0 * j0 + j1 * j1 + j2 * j2 + j3 * j3 + AREA * (d * d + 1));
    if (terms) { terms.shape[t] = shape; terms.det[t] = d; }
    E += shape / c;
  }
  return E;
}

/** The energy `terms` were recorded for, read at softening `eps`. */
export function energyAt(terms: EnergyTerms, eps: number): number {
  let E = 0;
  for (let t = 0; t < terms.shape.length; t++) if (terms.shape[t] > 0) E += terms.shape[t] / chi(terms.det[t], eps);
  return E;
}

/** The untangling energy of the piece at rest, or moved rigidly: the least it can take at `eps` 0. */
export function restEnergy(piece: Piece): number {
  let E = 0;
  for (const a of piece.frames.area) E += a * (2 + 2 * AREA);
  return E;
}

/** The smallest determinant among `terms`. */
export function leastOf(terms: EnergyTerms): number {
  let least = Infinity;
  for (let t = 0; t < terms.det.length; t++) if (terms.det[t] < least) least = terms.det[t];
  return least;
}

/** The smallest Jacobian determinant over the piece's triangles at `pos`: below zero where one has turned over. */
export function leastArea(piece: Piece, pos: Float64Array): number {
  const J = new Float64Array(4);
  let least = Infinity;
  for (let t = 0; t < piece.frames.area.length; t++) {
    if (jacobian(piece, pos, t, J)) least = Math.min(least, J[0] * J[3] - J[1] * J[2]);
  }
  return least;
}

function gradient(piece: Piece, pos: Float64Array, eps: number): Float64Array {
  const { tris, frames: { area, inv: m } } = piece;
  const g = new Float64Array(pos.length);
  for (let t = 0; t < area.length; t++) {
    if (area[t] === 0) continue;
    const a = tris[3 * t], b = tris[3 * t + 1], cc = tris[3 * t + 2], i = 4 * t;
    const ux = pos[2 * b] - pos[2 * a], uy = pos[2 * b + 1] - pos[2 * a + 1];
    const vx = pos[2 * cc] - pos[2 * a], vy = pos[2 * cc + 1] - pos[2 * a + 1];
    const j0 = ux * m[i] + vx * m[i + 2], j1 = ux * m[i + 1] + vx * m[i + 3];
    const j2 = uy * m[i] + vy * m[i + 2], j3 = uy * m[i + 1] + vy * m[i + 3];
    const d = j0 * j3 - j1 * j2;
    const root = Math.sqrt(eps * eps + d * d);
    const c = (d + root) / 2;
    const A = area[t];
    const top = j0 * j0 + j1 * j1 + j2 * j2 + j3 * j3 + AREA * (d * d + 1);
    const dc = root === 0 ? 0.5 : (1 + d / root) / 2;
    // dE/dJ = (2 J + 2 AREA d cof J) / c - top dc cof J / c², cof J being d's own gradient.
    const s = (2 * A) / c, r = A * ((2 * AREA * d) / c - (top * dc) / (c * c));
    const g0 = s * j0 + r * j3, g1 = s * j1 - r * j2, g2 = s * j2 - r * j1, g3 = s * j3 + r * j0;
    const gux = g0 * m[i] + g1 * m[i + 1], gvx = g0 * m[i + 2] + g1 * m[i + 3];
    const guy = g2 * m[i] + g3 * m[i + 1], gvy = g2 * m[i + 2] + g3 * m[i + 3];
    g[2 * b] += gux; g[2 * b + 1] += guy; g[2 * cc] += gvx; g[2 * cc + 1] += gvy;
    g[2 * a] -= gux + gvx; g[2 * a + 1] -= guy + gvy;
  }
  return g;
}

/** Whether any triangle at `pos` has turned over or flattened against its rest orientation. */
export function turnedOver(piece: Piece, pos: Float64Array): boolean {
  return flipBound(piece, pos, new Float64Array(pos.length)) === 0;
}

/** The softening to start untangling `pos` with. */
export function startingEps(piece: Piece, pos: Float64Array): number {
  return Math.max(1e-3, 2 * Math.abs(Math.min(0, leastArea(piece, pos))));
}

/** The least share a round shrinks the softening by while a triangle is turned over, and once none is. */
const SHRINK_TURNED = 0.2;
const SHRINK_CLEAR = 0.05;

/**
 * The softening for the next round, after a round took the energy from
 * `before` to `after` (both at `eps`) and left `least` the smallest
 * determinant: small enough that it keeps pressing a
 * turned triangle towards positive area, never below zero, and zero once
 * every triangle has some. It shrinks fast while a triangle is turned over and
 * slowly after: a softening dropped soon after the last one rights itself
 * leaves the descent stepping short of some nearly flat triangle.
 */
export function nextEps(least: number, eps: number, before: number, after: number): number {
  const sigma = Math.max(1 - after / before, least > 0 ? SHRINK_CLEAR : SHRINK_TURNED);
  const mu = (1 - sigma) * chi(least, eps);
  return least < mu ? 2 * Math.sqrt(mu * (mu - least)) : 0;
}

/**
 * One round of descent from `pos` at softening `eps`, the pins held, along
 * the limited-memory BFGS direction `memory` builds over the edge system:
 * the preconditioned gradient alone crawls, taking each round a step a
 * barely squeezed triangle allows and no farther. At `eps` 0 the step stops
 * short of flattening any triangle. Returns the new positions, their energy
 * at `eps` and its terms, and the farthest any vertex moved.
 */
export function untangleRound(
  piece: Piece, pos: Float64Array, eps: number, energy: number, memory: StepMemory,
): { pos: Float64Array; energy: number; terms: EnergyTerms; moved: number } {
  const { pinOf, freeOf, step2 } = piece;
  const terms = energyTerms(piece);
  const g = gradient(piece, pos, eps);
  const nf = step2.coupling.length;
  const gf = new Float64Array(2 * nf);
  for (let i = 0; i < pinOf.length; i++) {
    const f = freeOf[i];
    if (f >= 0) { gf[2 * f] = g[2 * i]; gf[2 * f + 1] = g[2 * i + 1]; }
  }
  const precondition = (q: Float64Array) => step2.factored.solvePair(q);
  // At eps 0 the edge system alone overstates a step about twice over, and the line search halved nearly every one.
  let df = descent(memory, gf, precondition, eps === 0);
  let slope = dot(gf, df);
  if (!(slope < 0)) {
    forget(memory);
    df = memory.lastBent!.map((v) => -v);
    slope = dot(gf, df);
  }
  const d = new Float64Array(pos.length);
  for (let i = 0; i < pinOf.length; i++) {
    const f = freeOf[i];
    if (f >= 0) { d[2 * i] = df[2 * f]; d[2 * i + 1] = df[2 * f + 1]; }
  }
  let s = eps > 0 ? 1 : Math.min(1, FLIP_MARGIN * flipBound(piece, pos, d));
  const next = new Float64Array(pos.length);
  for (; s > 1e-12; s /= 2) {
    for (let i = 0; i < next.length; i++) next[i] = pos[i] + s * d[i];
    const e = untangleEnergy(piece, next, eps, terms);
    if (e <= energy + ARMIJO * s * slope) {
      let far = 0;
      for (let i = 0; i < d.length; i += 2) far = Math.max(far, d[i] * d[i] + d[i + 1] * d[i + 1]);
      const moved = s * Math.sqrt(far);
      memory.lastGrad = gf;
      memory.lastStep = df.map((v) => s * v);
      return { pos: next, energy: e, terms, moved };
    }
  }
  forget(memory);
  untangleEnergy(piece, pos, eps, terms);
  return { pos, energy, terms, moved: 0 };
}
