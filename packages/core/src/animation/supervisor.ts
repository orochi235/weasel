/**
 * Supervisor: an internal capability exposed by `useAnimator` to composite
 * primitives (loop / stagger) so they can sit in the animator's id table
 * without being a "real" animation. A supervisor's tick is a no-op — it
 * never completes naturally; only its `cancel()` removes it from the
 * registry. The owning composite installs `setOnCancel` to tear down its
 * children (in-flight handles, pending timers) when external cancel fires
 * (`animator.cancel(handle)`, `animator.cancelKey(key)`).
 *
 * Not part of the public Animator surface. Passed in at bind time, the
 * same way `staggerTimers` is.
 */
export interface Supervisor {
  id: number;
  cancel(): void;
  pause(): void;
  resume(): void;
  setTimeScale(s: number): void;
  timeScale(): number;
  isPaused(): boolean;
  setOnCancel(cb: () => void): void;
  cancelKey?: string;
}

export type SupervisorFactory = (cancelKey?: string) => Supervisor;

/**
 * Subscribe to "this animation id finished or was cancelled and is no longer
 * in the registry." Returns an unsubscribe. Fires at most once. Used by
 * stagger to detect natural completion of children so the supervising
 * composite can retire itself when the last child finishes.
 *
 * Implementation detail: fires for both natural completion (tick returned
 * true) and external cancel — the stagger composite tolerates this because
 * its cancel path is idempotent and a cancelled supervisor will already be
 * marked finished.
 */
export type WatchCompletion = (id: number, cb: () => void) => () => void;
