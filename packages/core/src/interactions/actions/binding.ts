/**
 * GestureBinding — connects a GestureSpec to an Action id (with per-binding
 * options). Tools own arrays of these on their `bindings` field; ambient
 * gesture-bindings are registered globally.
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md`.
 */

import type { GestureSpec } from '../gestures/spec';
import type { BindingOpts } from './invoker';

/** An interaction: a gesture spec composed with the id of the action it
 *  invokes. Tools declare arrays of these; the dispatcher matches an incoming
 *  input event against them and runs the winner's action. */
export interface GestureBinding {
  spec: GestureSpec;
  actionId: string;
  opts?: BindingOpts;
}
