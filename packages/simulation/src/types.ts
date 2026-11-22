import type { ClockHandle } from '@weasel-js/clock';

/**
 * Matches d3-force's node shape exactly so d3-force's bundled forces work
 * without translation, and d3-force-3d's in three dimensions (`z`, `vz`, `fz`).
 * Consumers extend this with additional fields.
 */
export interface SimulationNode {
  x: number;
  y: number;
  /** Read and moved only by a simulation of three `dimensions`, which primes it to 0. */
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Pin x to this value when non-null. The integrator skips x/vx for the node, and a
   *  non-finite pin holds x where it stands. */
  fx?: number | null;
  fy?: number | null;
  fz?: number | null;
  /** Array index, written by `initialize`. Some forces (e.g. forceLink) rely on it. */
  index?: number;
}

/** One axis the integrator moves nodes along: the node fields holding a
 *  node's position, velocity and pin on it. */
export interface SimulationAxis {
  readonly position: 'x' | 'y' | 'z';
  readonly velocity: 'vx' | 'vy' | 'vz';
  readonly pin: 'fx' | 'fy' | 'fz';
}

/** Every axis a simulation can run along, in order: a simulation of `n`
 *  dimensions runs along the first `n`. */
export const SIMULATION_AXES: readonly SimulationAxis[] = Object.freeze([
  { position: 'x', velocity: 'vx', pin: 'fx' },
  { position: 'y', velocity: 'vy', pin: 'fy' },
  { position: 'z', velocity: 'vz', pin: 'fz' },
]);

/** How many of {@link SIMULATION_AXES} a simulation runs along. */
export type SimulationDimensions = 1 | 2 | 3;

/**
 * Force protocol — contract-compatible with d3-force. A force is a function
 * called once per tick with the current alpha; it mutates `vx`/`vy` on nodes.
 * Optional `initialize` lets the force compute setup (link indices, etc.).
 */
export interface SimulationForce<TNode extends SimulationNode = SimulationNode> {
  (alpha: number): void;
  /** `dimensions` is the simulation's, as d3-force-3d passes it. */
  initialize?(nodes: TNode[], random?: () => number, dimensions?: SimulationDimensions): void;
}

/** Options for `useSimulation`: everything {@link SimulationOptions} carries,
 *  plus the loop's own callbacks and clock. */
export interface UseSimulationOptions<TNode extends SimulationNode>
  extends SimulationOptions<TNode> {
  /** Fired after each integration step. */
  onTick?: (nodes: TNode[]) => void;
  /** Fired once when alpha falls below alphaMin and the loop stops, as d3-force's `end` does,
   *  whatever `alphaTarget` is. */
  onEnd?: () => void;
  /** Steps the integrator on this clock rather than a frame loop of its own: once per `step` ms
   *  of its time (the clock's `step`, else 1000/60), so the clock's pause, rate and visibility
   *  gating govern it, and a host's `useClockLoop` syncs it. A run is built up by stepping and
   *  cannot be unwound, so declare the clock `seekable: false`; time it goes back, as on a
   *  `reset`, steps nothing, and the nodes stay where they are. */
  clock?: ClockHandle;

  // Test injection (mirrors useAnimator):
  /** Optional rAF injection. Defaults to window.requestAnimationFrame. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

/**
 * A force simulation over a set of nodes, with no clock of its own.
 *
 * Each tick applies every force and then integrates velocities, scaled by
 * `alpha` — a temperature that decays toward `alphaTarget` so the layout
 * settles. Raise `alphaTarget` to reheat it.
 *
 * Nodes are mutated in place; the simulation holds the array, not a copy.
 * {@link RunningSimulation} adds the frame loop.
 */
export interface Simulation<TNode extends SimulationNode> {
  readonly nodes: TNode[];
  /** How many of {@link SIMULATION_AXES} it moves nodes along. */
  readonly dimensions: SimulationDimensions;

  setNodes(nodes: TNode[]): this;
  setForces(forces: SimulationForce<TNode>[]): this;

  alpha(): number;
  alpha(value: number): this;
  alphaTarget(): number;
  alphaTarget(value: number): this;
  alphaDecay(): number;
  alphaDecay(value: number): this;
  alphaMin(): number;
  alphaMin(value: number): this;
  velocityDecay(): number;
  velocityDecay(value: number): this;

  /** Run the tick body synchronously `iterations` times. Does NOT fire
   *  onTick or onEnd (matches d3-force). */
  tick(iterations?: number): this;

  /** Whether alpha is below alphaMin and `alphaTarget` is too, so it stays there. */
  isSettled(): boolean;
}

/** A {@link Simulation} running on a frame loop. */
export interface RunningSimulation<TNode extends SimulationNode> extends Simulation<TNode> {
  /** Resume the RAF loop, or stepping on the clock. If alpha < alphaMin, reset alpha to 1. */
  restart(): this;
  /** Cancel the RAF loop, or stop stepping on the clock. Does not change alpha. */
  stop(): this;
}

/** What {@link Simulation} needs: the nodes, the forces acting on them,
 *  and the cooling schedule. {@link UseSimulationOptions} adds the loop's. */
export interface SimulationOptions<TNode extends SimulationNode> {
  /** Mutable array of nodes. Kit + forces mutate vx/vy/x/y in place. */
  nodes: TNode[];
  /** Forces applied per tick. Each may implement `initialize` for setup. */
  forces?: SimulationForce<TNode>[];

  /** Initial alpha. Default 1. */
  alpha?: number;
  /** Settle threshold. When alpha drops below it, the loop stops and onEnd fires. Default 0.001. */
  alphaMin?: number;
  /** Per-tick decay rate toward alphaTarget. Default 1 - 0.001^(1/300) ≈ 0.0228. */
  alphaDecay?: number;
  /** Target alpha. Set above alphaMin to keep sim warm (e.g. during drag). Default 0. */
  alphaTarget?: number;
  /** Friction multiplier on velocity per tick: vx *= (1 - velocityDecay). Default 0.4. */
  velocityDecay?: number;
  /** How many of {@link SIMULATION_AXES} the integrator moves nodes along.
   *  Default 2. At 3 it moves `z` too, priming it to 0 where a node has none. */
  dimensions?: SimulationDimensions;
  /** Handed to each force's `initialize`. Default `Math.random`; pass a seeded
   *  source to make a run reproducible. */
  random?: () => number;
}

/** Default alpha decay: such that alpha drops from 1 to alphaMin (0.001) in 300 ticks. */
export const DEFAULT_ALPHA_DECAY = 1 - Math.pow(0.001, 1 / 300);
/** Alpha below which a cooling simulation is considered settled. */
export const DEFAULT_ALPHA_MIN = 0.001;
/** Fraction of velocity shed each tick — friction. Higher settles sooner and
 *  overshoots less. */
export const DEFAULT_VELOCITY_DECAY = 0.4;
