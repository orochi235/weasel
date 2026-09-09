/**
 * Layout you can watch, and push against.
 *
 * A live layout is a producer on core's `usePoseRun`: each frame it hands back
 * where the participants are, the run publishes that to the scene's override
 * channel, and the whole thing commits as one batch when it settles. Nothing
 * here writes the document.
 *
 * Two producers, because the two kinds of layout are different processes.
 * `force` is a relaxation whose target changes every tick. `layered` and `tree`
 * know where they are going before they start, so they ease into it.
 *
 * **A node another gesture owns is a pin.** The run reports it, `force` holds
 * it with `fx`/`fy` and relaxes its neighbors around it, and an eased layout
 * simply leaves it alone. Dragging a body mid-run is therefore the consumer's
 * ordinary move tool — this package contributes no gesture for it.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AUTO_POSE_DESCRIPTOR,
  usePoseRun,
  type EasingFn,
  type NodeId,
  type PoseProjection,
  type PoseRunCtx,
  type PoseRunStep,
  type Scene,
} from '@weasel-js/core';
import { forceRelaxation, type ForceOptions } from './force';
import { buildGraph, type Graph, type GraphSource } from './graph';
import { layered } from './layered';
import { LAYOUTS, layoutPoses } from './layoutAction';
import { center, type LayoutFn, type LayoutOptions, type LayoutResult } from './layout';
import { tree } from './tree';
import type { DiagramNodeReader } from './trait';

/** What a live producer is told, and what it answers with. */
export interface LiveLayoutCtx<TPose> {
  /** Nodes another gesture is moving, and where each is drawn. */
  pinned: ReadonlyMap<NodeId, TPose>;
  /** Frames since this run heated, starting at 0. */
  frame: number;
}

/** A frame of a live layout: where the participants are, and whether it is
 *  finished. Positions are top-lefts, the same as a `LayoutResult`. */
export interface LiveLayoutFrame {
  result: LayoutResult;
  done: boolean;
}

export type LiveLayoutProducer<TPose> = (ctx: LiveLayoutCtx<TPose>) => LiveLayoutFrame;

/** How long an eased layout takes to arrive, in frames. Frame-counted rather
 *  than timed, so a background tab resumes where it paused rather than
 *  arriving the instant it comes back. */
const EASE_FRAMES = 24;

/** Smooth start and end. Inlined rather than pulled from the animator, which
 *  is a registry of running tweens, not a curve library. */
const easeInOut: EasingFn = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export interface ForceProducerOptions<TPose> extends ForceOptions {
  geometry?: PoseProjection<TPose>;
  /** Alpha held while something is pinned, so the graph keeps answering a drag
   *  instead of freezing under it. Default 0.3. */
  dragAlpha?: number;
}

/**
 * A relaxation, one tick a frame, done when the simulation settles.
 *
 * The forces are `forceRelaxation`'s — the same ones the one-shot `force`
 * runs, wound up once here and ticked rather than run to completion.
 *
 * It does **not** re-anchor the way the one-shot does. That translation exists
 * so a single 300-tick jump does not move the diagram off where the author left
 * it; a live run cannot jump, every frame being one step from the last, and
 * gravity holds the graph around the centroid it was seeded from. Re-anchoring
 * per frame would also fight a drag: the anchor is measured from where the
 * nodes were, and a pinned node is deliberately somewhere else.
 */
