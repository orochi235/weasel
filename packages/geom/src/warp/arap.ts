/**
 * As-rigid-as-possible deformation of a triangle mesh with pinned vertices.
 * It starts from Igarashi, Moscovich and Hughes's two linear steps (2005): the
 * shape keeping each triangle closest to a turned and scaled copy of itself,
 * then the vertices best agreeing with an unscaled copy of each rest triangle
 * fitted to it. Rounds of the local/global method (Liu et al., 2008) follow,
 * each refitting the copies to the last result and solving again, which takes
 * out more of the stretch and squash the first step left. None of these stops
 * a hard pull from turning triangles over, which runs the outline backwards
 * through the fold; when the rounds leave any, an injective pass (`injective`)
 * rights them with the pins held. Every system depends only on the mesh and
 * which vertices are pinned, so each is factored once per pin set and only
 * re-solved as the pins move.
 */
import { buildPiece, placePiece, rigidRound, similaritySolve, type Piece } from './arapPiece';
import { energyAt, leastOf, nextEps, startingEps, turnedOver, untangleEnergy, untangleRound } from './injective';
import { stepMemory } from './lbfgs';

/** A triangle mesh at rest: interleaved `x, y` vertices and vertex-index triples. */
export interface ArapMesh {
  vertices: Float64Array;
  triangles: Uint32Array;
}

/**
 * A stage of a solve: `similarity` is the first linear step, `rigid` the
 * second, `local-global` each round after them, and `injective` each round
 * of the pass that runs when those leave a triangle turned over. That pass's
 * last step is the result: its pins set exactly, or the local/global result
 * again when the pins cannot be set without a fold.
 */
export type ArapStage = 'similarity' | 'rigid' | 'local-global' | 'injective';

/** A solve's state after one stage: every vertex's position, interleaved `x, y`. */
export interface ArapStep {
  stage: ArapStage;
  /** Which round of its stage, from 1. */
  round: number;
  vertices: Float64Array;
}

/** Options for {@link ArapSolver.solve}. */
export interface ArapSolveOptions {
  /** The most local/global rounds to run after the two linear steps; 0
   *  returns their result alone. Rounds stop early once the mesh settles.
   *  Default {@link ARAP_ROUNDS}. */
  iterations?: number;
  /** The most rounds of the injective pass; 0 skips it. Default
   *  {@link ARAP_INJECTIVE_ROUNDS}. */
  injectiveIterations?: number;
  /** Called with the state after each stage, in order; the last call carries
   *  the result. A step's `vertices` is the caller's to keep. */
  trace?: (step: ArapStep) => void;
}

/** A factored deformation; `solve` takes each pinned vertex's target, as
 *  interleaved `x, y` in pin order, and returns every vertex's position. */
export interface ArapSolver {
  solve(targets: ArrayLike<number>, opts?: ArapSolveOptions): Float64Array;
}

/** The default most local/global rounds per solve. */
export const ARAP_ROUNDS = 5;
/** The default most injective rounds per solve. */
export const ARAP_INJECTIVE_ROUNDS = 100;
/** A round moving no vertex farther than this share of the piece's size ends the rounds. */
const SETTLED = 1e-4;
/** Settled injective rounds in a row that end the pass: one short step of a
 *  limited-memory descent is often followed by a long one. */
const CALM_ROUNDS = 2;

/** The mesh's connected pieces: vertex lists and triangle lists. */
function piecesOf(mesh: ArapMesh): { verts: number[]; tris: number[] }[] {
  const n = mesh.vertices.length >> 1;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const T = mesh.triangles;
  for (let t = 0; t + 2 < T.length; t += 3) {
    parent[find(T[t + 1])] = find(T[t]);
    parent[find(T[t + 2])] = find(T[t]);
  }
  const byRoot = new Map<number, { verts: number[]; tris: number[] }>();
  const used = new Uint8Array(n);
  for (let t = 0; t + 2 < T.length; t += 3) {
    const r = find(T[t]);
    let p = byRoot.get(r);
    if (!p) { p = { verts: [], tris: [] }; byRoot.set(r, p); }
    p.tris.push(t / 3);
    for (let k = 0; k < 3; k++) if (!used[T[t + k]]) { used[T[t + k]] = 1; p.verts.push(T[t + k]); }
  }
  return [...byRoot.values()];
}

/** The farthest any vertex moved between `a` and `b`. */
function largestMove(a: Float64Array, b: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i += 2) m = Math.max(m, Math.hypot(b[i] - a[i], b[i + 1] - a[i + 1]));
  return m;
}

/** The rigid motion best carrying `from` points onto `to` points. */
function rigidFit(from: readonly number[], to: ArrayLike<number>): (x: number, y: number) => [number, number] {
  const k = from.length >> 1;
  let pcx = 0, pcy = 0, qcx = 0, qcy = 0;
  for (let i = 0; i < k; i++) { pcx += from[2 * i]; pcy += from[2 * i + 1]; qcx += to[2 * i]; qcy += to[2 * i + 1]; }
  pcx /= k; pcy /= k; qcx /= k; qcy /= k;
  let dot = 0, cross = 0;
  for (let i = 0; i < k; i++) {
    const px = from[2 * i] - pcx, py = from[2 * i + 1] - pcy;
    const qx = to[2 * i] - qcx, qy = to[2 * i + 1] - qcy;
    dot += px * qx + py * qy; cross += px * qy - py * qx;
  }
  const len = Math.hypot(dot, cross);
  const cos = len === 0 ? 1 : dot / len, sin = len === 0 ? 0 : cross / len;
  return (x, y) => [cos * (x - pcx) - sin * (y - pcy) + qcx, sin * (x - pcx) + cos * (y - pcy) + qcy];
}

