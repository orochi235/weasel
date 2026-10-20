import type { Fader } from './fader';
import type { NodeWrapper } from './wrapper';

/** One connection, from a wrapper's `out` to another's `ins[port]` or to the graph's output. */
export interface Edge {
  readonly from: NodeWrapper;
  /** `null` is the graph's output. */
  readonly to: NodeWrapper | null;
  readonly port: string;
  readonly fader: Fader;
  /** Fading out; never reopened, since a reopened close still cuts when its timer fires. */
  closing: boolean;
}

export function findLive(
  edges: readonly Edge[],
  from: NodeWrapper,
  to: NodeWrapper | null,
  port: string,
): Edge | undefined {
  return edges.find((e) => !e.closing && e.from === from && e.to === to && e.port === port);
}

export const touches = (e: Edge, w: NodeWrapper): boolean => e.from === w || e.to === w;

/** Whether `goal` is downstream of `start` along live edges. */
export function reaches(edges: readonly Edge[], start: NodeWrapper, goal: NodeWrapper): boolean {
  const seen = new Set<NodeWrapper>();
  const stack = [start];
  while (stack.length > 0) {
    const w = stack.pop()!;
    if (w === goal) return true;
    if (seen.has(w)) continue;
    seen.add(w);
    for (const e of edges) if (!e.closing && e.from === w && e.to) stack.push(e.to);
  }
  return false;
}
