/**
 * A live layout's producers: what each frame of a run says about where the
 * participants are. `forceProducer` relaxes; `easedProducer` walks to a
 * destination it knows. `useLiveLayout` (`live.ts`) runs them.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  type NodeId,
  type PoseDescriptor,
} from '@weasel-js/core';
import { type EasingFn } from '@weasel-js/animator';
import { forceRelaxation, type ForceOptions } from './force';
import type { Graph } from './graph';
import { center, type LayoutFn, type LayoutOptions, type LayoutResult } from './layout';

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

/** One frame of a live layout, called once per frame until it reports `done`. */
export type LiveLayoutProducer<TPose> = (ctx: LiveLayoutCtx<TPose>) => LiveLayoutFrame;

/** How long an eased layout takes to arrive, in frames. Frame-counted rather
 *  than timed, so a background tab resumes where it paused rather than
 *  arriving the instant it comes back. */
export const EASE_FRAMES = 24;

/** Smooth start and end. Inlined rather than pulled from the animator, which
 *  is a registry of running tweens, not a curve library. */
export const easeInOut: EasingFn = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** How far along an eased run is at `frame`, before and after its easing. */
export function progress(frame: number, frames: number, easing: EasingFn): { t: number; u: number } {
  const t = Math.min((frame + 1) / frames, 1);
  return { t, u: easing(t) };
}

/** Options for {@link forceProducer}. */
export interface ForceProducerOptions<TPose> extends ForceOptions {
  geometry?: PoseDescriptor<TPose>;
  /** Alpha held while something is pinned, so the graph keeps answering a drag
   *  instead of freezing under it. Default 0.3. */
  dragAlpha?: number;
  /** The run is at rest once no node moves this far in a tick, in world units.
   *  Default 0.1. `0` never rests, leaving the run to the cooling schedule. */
  restDistance?: number;
  /** Consecutive ticks at rest before the run finishes. Default 5. */
  restTicks?: number;
}

const REST_DISTANCE = 0.1;
const REST_TICKS = 5;

/**
 * A relaxation, one tick a frame, done when the graph stops moving.
 *
 * Motion ends long before alpha cools, so it finishes on whichever comes
 * first: `restTicks` ticks in a row with no node moving `restDistance`, or the
 * cooling schedule running out. Nothing rests while a node is held.
 *
 * It does **not** re-anchor the way the one-shot `force` does. Re-anchoring
 * per frame would fight a drag: the anchor is measured from where the nodes
 * were, and a pinned node is deliberately somewhere else.
 */
export function forceProducer<TPose>(
  graph: Graph,
  opts: ForceProducerOptions<TPose> = {},
): LiveLayoutProducer<TPose> {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);
  const relaxation = forceRelaxation(graph, opts);
  const dragAlpha = opts.dragAlpha ?? 0.3;
  const restDistance = opts.restDistance ?? REST_DISTANCE;
  const restTicks = opts.restTicks ?? REST_TICKS;
  const was = relaxation.bodies.map((b) => ({ x: b.x, y: b.y }));
  let still = 0;

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

    let moved = 0;
    relaxation.bodies.forEach((body, i) => {
      const at = was[i]!;
      moved = Math.max(moved, Math.hypot(body.x - at.x, body.y - at.y));
      at.x = body.x;
      at.y = body.y;
    });
    still = pinned.size === 0 && moved < restDistance ? still + 1 : 0;

    const done = still >= restTicks || relaxation.sim.isSettled();
    return { result: relaxation.placed(), done };
  };
}

/** Options for {@link easedProducer}. */
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
    const { t, u } = progress(frame, frames, easing);
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
