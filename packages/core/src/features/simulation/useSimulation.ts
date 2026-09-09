import { useEffect, useMemo, useRef } from 'react';
import { useVisibleRaf } from '../../scheduling/useVisibleRaf';
import { createSimulation } from './createSimulation';
import {
  type Simulation,
  type SimulationCore,
  type SimulationForce,
  type SimulationNode,
  type UseSimulationOptions,
} from './types';

/**
 * Continuous N-body simulation primitive: `createSimulation`'s integrator on a
 * frame loop.
 *
 * The kit is adapter-agnostic — `onTick(nodes)` fires after each integration
 * step and the consumer decides how (and whether) to write through to scene
 * state. Per-tick history bypass and settle-commit semantics are consumer
 * concerns; the kit doesn't have an opinion.
 */
export function useSimulation<TNode extends SimulationNode>(
  opts: UseSimulationOptions<TNode>,
): Simulation<TNode> {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const coreRef = useRef<SimulationCore<TNode> | null>(null);
  coreRef.current ??= createSimulation(opts);
  const core = coreRef.current;

  /** Whether onEnd has fired since the last energization (restart / alpha set / target raise). */
  const endedRef = useRef(false);
  const mountedRef = useRef(true);

  // The loop runs behind the visibility gate: a settling simulation stops
  // integrating on a page nobody is looking at, and picks up where it left off.
  // Its step is fixed rather than time-based, so there is no clock to rebase.
  // The gate defaults an absent clock to `requestAnimationFrame`, so an
  // injected one passes straight through rather than being defaulted twice.
  const frameLoop = useVisibleRaf(
    () => { rafTick(); },
    {
      requestFrame: opts.requestFrame,
      cancelFrame: opts.cancelFrame,
    },
  );

  const stopRaf = (): void => { frameLoop.cancel(); };

  const rafTick = (): void => {
    if (!mountedRef.current) return;

    core.tick();
    optsRef.current.onTick?.(core.nodes);

    if (core.alpha() < core.alphaMin()) {
      stopRaf();
      if (!endedRef.current) {
        endedRef.current = true;
        optsRef.current.onEnd?.();
      }
      return;
    }

    frameLoop.request();
  };

  const startRaf = (): void => {
    if (!mountedRef.current) return;
    frameLoop.request();
  };

  // The loop starts on first render rather than in an effect, so the handle's
  // methods see consistent state from the first imperative call rather than
  // after a paint round-trip. `createSimulation` has already primed the nodes.
  const startedRef = useRef(false);
  if (!startedRef.current) {
    startedRef.current = true;
    startRaf();
  }

  // StrictMode-safe mount/unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      frameLoop.cancel();
    };
  }, [frameLoop]);

  // Stable handle. All methods read through the core, so a fixed identity is safe.
  const handle = useMemo<Simulation<TNode>>(() => {
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
        if (value >= core.alphaMin()) endedRef.current = false;
        return h;
      },
      alphaTarget(value?: number) {
        if (value === undefined) return core.alphaTarget();
        core.alphaTarget(value);
        if (value > 0) endedRef.current = false;
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
        endedRef.current = false;
        startRaf();
        return h;
      },
      stop() {
        stopRaf();
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
    return h as Simulation<TNode>;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return handle;
}
