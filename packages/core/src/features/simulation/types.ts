/**
 * Minimal node interface for the simulation primitive. Matches d3-force's
 * node shape exactly so d3-force's bundled forces work without translation.
 *
 * Consumers extend this with arbitrary additional fields (id, label, etc.).
 */
export interface SimulationNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** Pin x to this value when non-null. The integrator skips x/vx for the node. */
  fx?: number | null;
  fy?: number | null;
  /** Array index, written by `initialize`. Some forces (e.g. forceLink) rely on it. */
  index?: number;
}

/**
 * Force protocol — contract-compatible with d3-force. A force is a function
 * called once per tick with the current alpha; it mutates `vx`/`vy` on nodes.
 * Optional `initialize` lets the force compute setup (link indices, etc.).
 */
export interface SimulationForce<TNode extends SimulationNode = SimulationNode> {
  (alpha: number): void;
  initialize?(nodes: TNode[], random?: () => number): void;
}

/** Options for `useSimulation`: the nodes to move, the forces acting on them,
 *  and the cooling schedule that decides when the simulation settles. */
export interface UseSimulationOptions<TNode extends SimulationNode> {
  /** Mutable array of nodes. Kit + forces mutate vx/vy/x/y in place. */
  nodes: TNode[];
  /** Forces applied per tick. Each may implement `initialize` for setup. */
  forces?: SimulationForce<TNode>[];

  /** Initial alpha. Default 1. */
  alpha?: number;
  /** Settle threshold. When alpha drops below and alphaTarget is 0, onEnd fires. Default 0.001. */
  alphaMin?: number;
  /** Per-tick decay rate toward alphaTarget. Default 1 - 0.001^(1/300) ≈ 0.0228. */
  alphaDecay?: number;
  /** Target alpha. Set above alphaMin to keep sim warm (e.g. during drag). Default 0. */
  alphaTarget?: number;
  /** Friction multiplier on velocity per tick: vx *= (1 - velocityDecay). Default 0.4. */
  velocityDecay?: number;

  /** Fired after each integration step. */
  onTick?: (nodes: TNode[]) => void;
  /** Fired once when the sim settles (alpha < alphaMin && alphaTarget === 0). */
  onEnd?: () => void;

  // Test injection (mirrors useAnimator):
  /** Optional rAF injection. Defaults to window.requestAnimationFrame. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

/**
 * A running force simulation over a set of nodes.
 *
 * Each tick applies every force and then integrates velocities, scaled by
 * `alpha` — a temperature that decays toward `alphaTarget` so the layout
 * settles instead of jittering forever. Raise `alphaTarget` to reheat it,
 * which is what a drag does.
 *
 * Nodes are mutated in place; the simulation holds the array, not a copy.
 */
export interface Simulation<TNode extends SimulationNode> {
  readonly nodes: TNode[];

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

  /** Resume the RAF loop. If alpha < alphaMin, reset alpha to 1. */
  restart(): this;
  /** Cancel the RAF loop. Does not change alpha. */
  stop(): this;
  /**
   * Run the tick body synchronously `iterations` times. Does NOT fire
   * onTick or onEnd (matches d3-force). Used for offscreen pre-warm and tests.
   */
  tick(iterations?: number): this;

  isSettled(): boolean;
}

/** Default alpha decay: such that alpha drops from 1 to alphaMin (0.001) in 300 ticks. */
export const DEFAULT_ALPHA_DECAY = 1 - Math.pow(0.001, 1 / 300);
/** Alpha below which a cooling simulation is considered settled. */
export const DEFAULT_ALPHA_MIN = 0.001;
/** Fraction of velocity shed each tick — friction. Higher settles sooner and
 *  overshoots less. */
export const DEFAULT_VELOCITY_DECAY = 0.4;
