/** The snap resolver: every gesture's snap, in any dimension, as one search
 *  over affine constraints on the move `δ`. */

import { closestOnFlat, flatDim, intersectFlats, solveLeastSquares, type Flat, type Vec } from './flat';

/** A `fallback` candidate holds only the axes no `target` claims. */
export type SnapTier = 'target' | 'fallback';
/** What a probe stands for on the subject; sources match probes by role. */
export type ProbeRole = 'origin' | 'box' | 'geometry' | 'pointer';

/** A point on the subject that should land on a locus. `role` says which
 *  sources may match it. */
export interface SnapProbe {
  id: string;
  at: Vec;
  role: ProbeRole;
}

/** One probe paired with one locus. `M` is the mark payload, opaque here. */
export interface SnapCandidate<M> {
  /** `SnapProbe.id`. */
  probe: string;
  locus: Flat;
  /** One interval per locus dir, in multiples of that dir. A solution
   *  outside it fails the candidate. */
  span?: readonly (readonly [number, number])[];
  source: string;
  /** Stable tiebreak: lower wins when everything else is equal. */
  order: number;
  tier: SnapTier;
  reachPx: number;
  /** When any required candidate exists, the result includes one of them,
   *  whatever its reach. */
  required?: boolean;
  mark?: M;
}

/** One frame's snap: the probes, the input subspace, the raw move, and the candidates. */
export interface SnapProblem<M> {
  probes: readonly SnapProbe[];
  /** `H`, the subspace of δ-space the result stays inside. */
  input: Flat;
  /** The unsnapped move. */
  delta0: Vec;
  candidates: readonly SnapCandidate<M>[];
  /** World to screen pixels. A non-finite result puts that position out of reach. */
  toScreen(world: Vec): Vec;
  /** Candidates kept per probe, nearest first, besides the required ones,
   *  which are all kept. Default 24. */
  poolSize?: number;
  /** World-space tolerance for "on the locus". Default 1e-6. */
  eps?: number;
}

/** The move `resolveSnap` chose and the candidates it meets. */
export interface SnapResolution<M> {
  /** `closestOnFlat(input, delta0)` when nothing snaps. */
  delta: Vec;
  members: readonly SnapCandidate<M>[];
  /** Every in-reach candidate the result meets: the ones whose marks show. */
  satisfied: readonly SnapCandidate<M>[];
  /** How many dimensions of `H` the result pins. */
  codim: number;
}

/** A candidate that can be met on its own: its probe, and `H ∩ C` in δ-space. */
interface Live<M> {
  c: SnapCandidate<M>;
  probe: Vec;
  within: Flat;
  px: number;
}

interface Combo<M> {
  members: Live<M>[];
  flat: Flat;
  dim: number;
  targetFlat: Flat;
  delta: Vec;
  codim: number;
  targetCodim: number;
  px: number;
}

const DEFAULT_POOL = 24;
const DEFAULT_EPS = 1e-6;
/** Screen displacements closer than this rank as equal, so order decides. */
const SAME_PX = 1e-9;

const plus = (a: Vec, b: Vec): Vec => a.map((v, i) => v + b[i]);
const minus = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]);
const isFiniteVec = (a: Vec): boolean => a.every(Number.isFinite);

function distance(a: Vec, b: Vec): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/** What the resolver needs to measure a candidate against a trial δ. */
interface Measure {
  /** Screen pixels the probe moves going from δ0 (projected into `H`) to
   *  `delta`; NaN when either end has no finite screen position. */
  move(probeId: string, probe: Vec, delta: Vec): number;
  eps: number;
}

function makeMeasure<M>(problem: SnapProblem<M>, base: Vec, eps: number): Measure {
  const home = new Map<string, Vec>();
  return {
    eps,
    move(probeId, probe, delta) {
      let h = home.get(probeId);
      if (!h) home.set(probeId, (h = problem.toScreen(plus(probe, base))));
      const d = distance(problem.toScreen(plus(probe, delta)), h);
      return Number.isFinite(d) ? d : NaN;
    },
  };
}

function spanHolds<M>(c: SnapCandidate<M>, world: Vec, eps: number): boolean {
  if (!c.span) return true;
  const u = solveLeastSquares(c.locus.dirs, minus(world, c.locus.at));
  return c.span.every(([lo, hi], i) => u[i] >= lo - eps && u[i] <= hi + eps);
}

/** The probe's screen move under `delta`, or null when it is out of reach or off the span. */
function meets<M>(m: Measure, c: SnapCandidate<M>, probe: Vec, delta: Vec): number | null {
  const measured = m.move(c.probe, probe, delta);
  if (!c.required && (Number.isNaN(measured) || !(measured <= c.reachPx))) return null;
  const px = Number.isNaN(measured) ? Infinity : measured;
  return spanHolds(c, plus(probe, delta), m.eps) ? px : null;
}

function liveCandidates<M>(problem: SnapProblem<M>, m: Measure): Live<M>[] {
  const probes = new Map(problem.probes.map((p) => [p.id, p.at]));
  const live: Live<M>[] = [];
  for (const c of problem.candidates) {
    const probe = probes.get(c.probe);
    if (!probe || !isFiniteVec(probe) || !isFiniteVec(c.locus.at) || !c.locus.dirs.every(isFiniteVec)) continue;
    const within = intersectFlats(problem.input, { at: minus(c.locus.at, probe), dirs: c.locus.dirs }, m.eps);
    if (!within) continue;
    const px = meets(m, c, probe, closestOnFlat(within, problem.delta0));
    if (px !== null) live.push({ c, probe, within, px });
  }
  return live;
}

