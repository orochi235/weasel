/**
 * affordanceAt — chrome-state-based affordance classifier for SceneCanvas.
 *
 * Walks the current selection's corner handles + rotation handle and
 * returns an `AffordanceHit` when the pointer lands within hit radius,
 * or `null` when it's on open canvas / a scene body.
 *
 * Used by `GestureDispatcherMounter` (SceneCanvas) to populate
 * `InputEvent.pointerdown.affordance` so `resizeAction` / `rotateAction`
 * invokers can guard on affordance kind.
 *
 * Phase 13: only unrotated single-selection handles are classified. Rotated
 * handle positions require rotating the corner around the AABB center —
 * see rotationHandle.ts for the rotation math. Multi-selection resize uses
 * `unionBounds` (same corners, same radius).
 */

import type { ChromeState, Bounds } from 'core/selection/chromeState';
import type { AffordanceHit } from 'interactions/actions/invoker';
import type { ResizeAnchor } from 'interactions/gestures/types';
import { DEFAULT_ROTATION_HANDLE_DISTANCE } from 'interactions/actions/rotate/handle';
import { MULTI_RESIZE_TARGET_ID } from 'tools/builtin/useSelectTool';
import { hitAnchor } from 'interactions/actions/edit-anchors/handles';
import { enumerateAnchors } from 'interactions/actions/edit-anchors/geometry';
import type { PolygonPath } from 'features/paths/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default hit-test radius in world units. Mirrors DEFAULT_HANDLE_SIZE from
 *  SceneCanvas (8px CSS). In world units at scale=1 these are equivalent;
 *  at other scales the world-unit radius keeps affordances easy to grab. */
export const HANDLE_HIT_RADIUS = 8;

/** Hit-test radius for anchor and control-handle points in world units.
 *  Mirrors `useEditAnchors` default (`hitRadius = 8`). */
export const ANCHOR_HIT_RADIUS = 8;

/** Default rotation-handle distance from the top edge of the selection bounds
 *  in world units. Mirrors DEFAULT_ROTATION_HANDLE_DISTANCE (24). */
const ROTATE_DISTANCE = DEFAULT_ROTATION_HANDLE_DISTANCE;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Squared distance from a point to another point. */
function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Rotate (px, py) around (cx, cy) by `rotation` radians. */
function rotateAround(
  px: number, py: number,
  cx: number, cy: number,
  rotation: number,
): { x: number; y: number } {
  if (rotation === 0) return { x: px, y: py };
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + cos * dx - sin * dy, y: cy + sin * dx + cos * dy };
}

/** Bounds + id of the target to hit-test affordances against. */
interface ResizeTarget {
  id: string;
  bounds: Bounds;
}

