import type { Action } from '../registry';

/**
 * @experimental
 * Static descriptor for the `cancelGesture` Action — Escape mid-drag
 * tells the dispatcher to abort every in-flight handle (`onEnd('cancel')`
 * on each, scratch discarded, no scene mutation).
 *
 * Phase-gated to `[*:engaged]` so it fires only when at least one tool
 * has a handle in flight; the unmodified `escape` action retains its
 * idle-phase binding (clears selection) without conflict.
 */
// No `eligible` field → always eligible. Cancelling an in-flight gesture
// must work regardless of mode.
export const cancelGestureAction: Action & { requires: string[] } = {
  id: 'cancelGesture',
  label: 'Cancel gesture',
  defaultBinding: {
    kind: 'key',
    key: 'Escape',
    phase: [{ channel: '*', phase: 'engaged' }],
  },
  requires: ['dispatcher'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const d = deps.dispatcher as { cancelAll(reason: 'commit' | 'cancel'): void } | undefined;
      d?.cancelAll('cancel');
    },
  },
};
