/**
 * `cloneAction` — ongoing Action descriptor for alt-drag clone (Phase 7).
 *
 * ## Status: STUBBED — Phase 7 shape only
 *
 * The descriptor is registered and structurally correct. The invoker.start
 * body is a deliberate no-op stub. Full wiring is deferred to Phase 8+.
 *
 * ## Why stubbed
 *
 * `useClone` drives cloning through:
 *   - `CloneBehavior.activates(mods)` — behavior decides whether alt-drag
 *     activates cloning vs plain move (modifier-gated entry)
 *   - `adapter.snapshotSelection(ids)` — captures a serialized copy of the
 *     selected nodes at drag start (for overlay rendering + final insert)
 *   - Per-frame overlay via `setOverlay(layer, objects)` / `clearOverlay()`
 *     (a React callback in the hook; has no equivalent in descriptor model yet)
 *   - On commit: `CloneBehavior.onEnd(pose, { adapter })` → `Op[]` → dispatch
 *
 * The key gaps for the descriptor model:
 * 1. `adapter.snapshotSelection` is typed to `InsertAdapter<T>` — not in
 *    `DepRegistry` surface.
 * 2. The overlay callbacks (`setOverlay`, `clearOverlay`) are wired to React
 *    state in the hook; the descriptor has no overlay surface yet.
 * 3. `CloneBehavior` selection (which behavior activates) is modifier-gated at
 *    gesture-start — the descriptor would need a dep-schema entry for the
 *    behavior list or a fixed alt-only binding.
 *
 * TODO: Phase 8+ wires the invoker body — currently a no-op stub.
 * Expected additions:
 * - `DepRegistry` entry for `InsertAdapter` (or a `cloneAdapter` dep)
 * - Overlay surface for the descriptor layer (ghost rendering during drag)
 * - Modifier-gated gestureBinding (alt+drag discriminant) in dispatcher
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `clone` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * The invoker is `ongoing` but the body is a no-op stub pending Phase 8
 * dispatcher additions (InsertAdapter dep, overlay surface, modifier-gated
 * gestureBinding for alt-drag discrimination).
 *
 * @see useClone — the React hook this descriptor will mirror.
 */
export const cloneAction: Action & { requires: string[] } = {
  id: 'clone',
  label: 'Clone',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    start(_ctx: InvocationCtx, _opts): OngoingHandle {
      // TODO: Phase 8+ wires the invoker body — currently a no-op stub.
      // Requires InsertAdapter dep, overlay surface, and CloneBehavior
      // list from a dep or gestureBinding opts.
      return {};
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
