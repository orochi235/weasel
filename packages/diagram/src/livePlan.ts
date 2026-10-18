/**
 * The wait before a live run whose layout answers later: a `LayoutPlanner`
 * that returns a promise.
 *
 * Only the newest request is answered, and only while the graph it was asked
 * about is still the one on screen. A drag, an edit, or a node added while the
 * answer was on its way makes the plan describe somewhere the diagram no
 * longer is, so the answer is dropped and the run never starts.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Graph } from './graph';
import type { LayoutPlan } from './layout';

/** The shape of a graph, as a string that changes when a node or edge does. */
export function shapeOf(graph: Graph): string {
  const nodes = graph.nodes.map((n) => n.id).sort().join(',');
  const edges = graph.edges.map((e) => `${e.from}>${e.to}`).sort().join(',');
  return `${nodes}|${edges}`;
}

/** Whether `b` is `a` again: the same nodes and edges, every node in the same box. */
export function sameGraph(a: Graph, b: Graph): boolean {
  if (shapeOf(a) !== shapeOf(b)) return false;
  return a.nodes.every((n) => {
    const m = b.node(n.id)?.bounds;
    const k = n.bounds;
    return m !== undefined && m.x === k.x && m.y === k.y && m.width === k.width && m.height === k.height;
  });
}

/** A live run's outstanding request for a plan. Stable for the life of the
 *  component; unmounting drops whatever is pending. */
export interface PendingPlan {
  /** Hand `ready` the plan once it arrives, or `failed` the reason it never
   *  will, unless another request or a `drop` comes first; a superseded
   *  request's failure is dropped with its answer. */
  request(answer: Promise<LayoutPlan>, ready: (plan: LayoutPlan) => void, failed: (error: unknown) => void): void;
  /** Forget the outstanding request. */
  drop(): void;
  isWaiting(): boolean;
}

export function usePendingPlan(): PendingPlan {
  const generation = useRef(0);
  const waiting = useRef(false);
  const pending = useMemo<PendingPlan>(() => ({
    request(answer, ready, failed) {
      const mine = ++generation.current;
      waiting.current = true;
      const current = () => generation.current === mine;
      void answer.then(
        (plan) => {
          if (!current()) return;
          waiting.current = false;
          ready(plan);
        },
        (error: unknown) => {
          if (!current()) return;
          waiting.current = false;
          failed(error);
        },
      );
    },
    drop() {
      generation.current++;
      waiting.current = false;
    },
    isWaiting: () => waiting.current,
  }), []);
  useEffect(() => () => pending.drop(), [pending]);
  return pending;
}
