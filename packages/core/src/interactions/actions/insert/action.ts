/**
 * `insertAction` — ongoing Action descriptor for drag-to-insert.
 *
 * The drag-rect insert:
 *   - `start`: validates the `insert` dep and records the drag start point.
 *   - `onMove`: tracks the live drag bounds (no scene writes).
 *   - `onEnd('commit')`: derives final bounds from drag.start + drag.current;
 *     calls `deps.insert.commit(bounds, kind)` to materialise the new node.
 *     `kind` comes from `opts.params.kind` (set by the active tool's binding).
 *   - `onEnd('cancel')`: no-op.
 *
 * ## Dependencies
 *
 * Requires `insert` dep from DepSchema:
 *   `{ commit(bounds, kind): NodeId | null }`
 *
 * `<SceneCanvas>` / `<StandardActionsRegistrar>` should source this dep by
 * delegating to the scene's `add()` with a sensible default data payload for
 * the given `kind`. Override per-consumer for custom node factories.
 *
 * ## Modifiers and snapping
 *
 * Grid snapping comes from the optional `snap` dep, applied to the drag's
 * start and current point (never to freehand pencil samples). The `line`
 * kind additionally honors Shift (constrain to 15°) and reads Alt/center as
 * "mirror the start around the pointer" rather than "grow a symmetric AABB".
 * Behaviors from the binding's `opts.behaviors` (`InsertBehavior[]` — e.g.
 * `@weasel-js/guides`' `snapToGrid` and `alignInsertBehavior`) run over the two
 * points after those, the way `moveAction` runs its own: `onStart` on the
 * start point, `onMove` on each frame's proposal, `onEnd` on release, where
 * the first answer wins (`null` aborts, `Op[]` commits in place of the
 * insert). `nextFrame` folds them each pump event and `insertShape`
 * reads the result, so the live preview and the committed node can't
 * disagree.
 *
 * ## What this does not wire
 *
 * - `pointInsert` fallback for click / sub-threshold drags — not wired; a
 *   sub-threshold drag produces no insert.
 * - `clickOnly` mode — not applicable to the descriptor model.
 *
 * ## Live preview
 *
 * Insert produces a brand-new node that has no scene id until commit, so
 * the preview-ghost layer (`usePreviewGhostLayer`, keyed by node id) can't
 * paint a silhouette for it. Instead, the action exposes its in-flight
 * geometry via the `overlay()` surface with `kind: 'insertPreview'`. The
 * canvas's `useDispatcherOverlayLayer` rebuilds the shape using the same
 * path builders the commit-time factory uses (`rectPath`, `ellipsePath`,
 * `linePath`, `regularPolygonPath`, `starPath`, polyline / `polygonFromPoints`),
 * so the preview is geometry-faithful to the eventual node.
 *
 * Consumer-defined insert kinds (kinds the kit doesn't know how to draw)
 * skip the preview but still commit normally on release.
 */


import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle, BindingOpts, OngoingOverlay } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
import { shapeKindInfo } from 'core/shapeKinds';
import type { KitInsertShape } from 'core/shapeKinds';
import { runBehaviorSettled } from '../gestureLifecycle';
import { inPlane, insertLayer } from '../planeInput';
import { cancelInsert, commitInsert } from './commit';
import { nextFrame } from './frame';
import type { InsertLiveGesture } from './live';
import { beginInsert } from './session';
import { insertKind, insertShape } from './shape';

/**
 * @experimental
 * Static descriptor for the `insert` Action.
 *
 * Requires dep-schema entry: `insert`.
 * Node `kind` is read from `opts.params.kind`; defaults to `'rect'` when absent.
 *
 * @see useInsert — the React hook this descriptor mirrors for the simple case.
 */
export const insertAction: Action & { requires: string[] } = inPlane({
  id: 'insert',
  label: 'Insert',
  group: 'insert',
  eligible: { capability: 'creates-shapes' },
  requires: ['insert', 'insertLive', 'selection', 'snap', 'textEdit', 'scene', 'applyOps', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const begun = beginInsert(ctx, opts);
      if (!begun) return {};
      const { session, readers } = begun;
      let frame = begun.frame;
      const gesture: InsertLiveGesture = { open: true, userRotation: 0 };
      const live = ctx.deps.insertLive;
      if (live) live.gesture = gesture;

      return {
        kind: 'insert',
        onMove(moveCtx: InvocationCtx): void {
          frame = nextFrame(session, readers, frame, moveCtx);
        },
        overlay(): OngoingOverlay | null {
          if (!gesture.open) return null;
          // Resolve params on every overlay() so thunked params (polygon
          // sides ticking via ArrowUp mid-drag) reflect in the live preview.
          const resolved = resolveParams(session.opts?.params);
          // Consumer-defined kinds aren't renderable by the kit overlay —
          // skip the preview rather than emit something half-faithful.
          if (!shapeKindInfo(insertKind(resolved))?.insertPreview) return null;
          const { bounds, extras, start } = insertShape(resolved, frame, frame.points, gesture.userRotation);
          return {
            kind: 'insertPreview',
            shape: extras.kind as KitInsertShape,
            bounds,
            extras,
            // Anchor dot at the click point — chrome that sells "this
            // is where the drag started." Useful for radial shapes
            // (no vertex at click) and for center mode (dot marks the
            // growth axis).
            anchorPoint: { x: start.x, y: start.y },
          };
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          gesture.open = false;
          if (live?.gesture === gesture) live.gesture = null;
          let committed = false;
          try {
            if (reason === 'cancel') cancelInsert(session);
            else committed = commitInsert(session, frame, endCtx.drag?.points ?? frame.points, gesture.userRotation);
          } finally {
            runBehaviorSettled(session.behaviors, session.gestureCtx, committed);
          }
        },
      };
    },
  },
  /**
   * Insert is always available — no selection required. Returns `true` so the
   * dispatcher allows the action through on every drag-on-empty gesture.
   *
   * Fixed from the stale `ActionDisabledReason.SelectionRequired`
   * placeholder that was silently blocking all dispatcher-routed inserts.
   */
  enabled: () => true as const,
}, insertLayer);
