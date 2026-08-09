/**
 * Snapshot of modifier-key state at gesture dispatch.
 *
 * Lives in core rather than beside the gesture types that produce it because
 * `core/selection/chromeState.ts` reads it, and core may not import from
 * `interactions/`. Re-exported from `interactions/gestures/types.ts`, which
 * is still where gesture code names it.
 */
export interface ModifierState {
  alt: boolean;
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
}
