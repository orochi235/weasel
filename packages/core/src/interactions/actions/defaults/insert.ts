/**
 * `insertAction` — ongoing Action descriptor for drag-to-insert.
 *
 * ## Status: REAL
 *
 * Implements the drag-rect insert logic from `useInsert`:
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
 * All of it resolves in `resolveEndpoints`, which both `overlay()` and
 * `onEnd()` call — so the live preview and the committed node can't disagree.
 *
 * ## What this does NOT wire (vs `useInsert`)
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
 *
 * ## Relationship to `useInsert`
 *
 * `useInsert` calls `adapter.commitInsert(bounds)` which returns a node and
 * dispatches a `createInsertOp`. This descriptor delegates to `deps.insert.commit`
 * which encapsulates both factory + op dispatch in one call. This keeps the
 * dep contract thin and avoids importing `createInsertOp` into the descriptor.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle, BindingOpts, OngoingOverlay, DragSample } from '../invoker';
import { resolveParams } from '../invoker';
import type { InsertDep, InsertExtras, SnapDep } from '../depSchema';
import type { TextEditDep } from './enterTextEdit';
import type { SelectionApi } from 'core/selection/useSelection';

/** The kit's built-in insert kinds — those the dispatcher overlay layer
 *  knows how to render. Consumer-defined kinds fall through to `null`
 *  (no live preview, but commit still works). */
const KIT_INSERT_KINDS = new Set([
  'rect', 'ellipse', 'line', 'polygon', 'star', 'pencil', 'image',
]);

type KitInsertShape = 'rect' | 'ellipse' | 'line' | 'polygon' | 'star' | 'pencil' | 'image';

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface InsertScratch {
  dep: InsertDep;
  /** Text-edit dep captured at gesture start, for the text kind's
   *  drop-into-the-caret step. Stashed rather than read at commit because
   *  the dispatcher only builds the deps bag once, on `start` — every later
   *  pump event carries `deps: {}`. */
  textEdit: TextEditDep | undefined;
  /** World-space point snapper from the `snap` dep, or identity when the
   *  dep isn't registered. Applied to the drag's start and current point so
   *  the live preview and the committed geometry agree. Freehand pencil
   *  samples are deliberately NOT snapped — a grid-quantized freehand trail
   *  is a staircase, not a stroke. */
  snap: (p: { x: number; y: number }) => { x: number; y: number };
  /** The active binding's opts — re-resolved at commit time so thunked
   *  params see the latest tool state (e.g. polygon `sides` after ArrowUp). */
  opts: BindingOpts | undefined;
  /** RAW (unsnapped) drag endpoints in world space. Snapping and the
   *  line tool's Shift-constrain are applied together in `resolveEndpoints`
   *  at read time, so the documented modifier ordering — constrain the
   *  angle first, THEN align the endpoint to the grid — holds for both the
   *  live preview and the commit. */
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  /** Pointer trail accumulated by the dispatcher in world space. Same array
   *  reference as `ctx.drag.points`; pencil-kind commits read from this. */
  points: ReadonlyArray<DragSample> | null;
  /** Live Alt-key state from the most recent pump event. Alt INVERTS the
   *  binding's nominal `originMode` (corner → center and vice versa), so
   *  the user can press / release Alt mid-drag and the preview/commit
   *  flip without needing the dispatcher to re-route to a different
   *  binding. Captured per-onMove from `ctx.modifiers.alt`. */
  altHeld: boolean;
  /** Live Shift-key state from the most recent pump event. Constrains the
   *  `line` kind to 15° increments (the modifier the line tool documents).
   *  Captured per-onMove from `ctx.modifiers.shift`. */
  shiftHeld: boolean;
  /** Cleared once `onEnd` runs so subsequent `overlay()` calls report no
   *  in-flight preview (mirrors the areaSelect/lasso convention). */
  open: boolean;
  /** Accumulated user-driven rotation (radians) layered on top of any
   *  drag-direction / params rotation. Driven by `insert.adjustRotation`
   *  (Shift+wheel during engaged phase). Only consulted for kinds that
   *  carry a `rotation` field on their extras (star / polygon today). */
  userRotation: number;
}

