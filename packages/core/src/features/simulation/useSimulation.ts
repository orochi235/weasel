import { useEffect, useMemo, useRef } from 'react';
import { useVisibleRaf } from '../../scheduling/useVisibleRaf';
import {
  DEFAULT_ALPHA_DECAY,
  DEFAULT_ALPHA_MIN,
  DEFAULT_VELOCITY_DECAY,
  type Simulation,
  type SimulationForce,
  type SimulationNode,
  type UseSimulationOptions,
} from './types';

/**
 * Continuous N-body simulation primitive. Owns a RAF loop and a velocity-Verlet
 * integrator; forces are pluggable functions matching d3-force's protocol so
 * d3-force's bundled forces work without translation.
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

  const nodesRef = useRef<TNode[]>(opts.nodes);
  const forcesRef = useRef<SimulationForce<TNode>[]>(opts.forces ?? []);
  const alphaRef = useRef(opts.alpha ?? 1);
  const alphaMinRef = useRef(opts.alphaMin ?? DEFAULT_ALPHA_MIN);
  const alphaDecayRef = useRef(opts.alphaDecay ?? DEFAULT_ALPHA_DECAY);
  const alphaTargetRef = useRef(opts.alphaTarget ?? 0);
  const velocityDecayRef = useRef(opts.velocityDecay ?? DEFAULT_VELOCITY_DECAY);

  /** Whether onEnd has fired since the last energization (restart / alpha set / target raise). */
  const endedRef = useRef(false);
  const mountedRef = useRef(true);

  // Stable clock — captured once on first render; tests inject via opts.
  const clockRef = useRef<{
    requestFrame: (cb: (t: number) => void) => number;
    cancelFrame: (handle: number) => void;
  } | null>(null);
  if (clockRef.current === null) {
    clockRef.current = {
      requestFrame: opts.requestFrame ?? ((cb) => requestAnimationFrame(cb)),
      cancelFrame: opts.cancelFrame ?? ((h) => cancelAnimationFrame(h)),
    };
  }

  // The loop runs behind the visibility gate: a settling simulation stops
  // integrating on a page nobody is looking at, and picks up where it left off.
  // Its step is fixed rather than time-based, so there is no clock to rebase.
  const frameLoop = useVisibleRaf(
    () => { rafTick(); },
    {
      requestFrame: clockRef.current.requestFrame,
      cancelFrame: clockRef.current.cancelFrame,
    },
  );

  /** Single synchronous integration step. Does NOT fire onTick / onEnd. */
  const tickOnce = (): void => {
    alphaRef.current += (alphaTargetRef.current - alphaRef.current) * alphaDecayRef.current;

    const forces = forcesRef.current;
    for (const f of forces) f(alphaRef.current);

    const friction = 1 - velocityDecayRef.current;
    const nodes = nodesRef.current;
    for (const n of nodes) {
      if (n.fx == null) {
        n.vx = (n.vx ?? 0) * friction;
        // Guard against non-finite velocity (force-overflow or degenerate
        // initial conditions). A NaN/Infinity here would propagate into
        // position and then into renderer geometry, which can produce
        // pathological tessellation work without any thrown error.
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
  };

  const stopRaf = (): void => { frameLoop.cancel(); };

  const rafTick = (): void => {
    if (!mountedRef.current) return;

    tickOnce();
    optsRef.current.onTick?.(nodesRef.current);

    if (alphaRef.current < alphaMinRef.current) {
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

  // Initialize forces + node indices once on first render. The early init
  // (before useEffect) means the handle's methods see consistent state from
  // the first imperative call, not after a paint round-trip.
  const initOnceRef = useRef(false);
  if (!initOnceRef.current) {
    initOnceRef.current = true;
    nodesRef.current.forEach((n, i) => {
      n.index = i;
      // d3-force forces assume vx/vy are numbers (they do `n.vx += force`).
      // Initialize to 0 so the first tick doesn't produce NaN.
      if (n.vx == null) n.vx = 0;
      if (n.vy == null) n.vy = 0;
    });
    for (const f of forcesRef.current) {
      f.initialize?.(nodesRef.current, Math.random);
    }
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

  // Stable handle. All methods read from refs, so a fixed identity is safe.
  const handle = useMemo<Simulation<TNode>>(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const h: any = {
      get nodes() {
        return nodesRef.current;
      },
      setNodes(newNodes: TNode[]) {
        nodesRef.current = newNodes;
        newNodes.forEach((n, i) => {
          n.index = i;
          if (n.vx == null) n.vx = 0;
          if (n.vy == null) n.vy = 0;
        });
        for (const f of forcesRef.current) {
          f.initialize?.(newNodes, Math.random);
        }
        return h;
      },
      setForces(newForces: SimulationForce<TNode>[]) {
        const old = forcesRef.current;
        forcesRef.current = newForces;
        for (const f of newForces) {
          if (!old.includes(f)) {
            f.initialize?.(nodesRef.current, Math.random);
          }
        }
        return h;
      },
      alpha(value?: number) {
        if (value === undefined) return alphaRef.current;
        alphaRef.current = value;
        if (value >= alphaMinRef.current) endedRef.current = false;
        return h;
      },
      alphaTarget(value?: number) {
        if (value === undefined) return alphaTargetRef.current;
        alphaTargetRef.current = value;
        if (value > 0) endedRef.current = false;
        return h;
      },
      alphaDecay(value?: number) {
        if (value === undefined) return alphaDecayRef.current;
        alphaDecayRef.current = value;
        return h;
      },
      alphaMin(value?: number) {
        if (value === undefined) return alphaMinRef.current;
        alphaMinRef.current = value;
        return h;
      },
      velocityDecay(value?: number) {
        if (value === undefined) return velocityDecayRef.current;
        velocityDecayRef.current = value;
        return h;
      },
      restart() {
        if (alphaRef.current < alphaMinRef.current) {
          alphaRef.current = 1;
        }
        endedRef.current = false;
        startRaf();
        return h;
      },
      stop() {
        stopRaf();
        return h;
      },
      tick(iterations: number = 1) {
        for (let i = 0; i < iterations; i++) tickOnce();
        return h;
      },
      isSettled() {
        return alphaRef.current < alphaMinRef.current && alphaTargetRef.current === 0;
      },
    };
    return h as Simulation<TNode>;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return handle;
}
