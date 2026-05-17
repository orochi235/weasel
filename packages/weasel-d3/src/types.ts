import type { NodeId } from '@orochi235/weasel';

export interface BindOptions<TData> {
  /** Stable id derivation per datum — the binding diffs old vs new state by this key. */
  key: (d: TData, i: number) => string;
  /** Which scene layer new leaves enter on. Defaults to the scene's first system layer. */
  layer?: string;
}

/**
 * Builder produced by `d3Bind`. Configure with `.pose()` / `.data()` / `.enterFrom()`,
 * then call `.join()` to emit the diff as one batched scene mutation and receive
 * a chainable `D3Selection`.
 */
export interface D3Binding<TData, TPose> {
  /** Per-datum pose. Called for both enter (initial scene pose) and update (target). */
  pose(fn: (d: TData, i: number) => TPose): this;

  /** Per-datum data payload. Replaces the leaf's existing data on update. */
  data(fn: (d: TData, i: number) => Record<string, unknown>): this;

  /** Optional initial pose for ENTER nodes — `.transition()` will animate from this
   *  to the declared `.pose()`. Defaults to the same pose (entries snap in). */
  enterFrom(fn: (d: TData, i: number) => TPose): this;

  /** Emit the diff against the scene as one batched op group. Returns the merged
   *  selection (enter + update). Order of the selection matches the order of the
   *  bound `data` array. */
  join(): D3Selection<TData, TPose>;
}

/**
 * The bound, post-join set of leaves. Carries per-node prior poses (used by
 * `.transition()` to compute the tween `from`) and a stable id-per-datum mapping.
 */
export interface D3Selection<TData, TPose> {
  /** Node ids in the same order as the bound data. */
  readonly ids: readonly NodeId[];
  /** Bound data, in registration order. */
  readonly data: readonly TData[];

  /** Filter to a subset by predicate. The returned selection retains the prior
   *  poses for transition purposes. */
  filter(pred: (d: TData, i: number) => boolean): D3Selection<TData, TPose>;

  /** Iterate. Returns this for chaining. */
  each(fn: (d: TData, id: NodeId, i: number) => void): this;

  /** Spawn a transition (Phase 2 — placeholder for now; throws). */
  transition(name?: string): D3Transition<TData, TPose>;

  /** Cancel any in-flight transitions matching `name` (or all if omitted) on these nodes. */
  interrupt(name?: string): this;
}

/** Transition handle — Phase 2 contract (implementation lands later). */
export interface D3Transition<TData, TPose> {
  duration(ms: number): this;
  ease(fn: (t: number) => number): this;
  delay(ms: number | ((d: TData, i: number) => number)): this;
  tween<TValue>(opts: {
    name: string;
    from: (d: TData, i: number) => TValue;
    to: (d: TData, i: number) => TValue;
    interpolate?: (from: TValue, to: TValue) => (t: number) => TValue;
    apply: (d: TData, id: NodeId, value: TValue) => void;
  }): this;
  on(event: 'start' | 'end' | 'interrupt', fn: () => void): this;
  end(): Promise<void>;
  interrupt(): void;
}