/**
 * Factor the deformation of `mesh` with vertices `pinned` held. A piece of
 * the mesh holding two pins or more deforms as rigidly as they allow; one
 * holding a single pin moves with it; one holding none moves rigidly with the
 * pins as a whole.
 */
export function createArapSolver(mesh: ArapMesh, pinned: readonly number[]): ArapSolver {
  const n = mesh.vertices.length >> 1;
  const pinAt = new Map<number, number>();
  pinned.forEach((v, k) => { if (!pinAt.has(v)) pinAt.set(v, k); });
  const local = new Int32Array(n);
  const pinFrom = pinned.flatMap((v) => [mesh.vertices[2 * v], mesh.vertices[2 * v + 1]]);
  const solved: Piece[] = [];
  const carried: { verts: number[]; pin: number }[] = [];
  for (const p of piecesOf(mesh)) {
    const pins = [...new Set(p.verts.filter((v) => pinAt.has(v)).map((v) => pinAt.get(v)!))];
    const piece = pins.length >= 2 ? buildPiece(mesh, p.verts, p.tris, pinAt, local) : null;
    if (piece) solved.push(piece);
    else carried.push({ verts: p.verts, pin: pins.length === 1 ? pins[0] : -1 });
  }
  return {
    solve(targets, opts = {}) {
      const out = Float64Array.from(mesh.vertices);
      const whole = carried.some((c) => c.pin < 0) && pinned.length > 0 ? rigidFit(pinFrom, targets) : null;
      for (const { verts, pin } of carried) {
        for (const v of verts) {
          const x = mesh.vertices[2 * v], y = mesh.vertices[2 * v + 1];
          if (pin >= 0) {
            out[2 * v] = x + targets[2 * pin] - pinFrom[2 * pin];
            out[2 * v + 1] = y + targets[2 * pin + 1] - pinFrom[2 * pin + 1];
          } else if (whole) {
            [out[2 * v], out[2 * v + 1]] = whole(x, y);
          }
        }
      }
      const { trace } = opts;
      const report = (stage: ArapStage, round: number) => trace?.({ stage, round, vertices: Float64Array.from(out) });
      const pos = solved.map((piece) => similaritySolve(piece, targets));
      solved.forEach((piece, k) => placePiece(piece, pos[k], out));
      report('similarity', 1);
      solved.forEach((piece, k) => { pos[k] = rigidRound(piece, targets, pos[k]).pos; placePiece(piece, pos[k], out); });
      report('rigid', 1);
      const rounds = Math.max(0, Math.floor(opts.iterations ?? ARAP_ROUNDS));
      const live = solved.map(() => true);
      for (let r = 1; r <= rounds && live.some(Boolean); r++) {
        solved.forEach((piece, k) => {
          if (!live[k]) return;
          const next = rigidRound(piece, targets, pos[k]).pos;
          live[k] = largestMove(pos[k], next) > SETTLED * piece.size;
          pos[k] = next;
          placePiece(piece, next, out);
        });
        report('local-global', r);
      }
      const injective = Math.max(0, Math.floor(opts.injectiveIterations ?? ARAP_INJECTIVE_ROUNDS));
      const tangled = solved.map((piece, k) => injective > 0 && turnedOver(piece, pos[k]));
      if (tangled.some(Boolean)) {
        const state = solved.map((piece, k) => {
          const eps = tangled[k] ? startingEps(piece, pos[k]) : 0;
          return { pos: pos[k], eps, energy: tangled[k] ? untangleEnergy(piece, pos[k], eps) : 0, live: tangled[k], memory: stepMemory(), calm: 0 };
        });
        let r = 1;
        for (; r <= injective && state.some((s) => s.live); r++) {
          solved.forEach((piece, k) => {
            const s = state[k];
            if (!s.live) return;
            const step = untangleRound(piece, s.pos, s.eps, s.energy, s.memory);
            const settled = step.moved <= SETTLED * piece.size || s.energy - step.energy <= SETTLED * step.energy;
            s.pos = step.pos;
            if (s.eps > 0) {
              s.eps = nextEps(leastOf(step.terms), s.eps, s.energy, step.energy);
              s.energy = energyAt(step.terms, s.eps);
            } else {
              s.energy = step.energy;
              s.calm = settled ? s.calm + 1 : 0;
              s.live = s.calm < CALM_ROUNDS;
            }
            placePiece(piece, s.pos, out);
          });
          report('injective', r);
        }
        // A piece still tangled when the rounds run out keeps the local/global result.
        let fell = false;
        solved.forEach((piece, k) => {
          if (!tangled[k] || !turnedOver(piece, state[k].pos)) return;
          placePiece(piece, pos[k], out);
          fell = true;
        });
        if (fell) report('injective', r);
      }
      return out;
    },
  };
}