// Module-scoped pointer to the in-flight insert scratch. There is at most
// one insert gesture at a time (single primary pointer) so a single ref
// is sufficient. `insert.adjustRotation` reads this to mutate the live
// scratch without needing handle-passing plumbing through the dispatcher.
let liveInsertScratch: InsertScratch | null = null;

/** Resolve the effective origin mode from the binding's nominal opt
 *  and live Alt state. Alt inverts: `corner` ⇄ `center`. Applies to
 *  every shape kind — radial shapes (polygon/star) included; the
 *  overlay paints an `anchorPoint` dot at the click so corner mode
 *  reads as anchored even though no polygon vertex sits there.
 */
function effectiveOriginMode(
  paramsOrigin: unknown,
  altHeld: boolean,
): 'corner' | 'center' {
  const nominal: 'corner' | 'center' = paramsOrigin === 'center' ? 'center' : 'corner';
  if (!altHeld) return nominal;
  return nominal === 'center' ? 'corner' : 'center';
}

/** Compute the insert AABB from drag endpoints.
 *  - `'corner'` (default): bounds = drag rect (top-left → bottom-right of cursor sweep).
 *  - `'center'`: bounds = symmetric AABB anchored on the start point.
 *    Used when the tool's Alt-modifier binding passes
 *    `originMode: 'center'` (Illustrator/Figma convention). */