function pool<M>(live: Live<M>[], size: number): Live<M>[] {
  const byProbe = new Map<string, Live<M>[]>();
  for (const l of live) {
    const list = byProbe.get(l.c.probe) ?? [];
    list.push(l);
    byProbe.set(l.c.probe, list);
  }
  const out: Live<M>[] = [];
  for (const list of byProbe.values()) {
    list.sort((a, b) => (Math.abs(a.px - b.px) > SAME_PX ? a.px - b.px : a.c.order - b.c.order));
    out.push(...list.filter((l, i) => i < size || l.c.required));
  }
  return out;
}

function compareOrders<M>(a: Live<M>[], b: Live<M>[]): number {
  const oa = a.map((l) => l.c.order).sort((x, y) => x - y);
  const ob = b.map((l) => l.c.order).sort((x, y) => x - y);
  for (let i = 0; i < Math.min(oa.length, ob.length); i++) if (oa[i] !== ob[i]) return oa[i] - ob[i];
  return oa.length - ob.length;
}

/** Negative when `a` ranks ahead of `b`. */
function compareCombos<M>(a: Combo<M>, b: Combo<M>): number {
  if (a.codim !== b.codim) return b.codim - a.codim;
  if (a.targetCodim !== b.targetCodim) return b.targetCodim - a.targetCodim;
  if (Math.abs(a.px - b.px) > SAME_PX) return a.px - b.px;
  return compareOrders(a.members, b.members);
}

/** `parent` plus `l`, or null when `l` adds no constraint or breaks a member's reach or span. */
function extend<M>(parent: Combo<M>, l: Live<M>, hDim: number, delta0: Vec, m: Measure): Combo<M> | null {
  const flat = intersectFlats(parent.flat, l.within, m.eps);
  if (!flat) return null;
  const dim = flatDim(flat);
  if (dim >= parent.dim) return null;
  const delta = closestOnFlat(flat, delta0);
  if (!isFiniteVec(delta)) return null;
  const members = [...parent.members, l];
  let px = 0;
  for (const mem of members) {
    const p = meets(m, mem.c, mem.probe, delta);
    if (p === null) return null;
    px = Math.max(px, p);
  }
  const targetFlat = l.c.tier === 'target'
    ? intersectFlats(parent.targetFlat, l.within, m.eps) ?? flat
    : parent.targetFlat;
  return {
    members, flat, dim, targetFlat, delta, px,
    codim: hDim - dim,
    targetCodim: hDim - flatDim(targetFlat),
  };
}

/** The best combination; when any can include a required candidate, the best of those. */
function search<M>(candidates: Live<M>[], root: Combo<M>, delta0: Vec, m: Measure): Combo<M> {
  const best: { any: Combo<M>; required: Combo<M> | null } = { any: root, required: null };
  const consider = (c: Combo<M>) => {
    if (compareCombos(c, best.any) < 0) best.any = c;
    if (c.members.some((l) => l.c.required) && (!best.required || compareCombos(c, best.required) < 0)) {
      best.required = c;
    }
  };
  const visit = (start: number, parent: Combo<M>) => {
    for (let i = start; i < candidates.length; i++) {
      const next = extend(parent, candidates[i], root.dim, delta0, m);
      if (!next) continue;
      consider(next);
      if (next.dim > 0) visit(i + 1, next);
    }
  };
  visit(0, root);
  return best.required ?? best.any;
}

function satisfiedBy<M>(problem: SnapProblem<M>, delta: Vec, m: Measure): SnapCandidate<M>[] {
  const probes = new Map(problem.probes.map((p) => [p.id, p.at]));
  return problem.candidates.filter((c) => {
    const probe = probes.get(c.probe);
    if (!probe) return false;
    const world = plus(probe, delta);
    if (!(distance(closestOnFlat(c.locus, world), world) <= m.eps)) return false;
    return meets(m, c, probe, delta) !== null;
  });
}

/** The move nearest `delta0` within `H` that meets the best-ranked set of
 *  candidates in reach, or `delta0` projected into `H` when none is. */
export function resolveSnap<M>(problem: SnapProblem<M>): SnapResolution<M> {
  const { input, delta0 } = problem;
  let base = closestOnFlat(input, delta0);
  if (!isFiniteVec(base)) base = isFiniteVec(input.at) ? input.at : input.at.map(() => 0);
  const m = makeMeasure(problem, base, problem.eps ?? DEFAULT_EPS);
  const hDim = flatDim(input);
  const root: Combo<M> = {
    members: [], flat: input, dim: hDim, targetFlat: input, delta: base, codim: 0, targetCodim: 0, px: 0,
  };
  const live = pool(liveCandidates(problem, m), problem.poolSize ?? DEFAULT_POOL);
  const win = search(live, root, delta0, m);
  return {
    delta: win.delta,
    members: win.members.map((l) => l.c),
    satisfied: satisfiedBy(problem, win.delta, m),
    codim: win.codim,
  };
}