export function forceProducer<TPose>(
  graph: Graph,
  opts: ForceProducerOptions<TPose> = {},
): LiveLayoutProducer<TPose> {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseProjection<TPose>);
  const relaxation = forceRelaxation(graph, opts);
  const dragAlpha = opts.dragAlpha ?? 0.3;

  return ({ pinned }) => {
    for (const node of graph.nodes) {
      const body = relaxation.byId.get(node.id);
      if (body === undefined) continue;
      const held = pinned.get(node.id as NodeId);
      if (held !== undefined) {
        // A dragged node holds its neighbors while they relax, which is `fx` /
        // `fy` on the integrator rather than a correction applied afterward.
        const bounds = geometry.getBounds(held);
        body.fx = center(bounds, 'x');
        body.fy = center(bounds, 'y');
      } else if (!relaxation.pinned.has(node.id)) {
        delete body.fx;
        delete body.fy;
      }
    }
    // A pin is a live edit, so the run keeps its temperature up until the
    // pointer lets go.
    relaxation.sim.alphaTarget(pinned.size > 0 ? dragAlpha : 0);
    relaxation.sim.tick();
    return { result: relaxation.placed(), done: relaxation.sim.isSettled() };
  };
}

export interface EasedProducerOptions {
  layout?: LayoutOptions;
  /** Frames to arrive in. Default 24. */
  frames?: number;
  easing?: EasingFn;
}

/**
 * A layout that knows its destination, walked into place.
 *
 * The target is computed once, from the graph as it stood when the run heated;
 * each frame is that target scaled by the easing curve, measured from where the
 * nodes started. A pinned node is dropped from the target rather than fought
 * over.
 */
export function easedProducer<TPose>(
  graph: Graph,
  algorithm: LayoutFn,
  opts: EasedProducerOptions = {},
): LiveLayoutProducer<TPose> {
  const frames = opts.frames ?? EASE_FRAMES;
  const easing = opts.easing ?? easeInOut;
  const target = algorithm(graph, opts.layout);
  const from = new Map<string, { x: number; y: number }>();
  for (const node of graph.nodes) from.set(node.id, { x: node.bounds.x, y: node.bounds.y });

  return ({ pinned, frame }) => {
    const t = Math.min((frame + 1) / frames, 1);
    const u = easing(t);
    const result = new Map<string, { x: number; y: number }>();
    for (const [id, to] of target) {
      if (pinned.has(id as NodeId)) continue;
      const start = from.get(id);
      if (start === undefined) continue;
      result.set(id, {
        x: start.x + (to.x - start.x) * u,
        y: start.y + (to.y - start.y) * u,
      });
    }
    return { result, done: t >= 1 };
  };
}

export interface UseLiveLayoutOptions<TPose> {
  scene: Scene<unknown, string, TPose>;
  /** Where the graph is read from. The same thunk the port affordance takes. */
  source: GraphSource<TPose>;
  /** A key in `LAYOUTS`, or a layout of the consumer's own. `'force'` relaxes
   *  continuously; anything else eases to its answer. Default `'force'`. */
  algorithm?: string | LayoutFn;
  layout?: LayoutOptions;
  force?: ForceOptions;
  /** Frames an eased layout takes to arrive. Default 24. */
  frames?: number;
  easing?: EasingFn;
  read?: DiagramNodeReader;
  geometry?: PoseProjection<TPose>;
  /** The undo entry's name. Default `'Layout'`. */
  label?: string;
  /** Fires once the run has settled or been stopped and its poses are in the
   *  document, with how many participants moved. */
  onSettle?: (moved: number) => void;
  /** Whether a node or edge appearing or disappearing re-heats the run.
   *  Default true — a diagram that ignores a new edge looks broken. */
  reheatOnGraphChange?: boolean;
  /** Clock injection, for tests. Defaults to `requestAnimationFrame`. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface LiveLayout {
  /** Heat and run. Idempotent while running. */
  start(): void;
  /** Finish now: commit where the nodes stand. */
  stop(): void;
  /** Abandon: the document keeps the poses it had. */
  cancel(): void;
  /** Rebuild the graph and run again from where the nodes are now. */
  restart(): void;
  isRunning(): boolean;
}

/** The shape of a graph, as a string that changes when a node or edge does. */
function shapeOf(graph: Graph): string {
  const nodes = graph.nodes.map((n) => n.id).sort().join(',');
  const edges = graph.edges.map((e) => `${e.from}>${e.to}`).sort().join(',');
  return `${nodes}|${edges}`;
}

