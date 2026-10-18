/**
 * Layout you can watch, and push against.
 *
 * A live layout is a producer on core's `usePoseRun`: each frame it hands back
 * where the participants are, the run publishes that to the scene's override
 * channel, and the whole thing commits as one batch when it settles. Nothing
 * here writes the document.
 *
 * Two producers: `force` is a relaxation whose target changes every tick;
 * `layered` and `tree` know where they are going, so they ease into it. So
 * does a `LayoutPlanner`, once it answers.
 *
 * **A node another gesture owns is a pin.** `force` holds it with `fx`/`fy`
 * and relaxes its neighbors around it, and an eased layout leaves it alone, so
 * dragging a body mid-run is the consumer's ordinary move tool.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useLatest,
  usePoseRun,
  type NodeId,
  type PoseDescriptor,
  type PoseRunCtx,
  type PoseRunStep,
  type Scene,
} from '@weasel-js/core';
import { type EasingFn } from '@weasel-js/animator';
import { isPromise } from './footprint';
import { buildGraph, type Graph, type GraphSource } from './graph';
import { chain } from './chain';
import { layered } from './layered';
import { LAYOUTS, layoutPoses } from './layoutAction';
import { planOf, plannerPlan, type LayoutFn, type LayoutOptions, type LayoutPlan, type LayoutPlanner } from './layout';
import { sameGraph, shapeOf, usePendingPlan } from './livePlan';
import {
  EASE_FRAMES,
  easeInOut,
  easedProducer,
  forceProducer,
  progress,
  type ForceProducerOptions,
  type LiveLayoutProducer,
} from './liveProducers';
import { routeEasings, useEasedRoutes } from './liveRoutes';
import { routeWrites, routesOf, type LayoutRoutes } from './routeWrites';
import { tree } from './tree';
import type { DiagramNodeReader } from './trait';

export {
  easedProducer,
  forceProducer,
  type EasedProducerOptions,
  type ForceProducerOptions,
  type LiveLayoutCtx,
  type LiveLayoutFrame,
  type LiveLayoutProducer,
} from './liveProducers';

/** Options for {@link useLiveLayout}. Only `scene` and `source` are required. */
export interface UseLiveLayoutOptions<TPose> {
  scene: Scene<unknown, string, TPose>;
  /** Where the graph is read from. The same thunk the port affordance takes. */
  source: GraphSource<TPose>;
  /** A key in `LAYOUTS`, a layout of the consumer's own, or a planner that
   *  answers later. `'force'` relaxes continuously; anything else eases to its
   *  answer. Default `'force'`. */
  algorithm?: string | LayoutFn | LayoutPlanner;
  layout?: LayoutOptions;
  /** The relaxation's forces, and when a live run of it counts as at rest. */
  force?: Omit<ForceProducerOptions<TPose>, 'geometry'>;
  /** Frames an eased layout takes to arrive. Default 24. */
  frames?: number;
  easing?: EasingFn;
  read?: DiagramNodeReader;
  geometry?: PoseDescriptor<TPose>;
  /** The undo entry's name. Default `'Layout'`. */
  label?: string;
  /** Fires once the run has settled or been stopped and its poses are in the
   *  document, with how many participants moved. */
  onSettle?: (moved: number) => void;
  /** Hears why a `LayoutPlanner` failed to answer, and no run starts. Unset,
   *  the failure goes to `console.error`. */
  onError?: (error: unknown) => void;
  /** Whether a node or edge appearing or disappearing re-heats the run.
   *  Default true — a diagram that ignores a new edge looks broken. */
  reheatOnGraphChange?: boolean;
  /** Clock injection, for tests. Defaults to `requestAnimationFrame`. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

/** Controls for a live layout run, from {@link useLiveLayout}. */
export interface LiveLayout {
  /** Heat and run. Idempotent while running, which includes waiting on a
   *  planner's answer. */
  start(): void;
  /** Finish now: commit where the nodes stand. A planner's answer still to
   *  come is dropped. */
  stop(): void;
  /** Abandon: the document keeps the poses it had. */
  cancel(): void;
  /** Rebuild the graph and run again from where the nodes are now. */
  restart(): void;
  isRunning(): boolean;
}

/** The graph `o.source` describes now. */
function graphOf<TPose>(o: UseLiveLayoutOptions<TPose>): Graph {
  return buildGraph(o.source, {
    ...(o.read ? { read: o.read } : {}),
    ...(o.geometry ? { geometry: o.geometry } : {}),
  });
}

/** What `o.algorithm` plans for `graph`: `null` for a relaxation, which has
 *  no destination, and a promise from a planner that answers later. */
function planFor<TPose>(graph: Graph, o: UseLiveLayoutOptions<TPose>): LayoutPlan | Promise<LayoutPlan> | null {
  const algorithm = o.algorithm ?? 'force';
  if (algorithm === 'force') return null;
  if (typeof algorithm === 'object') return plannerPlan(algorithm, graph, o.layout);
  return planOf(typeof algorithm === 'function' ? algorithm : LAYOUTS[algorithm] ?? layered, graph, o.layout);
}

/** The producer that eases from `graph` to `plan`, or relaxes `graph` when
 *  there is no plan. */
function producerFor<TPose>(graph: Graph, plan: LayoutPlan | null, o: UseLiveLayoutOptions<TPose>): LiveLayoutProducer<TPose> {
  if (plan === null) return forceProducer<TPose>(graph, { ...o.layout, ...o.force, ...(o.geometry ? { geometry: o.geometry } : {}) });
  return easedProducer<TPose>(graph, () => plan.moves, {
    ...(o.frames === undefined ? {} : { frames: o.frames }),
    ...(o.easing ? { easing: o.easing } : {}),
  });
}

/**
 * Run a layout live against a scene.
 *
 * The returned handle is stable. Dragging a participant while it runs needs no
 * wiring: the consumer's move tool publishes an override, and the run treats
 * that as a pin.
 */
export function useLiveLayout<TPose>(opts: UseLiveLayoutOptions<TPose>): LiveLayout {
  const optsRef = useLatest(opts);

  const producer = useRef<LiveLayoutProducer<TPose> | null>(null);
  const producerFrame = useRef(0);
  const shape = useRef('');
  /** The routes the run's layout laid out, written once it arrives. */
  const routes = useRef<LayoutRoutes | undefined>(undefined);
  /** Whether a gesture held a participant during the run: the routes were
   *  laid out around where it was going, not where it was put. */
  const held = useRef(false);
  const eased = useEasedRoutes<TPose>();

  const pending = usePendingPlan();

  /** Set the run up to ease from `graph` to `plan`, or to relax it when
   *  there is no plan. */
  const install = useCallback((graph: Graph, plan: LayoutPlan | null): void => {
    const o = optsRef.current;
    producerFrame.current = 0;
    held.current = false;
    routes.current = routesOf(graph, plan ?? { moves: new Map() });
    eased.set(routeEasings(o.scene, graph, routes.current));
    producer.current = producerFor(graph, plan, o);
  }, [optsRef, eased]);

  const step = useCallback((ctx: PoseRunCtx<TPose>): PoseRunStep<TPose> => {
    const o = optsRef.current;
    if (producer.current === null) return { poses: [], done: true };
    if (ctx.pinned.size > 0) held.current = true;
    const frame = producerFrame.current++;
    const { result, done } = producer.current({ pinned: ctx.pinned, frame });
    // A pinned participant takes its subtree out of the frame with it: its
    // rows and labels are ids of their own, and left in they would be
    // published from the pose the document still holds.
    let placed = result;
    if (ctx.pinned.size > 0) {
      const held = new Map(result);
      for (const id of ctx.pinned.keys()) held.delete(id as string);
      placed = held;
    }
    const poses = layoutPoses(o.scene, placed, o.geometry);
    // Routes ease only toward where they will be written, which a held run never writes.
    const { u } = progress(frame, o.frames ?? EASE_FRAMES, o.easing ?? easeInOut);
    eased.show(o.scene, held.current ? null : u, (id) => poses.get(id) ?? ctx.pinned.get(id as NodeId), o.geometry);
    return { poses: [...poses] as [NodeId, TPose][], done };
  }, [optsRef, eased]);

  const run = usePoseRun<TPose>({
    scene: opts.scene,
    step,
    // Eased routes go once the routes are in the document, so no frame shows the old ones.
    onCommit: (moved) => { eased.drop(); optsRef.current.onSettle?.(moved); },
    // Routes match where the layout was going, so only a run that got there
    // with nothing held along the way writes them.
    commitWith: (finished) => {
      if (!finished || held.current || routes.current === undefined) return;
      const scene = optsRef.current.scene;
      for (const [id, data] of routeWrites(scene as never, routes.current)) scene.update(id as never, { data });
    },
    ...(opts.label ? { label: opts.label } : {}),
    ...(opts.requestFrame ? { requestFrame: opts.requestFrame } : {}),
    ...(opts.cancelFrame ? { cancelFrame: opts.cancelFrame } : {}),
  });

  /** Read the graph and set the run up on it: true once it is ready to run,
   *  false while a planner's answer is on its way, after which it starts the
   *  run itself. */
  const build = useCallback((): boolean => {
    const graph = graphOf(optsRef.current);
    shape.current = shapeOf(graph);
    const plan = planFor(graph, optsRef.current);
    if (plan === null || !isPromise(plan)) {
      install(graph, plan);
      return true;
    }
    pending.request(plan, (answer) => {
      if (!sameGraph(graph, graphOf(optsRef.current))) return;
      install(graph, answer);
      run.start();
    }, (error) => {
      const onError = optsRef.current.onError;
      if (onError) onError(error);
      else console.error(error);
    });
    return false;
  }, [optsRef, install, pending, run]);

  /** Abandon whatever is running or awaited, and start again from where the
   *  nodes are now. */
  const restart = useCallback((): void => {
    pending.drop();
    run.cancel();
    if (build()) run.start();
  }, [pending, run, build]);

  // A node or edge appearing or disappearing is a new problem, so the run
  // re-heats rather than finishing the one it started on. A planner is asked
  // again, since its answer has no place for what changed.
  useEffect(() => {
    if (opts.reheatOnGraphChange === false) return;
    return opts.scene.subscribe(() => {
      if (!run.isRunning() && !pending.isWaiting()) return;
      if (shapeOf(graphOf(optsRef.current)) === shape.current) return;
      if (typeof optsRef.current.algorithm === 'object') restart();
      else build();
    });
  }, [opts.scene, opts.reheatOnGraphChange, run, build, restart, pending, optsRef]);

  return useMemo<LiveLayout>(() => ({
    start() {
      if (run.isRunning() || pending.isWaiting()) return;
      if (build()) run.start();
    },
    stop: () => { pending.drop(); run.stop(); },
    cancel: () => { pending.drop(); run.cancel(); eased.drop(); },
    restart,
    isRunning: () => run.isRunning() || pending.isWaiting(),
  }), [run, build, restart, eased, pending]);
}

/** The layouts that ease rather than relax, for a consumer choosing one. */
export const EASED_LAYOUTS: Readonly<Record<string, LayoutFn>> = Object.freeze({
  layered,
  tree,
  chain,
});
