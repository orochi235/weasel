import type { AnalyserTap, AnalyserTapOptions } from '../analyser';
import type { Timers } from '../audioTime';

/** What a node factory returns and the graph wraps. `inputs` is empty for a source. */
export interface GraphNodeDef {
  readonly inputs: Readonly<Record<string, AudioNode>>;
  readonly output: AudioNode;
  /** `rampMs` is always passed; the graph supplies its fade when the caller gives none. */
  readonly params: Readonly<Record<string, (value: number, rampMs: number) => void>>;
  /** Sources only. `when` is context seconds. Called when the graph starts, or on add/replace while it runs. A source must be startable again after `stop`. */
  start?(when: number): void;
  /** Sources only. Stop at `when` (context seconds). */
  stop?(when: number): void;
  /** Called once, after the node has faded out of the graph. */
  dispose?(): void;
}

/** A connection's far end: a node's named input port, or the graph's output. */
export type GraphTarget = { node: string; port: string } | { output: true };

export type GraphPatch =
  | { kind: 'add'; id: string; def: GraphNodeDef }
  | { kind: 'remove'; id: string }
  | { kind: 'replace'; id: string; def: GraphNodeDef }
  | { kind: 'connect'; from: string; to: GraphTarget }
  | { kind: 'disconnect'; from: string; to: GraphTarget }
  | { kind: 'set'; id: string; param: string; value: number; rampMs?: number };

export interface AudioGraphOptions extends Partial<Timers> {
  /** Crossfade for every structural edit, and the default ramp for `set`, in ms. Default 15. */
  fadeMs?: number;
}

export interface AudioGraph {
  add(id: string, def: GraphNodeDef): void; // throws on a live duplicate id
  remove(id: string): void; // no-op on an unknown id
  replace(id: string, def: GraphNodeDef): void; // keeps connections and taps; throws on unknown id
  connect(from: string, to: GraphTarget): void; // idempotent; throws on unknown id/port or a cycle
  disconnect(from: string, to: GraphTarget): void; // no-op when not connected
  set(id: string, param: string, value: number, rampMs?: number): void; // throws on unknown id/param
  /** Applies in order; each patch calls the method of the same name.
   *  A structural error anywhere in the list throws before anything changes.
   *  A param write that throws is skipped; the rest apply, then its error is rethrown. */
  apply(patches: readonly GraphPatch[]): void;
  /** Start every source now, and every source added later, until `stop`. */
  start(): void;
  /** Fade the graph's output to silence over `fadeMs`, then stop every source. */
  stop(): void;
  playing(): boolean;
  has(id: string): boolean;
  ids(): string[];
  /** Listens to a node's output; survives `replace`; disposed with the node. */
  tap(id: string, opts?: AnalyserTapOptions): AnalyserTap;
  /** Resolves once no fade is in flight. */
  settled(): Promise<void>;
  /** Cancels fades, stops sources, disposes every def and tap, disconnects from the destination.
   *  While it may be sounding on a running context, it first fades the output out over `fadeMs`;
   *  every mutator throws from the call on. */
  dispose(): void;
}
