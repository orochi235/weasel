import { useLayoutEffect, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { createSimulation } from './createSimulation';
import { useSteps } from './useSteps';
import {
  type Simulation,
  type SimulationCore,
  type SimulationForce,
  type SimulationNode,
  type UseSimulationOptions,
} from './types';

/**
 * Continuous N-body simulation primitive: `createSimulation`'s integrator on a
 * frame loop, or on `opts.clock`.
 *
 * The kit is adapter-agnostic — `onTick(nodes)` fires after each integration
 * step and the consumer decides how (and whether) to write through to scene
 * state. Per-tick history bypass and settle-commit semantics are consumer
 * concerns; the kit doesn't have an opinion.
 *
 * The nodes, forces and cooling options are read once, at mount; a later render's
 * values are ignored, so change a running simulation through the handle
 * (`setForces`, `alphaTarget(…)`). `onTick`, `onEnd` and `clock` are read live.
 */
export function useSimulation<TNode extends SimulationNode>(
  opts: UseSimulationOptions<TNode>,
): Simulation<TNode> {
  const optsRef = useLatest(opts);

  const coreRef = useRef<SimulationCore<TNode> | null>(null);
  coreRef.current ??= createSimulation(opts);
  const core = coreRef.current;

  /** Whether onEnd has fired since the last energization (restart / alpha set / target raise). */
  const endedRef = useRef(false);
  const mountedRef = useRef(true);
  /** Whether the loop should be stepping: false once settled or stopped, until `restart`. A
   *  new clock carries this over rather than starting a simulation that was left stopped. */
  const runningRef = useRef(true);

  /** One integration step; false once there is no next, settled or unmounted. */
  const step = (): boolean => {
    if (!mountedRef.current) return false;

    core.tick();
    optsRef.current.onTick?.(core.nodes);

    if (core.alpha() < core.alphaMin()) {
      runningRef.current = false;
      if (!endedRef.current) {
        endedRef.current = true;
        optsRef.current.onEnd?.();
      }
      return false;
    }
    return true;
  };

  const steps = useSteps(opts, () => step());
  // The handle below is made once, and a new clock makes new steps.
  const stepsRef = useLatest(steps);

  const startRaf = (): void => {
    if (!mountedRef.current) return;
    runningRef.current = true;
    stepsRef.current.start();
  };

  // Starts on every mount, StrictMode's simulated remount included, and in a
  // layout effect so a host's own layout effects can already `stop()` it.
  // `createSimulation` has already primed the nodes.
  useLayoutEffect(() => {
    mountedRef.current = true;
    if (runningRef.current) steps.start();
    return () => {
      mountedRef.current = false;
      steps.stop();
    };
  }, [steps]);

  // Stable handle. All methods read through the core, so a fixed identity is safe.
  const handle = useMemo<Simulation<TNode>>(() => simulationHandle(core, {
    rearm: () => { endedRef.current = false; },
    start: startRaf,
    stop: () => {
      runningRef.current = false;
      stepsRef.current.stop();
    },
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);

  return handle;
}

/** What {@link simulationHandle} drives besides the core: re-arming `onEnd`, and the loop. */
interface HandleLoop {
  rearm(): void;
  start(): void;
  stop(): void;
}

/** The {@link Simulation} handle over `core`, its loop run by `loop`. */
function simulationHandle<TNode extends SimulationNode>(core: SimulationCore<TNode>, loop: HandleLoop): Simulation<TNode> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const h: any = {
    get nodes() {
      return core.nodes;
    },
    setNodes(newNodes: TNode[]) {
      core.setNodes(newNodes);
      return h;
    },
    setForces(newForces: SimulationForce<TNode>[]) {
      core.setForces(newForces);
      return h;
    },
    alpha(value?: number) {
      if (value === undefined) return core.alpha();
      core.alpha(value);
      if (value >= core.alphaMin()) loop.rearm();
      return h;
    },
    alphaTarget(value?: number) {
      if (value === undefined) return core.alphaTarget();
      core.alphaTarget(value);
      if (value > 0) loop.rearm();
      return h;
    },
    alphaDecay(value?: number) {
      if (value === undefined) return core.alphaDecay();
      core.alphaDecay(value);
      return h;
    },
    alphaMin(value?: number) {
      if (value === undefined) return core.alphaMin();
      core.alphaMin(value);
      return h;
    },
    velocityDecay(value?: number) {
      if (value === undefined) return core.velocityDecay();
      core.velocityDecay(value);
      return h;
    },
    restart() {
      if (core.alpha() < core.alphaMin()) core.alpha(1);
      loop.rearm();
      loop.start();
      return h;
    },
    stop() {
      loop.stop();
      return h;
    },
    tick(iterations: number = 1) {
      core.tick(iterations);
      return h;
    },
    isSettled() {
      return core.isSettled();
    },
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return h as Simulation<TNode>;
}