/**
 * Run a layout live against a scene.
 *
 * The returned handle is stable. Dragging a participant while it runs needs no
 * wiring: the consumer's move tool publishes an override, and the run treats
 * that as a pin.
 */
export function useLiveLayout<TPose>(opts: UseLiveLayoutOptions<TPose>): LiveLayout {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const producer = useRef<LiveLayoutProducer<TPose> | null>(null);
  const producerFrame = useRef(0);
  const shape = useRef('');

  const build = useCallback((): void => {
    const o = optsRef.current;
    const graph = buildGraph(o.source, {
      ...(o.read ? { read: o.read } : {}),
      ...(o.geometry ? { geometry: o.geometry } : {}),
    });
    shape.current = shapeOf(graph);
    producerFrame.current = 0;
    const algorithm = o.algorithm ?? 'force';
    if (algorithm === 'force') {
      producer.current = forceProducer<TPose>(graph, {
        ...o.layout, ...o.force,
        ...(o.geometry ? { geometry: o.geometry } : {}),
      });
      return;
    }
    const fn = typeof algorithm === 'function' ? algorithm : LAYOUTS[algorithm] ?? layered;
    producer.current = easedProducer<TPose>(graph, fn, {
      ...(o.layout ? { layout: o.layout } : {}),
      ...(o.frames === undefined ? {} : { frames: o.frames }),
      ...(o.easing ? { easing: o.easing } : {}),
    });
  }, []);

  const step = useCallback((ctx: PoseRunCtx<TPose>): PoseRunStep<TPose> => {
    const o = optsRef.current;
    if (producer.current === null) return { poses: [], done: true };
    const { result, done } = producer.current({
      pinned: ctx.pinned,
      frame: producerFrame.current++,
    });
    // A pinned participant takes its subtree out of the frame with it. The run
    // skips the participant itself, but its rows and labels are ids of their
    // own — left in, they would be published from the pose the document still
    // holds while the gesture carries the box somewhere else.
    let placed = result;
    if (ctx.pinned.size > 0) {
      const held = new Map(result);
      for (const id of ctx.pinned.keys()) held.delete(id as string);
      placed = held;
    }
    const poses = layoutPoses(o.scene, placed, o.geometry);
    return { poses: [...poses] as [NodeId, TPose][], done };
  }, []);

  const run = usePoseRun<TPose>({
    scene: opts.scene,
    step,
    onCommit: (moved) => optsRef.current.onSettle?.(moved),
    ...(opts.label ? { label: opts.label } : {}),
    ...(opts.requestFrame ? { requestFrame: opts.requestFrame } : {}),
    ...(opts.cancelFrame ? { cancelFrame: opts.cancelFrame } : {}),
  });

  // A node or edge appearing or disappearing is a new problem, so the run
  // re-heats rather than finishing the one it started on.
  useEffect(() => {
    if (opts.reheatOnGraphChange === false) return;
    return opts.scene.subscribe(() => {
      if (!run.isRunning()) return;
      const o = optsRef.current;
      const graph = buildGraph(o.source, {
        ...(o.read ? { read: o.read } : {}),
        ...(o.geometry ? { geometry: o.geometry } : {}),
      });
      if (shapeOf(graph) === shape.current) return;
      build();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.scene, opts.reheatOnGraphChange, run, build]);

  return useMemo<LiveLayout>(() => ({
    start() {
      if (run.isRunning()) return;
      build();
      run.start();
    },
    stop: () => { run.stop(); },
    cancel: () => { run.cancel(); },
    restart() {
      run.cancel();
      build();
      run.start();
    },
    isRunning: () => run.isRunning(),
  }), [run, build]);
}

/** The layouts that ease rather than relax, for a consumer choosing one. */
export const EASED_LAYOUTS: Readonly<Record<string, LayoutFn>> = Object.freeze({
  layered,
  tree,
});
