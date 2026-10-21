import type { Fader } from './fader';
import type { NodeWrapper } from './wrapper';

/**
 * One connection, from a wrapper's `out` to another's `ins[port]` or to the graph's output.
 * `deferred`: accepted, but wiring it now would close a cycle through edges still fading
 * out, so it has no fader until they finish. `closing`: fading out; never reopened, since a
 * reopened close still cuts when its timer fires.
 */
export interface Edge {
  readonly from: NodeWrapper;
  /** `null` is the graph's output. */
  readonly to: NodeWrapper | null;
  readonly port: string;
  state: 'deferred' | 'open' | 'closing';
  fader: Fader | null;
}

/** The edge a caller can still see: open or deferred, never one fading out. */
export function findLive(
  edges: readonly Edge[],
  from: NodeWrapper,
  to: NodeWrapper | null,
  port: string,
): Edge | undefined {
  return edges.find((e) => e.state !== 'closing' && e.from === from && e.to === to && e.port === port);
}

export const touches = (e: Edge, w: NodeWrapper): boolean => e.from === w || e.to === w;

/** The edges the caller sees, which a new connection must not close a cycle through. */
export const logical = (e: Edge): boolean => e.state !== 'closing';
/** The edges wired in the audio graph, which Web Audio mutes a cycle through. */
export const wired = (e: Edge): boolean => e.state !== 'deferred';

/** Whether `goal` is downstream of `start` along the edges `admit` accepts. */
export function reaches<N, E extends { readonly from: N; readonly to: N | null }>(
  edges: readonly E[],
  start: N,
  goal: N,
  admit: (e: E) => boolean = () => true,
): boolean {
  const seen = new Set<N>();
  const stack = [start];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (n === goal) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const e of edges) if (admit(e) && e.from === n && e.to !== null) stack.push(e.to);
  }
  return false;
}

/** Whether wiring `e` now would close a cycle in the audio graph. */
export const blocked = (edges: readonly Edge[], e: Edge): boolean =>
  e.to !== null && reaches(edges, e.to, e.from, wired);

/** Drop `e` from `edges` if it is still there. */
export function drop(edges: Edge[], e: Edge): void {
  const i = edges.indexOf(e);
  if (i >= 0) edges.splice(i, 1);
}
