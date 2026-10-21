import type { Action } from '@weasel-js/routing';

/**
 * Escape mid-drag tells the dispatcher to abort every in-flight handle
 * (`onEnd('cancel')` on each, no scene mutation).
 *
 * Phase-gated to `[*:engaged]` so it fires only when a handle is in flight,
 * leaving the idle-phase `escape` action (clears selection) without conflict.
 */
// No `eligible` field: canceling an in-flight gesture must work in every mode.
export const cancelGestureAction: Action & { requires: string[] } = {
  id: 'cancelGesture',
  label: 'Cancel gesture',
  defaultBinding: [{
    spec: {
      kind: 'key',
      key: 'Escape',
      phase: [{ channel: '*', phase: 'engaged' }],
    },
    opts: { id: 'cancelGesture.key' },
  }],
  requires: ['dispatcher'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const d = deps.dispatcher;
      d?.cancelAll('cancel');
    },
  },
};
