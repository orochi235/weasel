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
  type SimulationCore,
  type SimulationForce,
  type SimulationNode,
  type SimulationOptions,
} from './types';

/** `value`, or a `RangeError` naming `what` when it is not a finite number. */
function finite(what: string, value: number): number {
  if (!Number.isFinite(value)) throw new RangeError(`a simulation's ${what} is a finite number, not ${value}`);
  return value;
}

/**
 * A d3-force-compatible simulation with no clock: nothing moves until `tick()`.
 * Nodes are mutated in place, and primed with `index`, `vx` and `vy` on creation.
 * A rate, threshold or tick count that is not a finite number throws a `RangeError`.
 */
export function createSimulation<TNode extends SimulationNode>(
  opts: SimulationOptions<TNode>,
): SimulationCore<TNode> {
  let nodes = opts.nodes;
  let forces = opts.forces ?? [];
  let alpha = finite('alpha', opts.alpha ?? 1);
  let alphaMin = finite('alphaMin', opts.alphaMin ?? DEFAULT_ALPHA_MIN);
  let alphaDecay = finite('alphaDecay', opts.alphaDecay ?? DEFAULT_ALPHA_DECAY);
  let alphaTarget = finite('alphaTarget', opts.alphaTarget ?? 0);
  let velocityDecay = finite('velocityDecay', opts.velocityDecay ?? DEFAULT_VELOCITY_DECAY);
  const random = opts.random ?? Math.random;

  /** `index` is what `forceLink` and friends address nodes by, and a d3 force
   *  does `n.vx += …` without checking, so both must exist before the first
   *  tick or the first tick produces NaN. */
  function prime(list: TNode[]): void {
    list.forEach((n, i) => {
      n.index = i;
      if (n.vx == null) n.vx = 0;
      if (n.vy == null) n.vy = 0;
    });
  }

  prime(nodes);
  for (const f of forces) f.initialize?.(nodes, random);

  function step(): void {
    // Decay toward the target never overshoots it, and stays finite between finite ends.
    const decay = alphaDecay > 1 ? 1 : alphaDecay > 0 ? alphaDecay : 0;
    let next = alpha + (alphaTarget - alpha) * decay;
    if (!Number.isFinite(next)) next = alpha * (1 - decay) + alphaTarget * decay;
    alpha = Math.sign(next - alphaTarget) === -Math.sign(alpha - alphaTarget) ? alphaTarget : next;
    for (const f of forces) f(alpha);

    const friction = 1 - velocityDecay;
    for (const n of nodes) {
      if (n.fx == null) {
        n.vx = (n.vx ?? 0) * friction;
        // A non-finite velocity — force overflow, or two nodes exactly
        // coincident — would reach the renderer as geometry and cost
        // pathological tessellation work without throwing anywhere.
        if (!Number.isFinite(n.vx)) n.vx = 0;
        n.x += n.vx;
        if (!Number.isFinite(n.x)) n.x = 0;
      } else {
        n.x = n.fx;
        n.vx = 0;
      }
      if (n.fy == null) {
        n.vy = (n.vy ?? 0) * friction;
        if (!Number.isFinite(n.vy)) n.vy = 0;
        n.y += n.vy;
        if (!Number.isFinite(n.y)) n.y = 0;
      } else {
        n.y = n.fy;
        n.vy = 0;
      }
    }
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const core: any = {
    get nodes() {
      return nodes;
    },
    setNodes(next: TNode[]) {
      nodes = next;
      prime(nodes);
      for (const f of forces) f.initialize?.(nodes, random);
      return core;
    },
    setForces(next: SimulationForce<TNode>[]) {
      const old = forces;
      forces = next;
      for (const f of next) {
        if (!old.includes(f)) f.initialize?.(nodes, random);
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
  return core as SimulationCore<TNode>;
}