function computeBounds(
  startX: number, startY: number,
  currentX: number, currentY: number,
  originMode: 'corner' | 'center',
): { x: number; y: number; width: number; height: number } {
  if (originMode === 'center') {
    const dx = Math.abs(currentX - startX);
    const dy = Math.abs(currentY - startY);
    return { x: startX - dx, y: startY - dy, width: dx * 2, height: dy * 2 };
  }
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

/** Constrain `end` to the nearest 15° increment around `start`, preserving
 *  the drag length. The line tool's documented Shift behavior. */
function snapTo15Degrees(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { x: number; y: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return end;
  const step = Math.PI / 12; // 15°
  const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: start.x + len * Math.cos(snapped), y: start.y + len * Math.sin(snapped) };
}

/**
 * Resolve the effective drag endpoints from the raw ones, applying (in
 * order): the line tool's Shift-constrain, the `snap` dep, and — for the
 * `line` kind only — the alt/center reading as "mirror the end around the
 * start" rather than "grow a symmetric AABB".
 *
 * Every geometry consumer (bounds, extras, preview) goes through this, so
 * the live overlay and the committed node can't disagree.
 */
function resolveEndpoints(
  scratch: InsertScratch,
  kind: string,
  mode: 'corner' | 'center',
): { startX: number; startY: number; currentX: number; currentY: number } {
  let start = { x: scratch.startX, y: scratch.startY };
  let current = { x: scratch.currentX, y: scratch.currentY };

  // Constrain on RAW coords so the user's intent (lock the angle) survives,
  // then align the resulting endpoint to the grid.
  if (kind === 'line' && scratch.shiftHeld) current = snapTo15Degrees(start, current);

  start = scratch.snap(start);
  current = scratch.snap(current);

  // A line has no area, so "from center" means the drag is a half-line:
  // mirror the start to the far side of the pointer.
  if (kind === 'line' && mode === 'center') {
    start = { x: start.x - (current.x - start.x), y: start.y - (current.y - start.y) };
  }

  return { startX: start.x, startY: start.y, currentX: current.x, currentY: current.y };
}

/** Build a typed `InsertExtras` from the static params + gesture context.
 *  Kit-built-in kinds (line / polygon / star / pencil) read kind-specific
 *  fields; unknown kinds pass the raw params through as `{ kind, ... }`. */
function buildExtras(
  params: Record<string, unknown> | undefined,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  points: ReadonlyArray<DragSample> | null,
): InsertExtras {
  const kind = ((params?.['kind'] as string | undefined) ?? 'rect');
  switch (kind) {
    case 'rect':
    case 'ellipse':
      return { kind } as InsertExtras;
    case 'line':
      // Use the live drag endpoints (not AABB) so the line preserves the
      // user's drag direction — drag from bottom-left to top-right makes a
      // line that slopes up, not the bounds diagonal.
      return { kind: 'line', a: { x: startX, y: startY }, b: { x: currentX, y: currentY } };
    case 'polygon': {
      const sides = Number(params?.['sides'] ?? 6);
      // When the tool omits rotation, point the first vertex along the
      // drag vector so dragging in a direction orients the shape that
      // way. Sub-pixel drags (no direction yet) fall back to 0.
      const dragAngle = (currentX === startX && currentY === startY)
        ? 0
        : Math.atan2(currentY - startY, currentX - startX);
      const rotation = params?.['rotation'] !== undefined
        ? Number(params['rotation'])
        : dragAngle;
      const extras: InsertExtras = { kind: 'polygon', sides, rotation };
      // Drag-from-center: tool's Alt binding passes `originMode:'center'`.
      // Compute polygon center + radius from the drag vector so the shape
      // anchors on the click point. Without this, the dep falls back to
      // inscribing in the AABB (drag-from-corner default).
      if (params?.['originMode'] === 'center') {
        const dx = currentX - startX;
        const dy = currentY - startY;
        (extras as { center?: unknown }).center = { x: startX, y: startY };
        (extras as { radius?: unknown }).radius = Math.hypot(dx, dy);
      } else {
        if (params?.['center'] !== undefined) (extras as { center?: unknown }).center = params['center'];
        if (params?.['radius'] !== undefined) (extras as { radius?: unknown }).radius = params['radius'];
      }
      return extras;
    }
    case 'star': {
      const pts = Number(params?.['points'] ?? 5);
      const ir = Number(params?.['innerRadiusRatio'] ?? 0.5);
      const dragAngle = (currentX === startX && currentY === startY)
        ? 0
        : Math.atan2(currentY - startY, currentX - startX);
      const rotation = params?.['rotation'] !== undefined
        ? Number(params['rotation'])
        : dragAngle;
      const extras: InsertExtras = { kind: 'star', points: pts, innerRadiusRatio: ir, rotation };
      if (params?.['originMode'] === 'center') {
        const dx = currentX - startX;
        const dy = currentY - startY;
        (extras as { center?: unknown }).center = { x: startX, y: startY };
        (extras as { outerRadius?: unknown }).outerRadius = Math.hypot(dx, dy);
      } else {
        if (params?.['center'] !== undefined) (extras as { center?: unknown }).center = params['center'];
        if (params?.['outerRadius'] !== undefined) (extras as { outerRadius?: unknown }).outerRadius = params['outerRadius'];
      }
      return extras;
    }
    case 'pencil':
      // Prefer tool-supplied samples (param) when present — pencil tools may
      // capture richer per-sample data (pressure/tilt). Fall back to the
      // dispatcher's accumulated pointer trail.
      return {
        kind: 'pencil',
        samples: (params?.['samples'] as ReadonlyArray<DragSample> | undefined)
          ?? points
          ?? [],
      };
    default:
      // Consumer-defined kind: pass everything through so a custom insert
      // dep can read its own fields.
      return { ...(params ?? {}), kind } as InsertExtras;
  }
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `insert` Action.
 *
 * Requires dep-schema entry: `insert`.
 * Node `kind` is read from `opts.params.kind`; defaults to `'rect'` when absent.
 *
 * @see useInsert — the React hook this descriptor mirrors for the simple case.
 */
export const insertAction: Action & { requires: string[] } = {
  id: 'insert',
  label: 'Insert',
  group: 'insert',
  defaultBinding: { kind: 'drag' },
  eligible: { capability: 'creates-shapes' },
  requires: ['insert', 'selection', 'snap', 'textEdit'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const dep = ctx.deps.insert as InsertDep | undefined;
      if (!dep) return {};

      // Starting a draw retires any prior selection — the lingering halo
      // around an unrelated node while the user is drawing a new shape is
      // just visual noise, and it primes the UX bug where a drag that
      // continues over the selected node would otherwise drive the move
      // action via fall-through. The clear is unconditional: the user has
      // committed to "I'm making a new thing" by engaging a creation tool.
      const selection = ctx.deps.selection as SelectionApi | undefined;
      if (selection && selection.get().length > 0) {
        selection.clear();
      }

      const snapDep = ctx.deps.snap as SnapDep | undefined;
      const snap = snapDep
        ? (p: { x: number; y: number }) => snapDep.point(p)
        : (p: { x: number; y: number }) => p;
      const scratch: InsertScratch = {
        dep,
        textEdit: ctx.deps.textEdit as TextEditDep | undefined,
        snap,
        opts,
        startX: ctx.world.x,
        startY: ctx.world.y,
        currentX: ctx.world.x,
        currentY: ctx.world.y,
        points: ctx.drag?.points ?? null,
        altHeld: ctx.modifiers.alt,
        shiftHeld: ctx.modifiers.shift,
        open: true,
        userRotation: 0,
      };
      liveInsertScratch = scratch;

      return {
        kind: 'insert',
        onMove(moveCtx: InvocationCtx): void {
          scratch.currentX = moveCtx.world.x;
          scratch.currentY = moveCtx.world.y;
          scratch.shiftHeld = moveCtx.modifiers.shift;
          // Track live Alt state for the corner ⇄ center toggle. Each
          // pointermove carries fresh modifier state from the dispatcher;
          // releasing / pressing Alt mid-drag flips the bounds mode on
          // the next move tick (true modifier-only events don't fire
          // without a cursor change).
          scratch.altHeld = moveCtx.modifiers.alt;
          // The dispatcher mutates its own per-gesture trail in place but
          // attaches the array reference to each InvocationCtx.drag — keep
          // the latest reference in case the dispatcher swaps it.
          if (moveCtx.drag?.points) scratch.points = moveCtx.drag.points;
        },
        overlay(): OngoingOverlay | null {
          if (!scratch.open) return null;
          // Resolve params on every overlay() so thunked params (polygon
          // sides ticking via ArrowUp mid-drag) reflect in the live preview.
          const resolved = resolveParams(scratch.opts?.params);
          const kind = (resolved?.['kind'] as string | undefined) ?? 'rect';
          // Consumer-defined kinds aren't renderable by the kit overlay —
          // skip the preview rather than emit something half-faithful.
          if (!KIT_INSERT_KINDS.has(kind)) return null;
          const mode = effectiveOriginMode(resolved?.['originMode'], scratch.altHeld);
          const pts = resolveEndpoints(scratch, kind, mode);
          const bounds = computeBounds(
            pts.startX, pts.startY, pts.currentX, pts.currentY, mode,
          );
          // Derive extras with the *effective* mode so polygon/star
          // center+radius reflect the live Alt toggle, not the binding's
          // nominal originMode.
          const effectiveExtras = buildExtras(
            { ...(resolved ?? {}), originMode: mode },
            pts.startX, pts.startY, pts.currentX, pts.currentY,
            scratch.points,
          );
          applyUserRotation(effectiveExtras, scratch.userRotation);
          return {
            kind: 'insertPreview',
            shape: effectiveExtras.kind as KitInsertShape,
            bounds,
            extras: effectiveExtras,
            // Anchor dot at the click point — chrome that sells "this
            // is where the drag started." Useful for radial shapes
            // (no vertex at click) and for center mode (dot marks the
            // growth axis).
            anchorPoint: { x: pts.startX, y: pts.startY },
          };
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          scratch.open = false;
          if (liveInsertScratch === scratch) liveInsertScratch = null;
          if (reason === 'cancel') return;

          const { dep: d, opts: o } = scratch;
          const points = endCtx.drag?.points ?? scratch.points;

          // Resolve params at commit time so thunked params (polygon
          // `sides` adjusted mid-drag, etc.) see the latest tool state.
          const resolved = resolveParams(o?.params);
          const kind = (resolved?.['kind'] as string | undefined) ?? 'rect';
          const mode = effectiveOriginMode(resolved?.['originMode'], scratch.altHeld);
          const { startX, startY, currentX, currentY } = resolveEndpoints(scratch, kind, mode);
          const bounds = computeBounds(startX, startY, currentX, currentY, mode);
          const extras = buildExtras(
            { ...(resolved ?? {}), originMode: mode },
            startX, startY, currentX, currentY, points,
          );
          applyUserRotation(extras, scratch.userRotation);

          // Sub-threshold drag — no insert. The test is kind-aware because
          // "zero size" isn't one shape:
          //  - pencil: a sample trail can be meaningful even when start ≈ end
          //    (a closed loop), so no guard at all.
          //  - line: has no area by construction. An axis-aligned line has a
          //    zero-height (or zero-width) AABB and is perfectly valid — only
          //    a zero-LENGTH drag is degenerate. (Shift-constrain makes
          //    axis-aligned the common case, which is how this surfaced.)
          //  - everything else: a zero extent in either axis is degenerate.
          if (!isCommittableExtent(bounds, extras.kind)) return;

          const id = d.commit(bounds, extras);

          // A freshly dragged text box is empty, so it draws nothing and the
          // tool's own `click on selected body → enterTextEdit` binding has
          // nothing visible to click. Drop straight into the caret instead —
          // which is also what every other editor does with a text tool.
          // `textEdit` is optional: without it the box is still committed,
          // exactly as before.
          //
          // Read from the scratch, not `endCtx.deps`: the dispatcher builds
          // the deps bag once, at `start`, and passes `deps: {}` on every
          // later pump event. Same reason the insert dep itself is stashed.
          if (id !== null && extras.kind === 'text') {
            scratch.textEdit?.startEdit(String(id), { caret: 0 });
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
};

/** Whether a drag produced enough extent to be worth committing, per kind.
 *  See the call site in `onEnd` for why this isn't one uniform test. */
function isCommittableExtent(
  bounds: { width: number; height: number },
  kind: string,
): boolean {
  if (kind === 'pencil') return true;
  if (kind === 'line') return bounds.width !== 0 || bounds.height !== 0;
  return bounds.width !== 0 && bounds.height !== 0;
}

/** Add a user-driven rotation offset onto kinds that carry rotation. Rect
 *  / ellipse / line / pencil don't expose a rotation field on their
 *  extras today, so they ignore the offset. */
function applyUserRotation(extras: InsertExtras, userRotation: number): void {
  if (userRotation === 0) return;
  if (extras.kind === 'star' || extras.kind === 'polygon') {
    (extras as { rotation: number }).rotation += userRotation;
  }
}

/** Radians per unit of wheel deltaY. Tuned so a typical mouse-wheel click
 *  (deltaY ≈ 100) yields ~25°, while a trackpad event (deltaY ≈ 1–10)
 *  yields a smooth 0.25–2.5° increment. */
const ROTATION_SENSITIVITY = Math.PI / 720;

/**
 * @experimental
 * Companion to `insertAction` — adjusts the live insert gesture's
 * `userRotation` based on wheel deltaY. Intended to be bound to
 * Shift+wheel during the insert tool's engaged phase. No-op when no
 * insert is in flight.
 */
export const insertRotateAction: Action = {
  id: 'insert.adjustRotation',
  label: 'Insert — rotate',
  group: 'insert',
  eligible: { capability: 'creates-shapes' },
  invoker: {
    timing: 'immediate' as const,
    run: (_deps, params) => {
      const scratch = liveInsertScratch;
      if (!scratch || !scratch.open) return;
      const deltaY = (params as { deltaY?: number } | undefined)?.deltaY ?? 0;
      if (deltaY === 0) return;
      scratch.userRotation += deltaY * ROTATION_SENSITIVITY;
    },
  },
};