/** Pick the resize target: multi-selection → union bounds, single → own bounds. */
function pickResizeTarget(state: ChromeState): ResizeTarget | null {
  if (state.multiActive && state.unionBounds) {
    return { id: MULTI_RESIZE_TARGET_ID, bounds: state.unionBounds };
  }
  if (state.selection.length === 1) {
    const id = state.selection[0];
    const b = state.boundsOf(id);
    return b ? { id, bounds: b } : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Corner descriptors — (corner world position, handle kind, fixed-point)
// ---------------------------------------------------------------------------

interface CornerDesc {
  worldX: number;
  worldY: number;
  kind: string;
  /** Which corner stays fixed during the resize. Mirrors the convention in
   *  `cornerResizeHandles`: 'min'/'max' identifies the FIXED edge, the
   *  dragged corner is diagonally opposite. */
  anchor: ResizeAnchor;
  /** Fixed point (diagonally opposite corner) — world coords. */
  fixedX: number;
  fixedY: number;
}

function cornersFor(b: Bounds): CornerDesc[] {
  const { x, y, width, height, rotation = 0 } = b;
  const cx = x + width / 2;
  const cy = y + height / 2;

  // Raw (unrotated) corners, their fixed opposites, and the corresponding
  // ResizeAnchor. Anchor convention (matches `anchorFromHandleKind` in
  // resize.ts and `cornerResizeHandles`): the anchor names the FIXED corner.
  //   top-left dragged    → bottom-right fixed → { x:'max', y:'max' }
  //   top-right dragged   → bottom-left fixed  → { x:'min', y:'max' }
  //   bottom-left dragged → top-right fixed    → { x:'max', y:'min' }
  //   bottom-right dragged→ top-left fixed     → { x:'min', y:'min' }
  const raw: {
    lx: number; ly: number; kind: string;
    anchor: ResizeAnchor; fx: number; fy: number;
  }[] = [
    { lx: x,           ly: y,           kind: 'handle:top-left',     anchor: { x: 'max', y: 'max' }, fx: x + width, fy: y + height },
    { lx: x + width,   ly: y,           kind: 'handle:top-right',    anchor: { x: 'min', y: 'max' }, fx: x,         fy: y + height },
    { lx: x,           ly: y + height,  kind: 'handle:bottom-left',  anchor: { x: 'max', y: 'min' }, fx: x + width, fy: y          },
    { lx: x + width,   ly: y + height,  kind: 'handle:bottom-right', anchor: { x: 'min', y: 'min' }, fx: x,         fy: y          },
  ];

  return raw.map(({ lx, ly, kind, anchor, fx, fy }) => {
    const wp = rotateAround(lx, ly, cx, cy, rotation);
    const fp = rotateAround(fx, fy, cx, cy, rotation);
    return { worldX: wp.x, worldY: wp.y, kind, anchor, fixedX: fp.x, fixedY: fp.y };
  });
}

// ---------------------------------------------------------------------------
// Anchor state thunk
// ---------------------------------------------------------------------------

/**
 * Optional live state for anchor-handle hit-testing. When provided to
 * `buildAffordanceAt`, the returned classifier will also test anchor points
 * (and, when a path is in edit mode, its control handles) on selected paths.
 *
 * The thunk is called on every pointer event, so it must be cheap (O(1)
 * field reads). Pose enumeration happens inside the classifier only when
 * the caller lands on a path node.
 */
export interface AnchorState {
  /**
   * Id of the path currently in anchor-edit mode, or `null` when no path is
   * being edited. When non-null, control handles (controlIn / controlOut) are
   * hit-testable in addition to anchor points.
   */
  editingId: string | null;
  /**
   * Return the current pose for the given node id. The classifier only calls
   * this for selected polygon paths. Non-polygon return values are ignored.
   */
  getPose(id: string): unknown;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the `affordanceAt` thunk for `GestureDispatcherMounter`.
 *
 * Returns a function: `(worldPoint) => AffordanceHit | null`.
 *
 * The returned thunk is called with a **world-space** point. Callers
 * (currently `GestureDispatcherMounter` inside SceneCanvas) are
 * responsible for converting client/screen coords to world space before
 * calling it.
 *
 * @param getChromeState - Returns the live ChromeState at call time.
 *   Should always reflect current selection + effective bounds (including
 *   in-flight move/resize ghost poses).
 * @param hitRadius - World-unit hit radius for corner handles and anchor
 *   handles (default 8).
 * @param rotateDistance - World-unit distance above top edge for rotation
 *   handle (default DEFAULT_ROTATION_HANDLE_DISTANCE = 24).
 * @param getAnchorState - Optional thunk returning anchor-editing state.
 *   When provided, the classifier also walks selected polygon paths for
 *   anchor hits. Anchors are always hittable on selected paths; control
 *   handles are only hittable when `editingId` matches the node id.
 */
export function buildAffordanceAt(
  getChromeState: () => ChromeState,
  hitRadius: number = HANDLE_HIT_RADIUS,
  rotateDistance: number = ROTATE_DISTANCE,
  getAnchorState?: () => AnchorState | null,
): (worldPoint: { x: number; y: number }) => AffordanceHit | null {
  return function affordanceAt({ x: wx, y: wy }) {
    const state = getChromeState();
    const r2 = hitRadius * hitRadius;

    // -- Corner resize handles --
    const resizeTarget = pickResizeTarget(state);
    if (resizeTarget) {
      for (const c of cornersFor(resizeTarget.bounds)) {
        if (dist2(wx, wy, c.worldX, c.worldY) <= r2) {
          return {
            kind: c.kind,
            fixedPoint: { x: c.fixedX, y: c.fixedY },
            targetIds: [resizeTarget.id],
            anchor: c.anchor,
          };
        }
      }
    }

    // -- Rotation handle (single selection only) --
    if (state.selection.length === 1) {
      const id = state.selection[0];
      const b = state.boundsOf(id);
      if (b) {
        const { x, y, width, rotation = 0 } = b;
        const cx = x + width / 2;
        const cy = b.y + b.height / 2;
        // Handle position: top-center, offset upward by `rotateDistance`.
        const rawHx = x + width / 2;
        const rawHy = y - rotateDistance;
        const hw = rotateAround(rawHx, rawHy, cx, cy, rotation);
        if (dist2(wx, wy, hw.x, hw.y) <= r2) {
          return {
            kind: 'rotate-handle',
            fixedPoint: { x: cx, y: cy }, // pivot
            targetIds: [id],
          };
        }
      }
    }

    // -- Anchor / control-handle hits (selected polygon paths) --
    if (getAnchorState) {
      const anchorState = getAnchorState();
      if (anchorState) {
        const { editingId } = anchorState;
        for (const id of state.selection) {
          const pose = anchorState.getPose(id);
          if (!pose || (pose as { kind?: string }).kind !== 'polygon') continue;
          const polygon = pose as PolygonPath;
          // Control handles are only hittable when this node is in edit mode.
          const inEditMode = editingId === id;
          if (inEditMode) {
            // When in edit mode, use hitAnchor which prefers control handles
            // over anchors when both are within radius — matches visual layering
            // (controls render on top).
            const hit = hitAnchor(polygon, wx, wy, hitRadius);
            if (hit) {
              const kindStr =
                hit.kind === 'anchor'
                  ? `anchor:${hit.anchorIndex}`
                  : hit.kind === 'controlIn'
                    ? `controlIn:${hit.anchorIndex}`
                    : `controlOut:${hit.anchorIndex}`;
              return { kind: kindStr, targetIds: [id] };
            }
          } else {
            // Outside edit mode: only test anchor points, not control handles.
            const anchors = enumerateAnchors(polygon);
            const r2anchor = hitRadius * hitRadius;
            let best: { d2: number; anchorIndex: number } | null = null;
            for (const a of anchors) {
              const dx = a.x - wx;
              const dy = a.y - wy;
              const d2 = dx * dx + dy * dy;
              if (d2 <= r2anchor && (!best || d2 < best.d2)) {
                best = { d2, anchorIndex: a.anchorIndex };
              }
            }
            if (best !== null) {
              return { kind: `anchor:${best.anchorIndex}`, targetIds: [id] };
            }
          }
        }
      }
    }

    return null;
  };
}

// ---------------------------------------------------------------------------
// classifyTarget helper
// ---------------------------------------------------------------------------

/**
 * Classify a world-space point against the current selection:
 * - `'empty'`: no scene body hit.
 * - `'selected-body'`: hit a node that is currently selected.
 * - `'unselected-body'`: hit a node that is NOT selected.
 *
 * The caller supplies the hit-test function (already wired from
 * `useSceneSelectTool.pickEvery`).
 */
export function buildClassifyTarget(
  getSelection: () => readonly string[],
  pickBest: (wx: number, wy: number) => string | null,
): (worldPoint: { x: number; y: number }) => 'empty' | 'selected-body' | 'unselected-body' {
  return function classifyTarget({ x: wx, y: wy }) {
    const hitId = pickBest(wx, wy);
    if (!hitId) return 'empty';
    const sel = getSelection();
    return sel.includes(hitId) ? 'selected-body' : 'unselected-body';
  };
}
