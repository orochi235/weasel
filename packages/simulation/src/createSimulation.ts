/**
 * The integrator, with no clock attached.
 *
 * Velocity-Verlet over a pluggable force list, contract-compatible with
 * d3-force so d3's own bundled forces drop in untranslated. Nothing here
 * advances time: `tick()` is the only thing that moves a node, and the caller
 * decides how often to call it.
 */
import {
  DEFAULT_ALPHA_DECAY,
  DEFAULT_ALPHA_MIN,
  DEFAULT_VELOCITY_DECAY,
  SIMULATION_AXES,
  type Simulation,
  type SimulationDimensions,
  type SimulationForce,
  type SimulationNode,
  type SimulationOptions,
} from './types';
import { lerp } from '@weasel-js/geom';

/** A node's position, velocity and pin fields, read by axis. */
type Fields = Partial<Record<'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz' | 'fx' | 'fy' | 'fz', number | null>>;

/** A non-finite velocity or position — force overflow, or two nodes exactly
 *  coincident — would reach the renderer as geometry and cost pathological
 *  tessellation work without throwing anywhere, so it becomes 0. */
function finiteOr0(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** `value`, or a `RangeError` naming `what` when it is not a finite number. */
function finite(what: string, value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`a simulation's ${what} is a finite number, not ${value}`);
  return value;
}

/** Move each node along the first `dimensions` axes by its velocity, shed by
 *  `friction`, holding a pinned axis at its pin. */
function integrate(nodes: readonly SimulationNode[], dimensions: SimulationDimensions, friction: number): void {
  // Unrolled over the axes rather than looped by field name: keyed reads here
  // cost a 300-node force layout 7% of its run (2026-11-21).
  for (const n of nodes) {
    if (n.fx == null) {
      const v = finiteOr0((n.vx ?? 0) * friction);
      n.vx = v;
      n.x = finiteOr0(n.x + v);
    } else {
      if (Number.isFinite(n.fx)) n.x = n.fx;
      n.vx = 0;
    }
    if (dimensions === 1) continue;
    if (n.fy == null) {
      const v = finiteOr0((n.vy ?? 0) * friction);
      n.vy = v;
      n.y = finiteOr0(n.y + v);
    } else {
      if (Number.isFinite(n.fy)) n.y = n.fy;
      n.vy = 0;
    }
    if (dimensions === 2) continue;
    if (n.fz == null) {
      const v = finiteOr0((n.vz ?? 0) * friction);
      n.vz = v;
      n.z = finiteOr0(n.z! + v);
    } else {
      if (Number.isFinite(n.fz)) n.z = n.fz;
      n.vz = 0;
    }
  }
}

/**
 * A d3-force-compatible simulation with no clock: nothing moves until `tick()`.
 * Nodes are mutated in place, and primed with `index` and a velocity per axis on creation.
 * A rate, threshold or tick count that is not a finite number throws a `RangeError`, and so
 * does a `dimensions` that is not 1, 2 or 3.
 */
export function createSimulation<TNode extends SimulationNode>(
  opts: SimulationOptions<TNode>,
): Simulation<TNode> {
  let nodes = opts.nodes;
  let forces = opts.forces ?? [];
  let alpha = finite('alpha', opts.alpha ?? 1);
  let alphaMin = finite('alphaMin', opts.alphaMin ?? DEFAULT_ALPHA_MIN);
  let alphaDecay = finite('alphaDecay', opts.alphaDecay ?? DEFAULT_ALPHA_DECAY);
  let alphaTarget = finite('alphaTarget', opts.alphaTarget ?? 0);
  let velocityDecay = finite('velocityDecay', opts.velocityDecay ?? DEFAULT_VELOCITY_DECAY);
  const random = opts.random ?? Math.random;
  const dimensions = opts.dimensions ?? 2;
  if (dimensions !== 1 && dimensions !== 2 && dimensions !== 3) {
    throw new RangeError(`a simulation's dimensions are 1, 2 or 3, not ${String(dimensions)}`);
  }
  const axes = SIMULATION_AXES.slice(0, dimensions);

  /** `index` is what `forceLink` and friends address nodes by, and a d3 force
   *  does `n.vx += …` without checking, so both must exist before the first
   *  tick or the first tick produces NaN. */
  function prime(list: TNode[]): void {
    list.forEach((n, i) => {
      n.index = i;
      const fields = n as Fields;
      for (const a of axes) {
        if (fields[a.position] == null) fields[a.position] = 0;
        if (fields[a.velocity] == null) fields[a.velocity] = 0;
      }
    });
  }

  prime(nodes);
  for (const f of forces) f.initialize?.(nodes, random, dimensions);

  function step(): void {
    // Decay toward the target never overshoots it, and stays finite between finite ends.
    const decay = alphaDecay > 1 ? 1 : alphaDecay > 0 ? alphaDecay : 0;
    const next = lerp(alpha, alphaTarget, decay);
    alpha = Math.sign(next - alphaTarget) === -Math.sign(alpha - alphaTarget) ? alphaTarget : next;
    for (const f of forces) f(alpha);

    integrate(nodes, dimensions, 1 - velocityDecay);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const core: any = {
    get nodes() {
      return nodes;
    },
    dimensions,
    setNodes(next: TNode[]) {
      nodes = next;
      prime(nodes);
      for (const f of forces) f.initialize?.(nodes, random, dimensions);
      return core;
    },
    setForces(next: SimulationForce<TNode>[]) {
      const old = forces;
      forces = next;
      for (const f of next) {
        if (!old.includes(f)) f.initialize?.(nodes, random, dimensions);
      }
      return core;
    },
    alpha(value?: number) {
      if (value === undefined) return alpha;
      alpha = finite('alpha', value);
      return core;
    },
    alphaTarget(value?: number) {
      if (value === undefined) return alphaTarget;
      alphaTarget = finite('alphaTarget', value);
      return core;
    },
    alphaDecay(value?: number) {
      if (value === undefined) return alphaDecay;
      alphaDecay = finite('alphaDecay', value);
      return core;
    },
    alphaMin(value?: number) {
      if (value === undefined) return alphaMin;
      alphaMin = finite('alphaMin', value);
      return core;
    },
    velocityDecay(value?: number) {
      if (value === undefined) return velocityDecay;
      velocityDecay = finite('velocityDecay', value);
      return core;
    },
    tick(iterations: number = 1) {
      const n = finite('tick count', iterations);
      for (let i = 0; i < n; i++) step();
      return core;
    },
    isSettled() {
      // Where the loop stops, and alpha cannot climb back over alphaMin by itself.
      return alpha < alphaMin && alphaTarget < alphaMin;
    },
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return core as Simulation<TNode>;
}
