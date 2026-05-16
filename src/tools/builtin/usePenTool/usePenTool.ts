import { useMemo, useReducer, useRef, useState, createElement } from 'react';
import { defineTool, begin, claim, none } from '../../routing';
import type { Result } from '../../routing';
import type { Tool, ToolCtx } from '../../types';
import type { ToolPrefGroup } from '../../prefs';
import type { Op } from 'core/ops/types';
import { meanScale } from 'core/viewport/meanScale';
import { PenIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import type { PolygonPath } from 'features/paths/types';
import { pathToAnchors, anchorsToPath, type PenAnchor as KitPenAnchor } from 'features/paths/anchors';
import { splitCubicAtT } from 'features/paths/cubicMath';
import { createSetPathOp } from 'core/ops/setPath';
import { constrainTo45 } from '../../../util/constrainTo45';
import { penEditHitOverride } from './penEdit/hitOverride';
import { commitEditAsOp, exitEditMode, enterEditMode } from './penEdit/scratch';
import {
  dragAnchor, dragHandle, selectAnchor, addAnchorOnSegment,
  deleteAnchors, scissorsAtAnchor, nudgeSelectedAnchors, marqueeSelect,
} from './penEdit/actions';

/**
 * In-progress pen anchor. `outHandle` is set when the anchor was placed via
 * click-drag (smooth anchor); undefined for click-placed corners.
 * `inHandle` is mirrored from the previous anchor's outHandle on segment
 * emission unless `altBroken` is set on that previous anchor.
 */
export interface PenAnchor {
  x: number;
  y: number;
  outHandle?: { x: number; y: number };
  inHandle?: { x: number; y: number };
  /** True when Alt was held during the outgoing-handle drag — the next
   *  anchor's incoming handle is NOT mirrored from this one. */
  altBroken?: boolean;
}

export interface PenSubpath {
  anchors: PenAnchor[]; // LOCAL PenAnchor — create-mode in-progress
  closed: boolean;
}

/** Edit-mode state. `anchors` uses the kit's PenAnchor (committed/derived
 *  geometry); `altBroken` has no post-commit meaning and is correctly absent. */
/** @internal */
export interface PenEditState {
  objId: string;
  anchors: KitPenAnchor[][];
  closed: boolean[];
  selectedAnchors: Set<string>;
  activeHandle: { sub: number; anchor: number; side: 'in' | 'out' } | null;
  dirty: boolean;
  preConvert: { path: unknown; closed: boolean; params: unknown } | null;
  /** Snapshot of the path-as-it-was on edit-mode entry (already a polygon —
   *  if the obj was parametric, this is the converted form). Used as the
   *  op's `from` for plain-path edits so undo restores the entry state. */
  original: { path: unknown; closed: boolean };
  /** In-flight marquee rect (world-space). Null when not dragging. */
  marquee: { x0: number; y0: number; x1: number; y1: number; additive: boolean } | null;
}

/** Mutable scratch shared across pen-tool gestures. The hook keeps a stable
 *  reference to a single instance and `initScratch` returns it on every call,
 *  so click-by-click state survives gesture boundaries and the preview layer
 *  can read the same object. */
export interface PenScratch {
  /** Whether the pen is in create (draw new path) or edit (reshape existing
   *  path) mode. Defaults to 'create'. */
  mode: 'create' | 'edit';
  /** Edit-mode state, populated when `mode === 'edit'`. Null in create mode. */
  edit: PenEditState | null;
  finishedSubpaths: PenSubpath[];
  current: PenSubpath | null;
  cursor: { x: number; y: number } | null;
  draggingHandleAt: number | null;
  closeHintActive: boolean;
  /** Pointer-down world coords + modifiers, captured on every pointer.onDown.
   *  Used by drag.onStart (anchor lands at the down coords, not the
   *  threshold-crossing coords) and by pointer.onClick. Internal. */
  _pendingDown: { worldX: number; worldY: number; alt: boolean; shift: boolean } | null;
  /** Timestamp + world coords of the most recent click, used to detect a
   *  double-click on the last placed anchor (Illustrator convention for
   *  open-finish). Internal. */
  _lastClick: { t: number; x: number; y: number } | null;
}

export interface UsePenToolOptions<TPose> {
  /** Wrap a finished PolygonPath in the consumer's pose type. */
  wrapPath: (path: PolygonPath, opts: { closed: boolean }) => TPose;
  /** Insert + select adapter. */
  adapter: {
    addNode: (pose: TPose) => string;
    setSelection: (ids: string[]) => void;
    /** Apply an op batch (with optional history label). Required for pen-edit;
     *  safe to omit if the consumer only uses create mode. */
    applyOps?: (ops: Op[], label: string) => void;
  };
  /** Auto-select the new object after commit. Default `true`. */
  autoSelect?: boolean;
  /** When true (default), clicking the first anchor to close a subpath
   *  commits immediately — the closed region renders with its fill right
   *  away. When false, the closed subpath stays in scratch so the user can
   *  start another subpath; commit then fires on Enter / tool-switch /
   *  ⌘-click / double-click, producing a compound path. */
  autoCommitOnClose?: boolean;
  /** Screen-px hit radius for "click first anchor to close". Default `8`.
   *  Note: implemented in world space here (divided by view.scale at the
   *  call site); aligns with `useSelectTool.handleHitRadius`. */
  closeHitRadius?: number;
  /** Optional point snapper applied to every world-space coordinate the
   *  pen records or previews — anchor positions (corner clicks, smooth-
   *  drag base point), the rubber-band cursor, and the outgoing-handle
   *  target. Receives raw world coords; returns snapped world coords.
   *  Wire to `gridSnapStrategy`-style spacing via the consumer:
   *
   *      snapPoint: (p) => ({
   *        x: Math.round(p.x / SPACING) * SPACING,
   *        y: Math.round(p.y / SPACING) * SPACING,
   *      })
   *
   *  Pen state (anchor handles, etc.) is computed AFTER snapping so the
   *  visible geometry stays grid-aligned. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
  /** Resolve a path obj from id. Returns the obj's path, closed flag, params,
   *  and the tool that created it (used to decide whether the trapdoor applies).
   *  Required when pen-edit is wanted; safe to omit if the consumer only uses
   *  create mode (dblclick-to-edit will be a no-op). */
  getPathObj?: (id: string) => {
    path: PolygonPath | { kind: 'rect'; x: number; y: number; width: number; height: number };
    closed: boolean;
    params: unknown;
    tool: string;
  } | null;
}

function freshScratch(): PenScratch {
  return {
    mode: 'create',
    edit: null,
    finishedSubpaths: [],
    current: null,
    cursor: null,
    draggingHandleAt: null,
    closeHintActive: false,
    _pendingDown: null,
    _lastClick: null,
  };
}

function resetScratch(s: PenScratch): void {
  s.mode = 'create';
  s.edit = null;
  s.finishedSubpaths = [];
  s.current = null;
  s.cursor = null;
  s.draggingHandleAt = null;
  s.closeHintActive = false;
  s._pendingDown = null;
  s._lastClick = null;
}

/** Max ms between consecutive clicks to count as a double-click. */
const DOUBLE_CLICK_MS = 300;

/** Build a PolygonPath from the pen's accumulated subpaths. Cubic segments
 *  are emitted whenever either endpoint of the segment carries a handle:
 *  the previous anchor's outHandle (or itself if absent) and the current
 *  anchor's inHandle (mirrored from previous outHandle unless altBroken,
 *  or itself if neither). Pure corner segments fall through to L. */
function buildPath(
  subpaths: PenSubpath[],
  trailing: PenSubpath | null,
): PolygonPath {
  const b = new PathBuilder();
  const all = [...subpaths];
  if (trailing && trailing.anchors.length > 0) all.push(trailing);
  for (const sp of all) {
    if (sp.anchors.length === 0) continue;
    const first = sp.anchors[0];
    b.moveTo(first.x, first.y);
    for (let i = 1; i < sp.anchors.length; i++) {
      const prev = sp.anchors[i - 1];
      const curr = sp.anchors[i];
      const out = prev.outHandle;
      const inH = curr.inHandle ?? mirrorHandle(prev, out);
      if (out || curr.inHandle) {
        const c1 = out ?? { x: prev.x, y: prev.y };
        const c2 = inH ?? { x: curr.x, y: curr.y };
        b.curveTo(c1.x, c1.y, c2.x, c2.y, curr.x, curr.y);
      } else {
        b.lineTo(curr.x, curr.y);
      }
    }
    if (sp.closed) {
      // For a closed subpath, the closing segment runs from the last anchor
      // back to the first. If the last anchor has an outHandle, emit a curve.
      const last = sp.anchors[sp.anchors.length - 1];
      const first0 = sp.anchors[0];
      const out = last.outHandle;
      const inH = first0.inHandle ?? mirrorHandle(last, out);
      if (out || first0.inHandle) {
        const c1 = out ?? { x: last.x, y: last.y };
        const c2 = inH ?? { x: first0.x, y: first0.y };
        b.curveTo(c1.x, c1.y, c2.x, c2.y, first0.x, first0.y);
      }
      b.close();
    }
  }
  return b.build();
}

function mirrorHandle(
  anchor: PenAnchor,
  out: { x: number; y: number } | undefined,
): { x: number; y: number } | undefined {
  if (!out || anchor.altBroken) return undefined;
  return { x: 2 * anchor.x - out.x, y: 2 * anchor.y - out.y };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx, dy = ay - by;
  return Math.hypot(dx, dy);
}

/** Sample every segment in `anchors` and return the closest (sub, segIdx, t)
 *  to (wx, wy). Sample count exceeds the hit-test override's 12 because the
 *  caller has already confirmed the click hit the obj — accuracy matters more
 *  than skipping work. */
function nearestSegmentT(
  anchors: KitPenAnchor[][],
  wx: number,
  wy: number,
): { sub: number; segIdx: number; t: number } | null {
  const SAMPLES = 32;
  let bestD2 = Infinity;
  let best: { sub: number; segIdx: number; t: number } | null = null;
  for (let s = 0; s < anchors.length; s++) {
    const sub = anchors[s];
    for (let i = 0; i + 1 < sub.length; i++) {
      const a = sub[i], b = sub[i + 1];
      const p0 = a, p1 = a.outHandle ?? a, p2 = b.inHandle ?? b, p3 = b;
      for (let k = 1; k < SAMPLES; k++) {
        const t = k / SAMPLES;
        const u = 1 - t;
        const px = u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x;
        const py = u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y;
        const dx = px - wx, dy = py - wy;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) { bestD2 = d2; best = { sub: s, segIdx: i, t }; }
      }
    }
  }
  return best;
}

export interface UsePenToolReturn {
  tool: Tool<PenScratch>;
  /**
   * True when the pen is in edit mode (reshaping an existing path). Consumers
   * should apply a CSS class like `pen-edit-active` to their canvas container
   * when `isEditing` is true, to give users a visual cue that they're in edit
   * mode (e.g. a subtle background tint). The kit does not own the DOM and
   * ships no default stylesheet for this.
   */
  isEditing: boolean;
}

/**
 * Active-slot Tool: click + drag to build a `PolygonPath` Illustrator-style.
 *
 * State machine: Idle / Drawing / BetweenSubpaths (see design doc).
 * Click places a corner anchor; click-drag places an anchor with an
 * outgoing bezier handle; click-the-first-anchor closes the subpath; Enter
 * open-finishes; Esc discards; tool-switch commits if ≥2 anchors else
 * discards. Shift constrains the placement-drag handle to 0/45/90/135°;
 * Alt during drag breaks the handle mirror for the next segment.
 *
 * @returns `{ tool, isEditing }` — the pen tool definition plus a reactive
 * `isEditing` boolean. Apply a CSS class like `pen-edit-active` to your canvas
 * container when `isEditing` is true for a visual cue. The kit owns no DOM and
 * ships no default stylesheet for this.
 */
export function usePenTool<TPose>(
  options: UsePenToolOptions<TPose>,
): UsePenToolReturn {
  const { wrapPath, adapter, autoSelect = true, autoCommitOnClose = true, closeHitRadius = 8, snapPoint, getPathObj } = options;

  // Persistent scratch: single ref reused across gestures so multi-click
  // state survives the dispatcher's per-gesture initScratch contract.
  const scratchRef = useRef<PenScratch | null>(null);
  if (scratchRef.current === null) scratchRef.current = freshScratch();

  // Latest options stashed so handlers see fresh values without rebuilding
  // the Tool record (which would lose scratch identity in the dispatcher).
  const optsRef = useRef({ wrapPath, adapter, autoSelect, autoCommitOnClose, closeHitRadius, snapPoint, getPathObj, applyOps: adapter.applyOps });
  optsRef.current = { wrapPath, adapter, autoSelect, autoCommitOnClose, closeHitRadius, snapPoint, getPathObj, applyOps: adapter.applyOps };

  // Scratch is a mutable ref (so click-by-click state survives the
  // dispatcher's per-gesture initScratch contract). Mutations alone don't
  // trigger React re-renders, so Canvas never re-paints and the preview
  // layer stays invisible until something else (e.g. commit) bumps host
  // state. Force a render after every scratch mutation so the host's
  // <Canvas layers={{...}}> literal gets a new identity and the paint
  // useEffect fires. Pull the trigger via ref so the memoized Tool record
  // doesn't need to rebuild.
  const [, forceRenderInternal] = useReducer((x: number) => x + 1, 0);
  const [isEditing, setIsEditing] = useState(false);
  // Track isEditing in a ref so the forceRender closure can compare without
  // capturing stale state (avoids an extra re-render when mode hasn't changed).
  const isEditingRef = useRef(false);
  const forceRenderRef = useRef(() => {
    const cur = scratchRef.current?.mode === 'edit';
    if (cur !== isEditingRef.current) {
      isEditingRef.current = cur;
      setIsEditing(cur);
    }
    forceRenderInternal();
  });
  // Keep the closure fresh on every render (isEditingRef is stable, but
  // setIsEditing and forceRenderInternal are stable by React contract anyway).
  forceRenderRef.current = () => {
    const cur = scratchRef.current?.mode === 'edit';
    if (cur !== isEditingRef.current) {
      isEditingRef.current = cur;
      setIsEditing(cur);
    }
    forceRenderInternal();
  };

  const tool = useMemo(() => {
    function commit(s: PenScratch): void {
      const trailing = s.current && s.current.anchors.length > 0 ? s.current : null;
      if (s.finishedSubpaths.length === 0 && !trailing) return;
      const allClosed =
        s.finishedSubpaths.every((sp) => sp.closed) &&
        (trailing === null || trailing.closed);
      const path = buildPath(s.finishedSubpaths, trailing);
      const pose = optsRef.current.wrapPath(path, { closed: allClosed });
      const id = optsRef.current.adapter.addNode(pose);
      if (optsRef.current.autoSelect) optsRef.current.adapter.setSelection([id]);
      resetScratch(s);
    }

    function commitEditAndExit(s: PenScratch): void {
      const op = commitEditAsOp(s);
      if (op && optsRef.current.applyOps) {
        optsRef.current.applyOps([op], 'Edit path');
      }
      exitEditMode(s);
      forceRenderRef.current();
    }

    function nudgeRouteFor(dx: number, dy: number): (ctx: ToolCtx<PenScratch>) => Result<PenScratch> {
      return (ctx: ToolCtx<PenScratch>): Result<PenScratch> => {
        if (ctx.scratch.mode !== 'edit') return none();
        const step = ctx.modifiers.shift ? 10 : 1;
        nudgeSelectedAnchors(ctx.scratch, { dx: dx * step, dy: dy * step });
        const op = commitEditAsOp(ctx.scratch);
        if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Nudge anchor');
        forceRenderRef.current();
        return claim();
      };
    }

    function updateCloseHint(s: PenScratch, view: { scale: { x: number; y: number } }): void {
      const cur = s.current;
      if (!cur || cur.anchors.length < 3 || !s.cursor) {
        s.closeHintActive = false;
        return;
      }
      const first = cur.anchors[0];
      const radius = optsRef.current.closeHitRadius / meanScale(view.scale);
      s.closeHintActive = dist(first.x, first.y, s.cursor.x, s.cursor.y) <= radius;
    }

    // Create-mode click handler, extracted so the route-table '*' entry
    // can call it after the edit-mode early-outs.
    function createModeClick(ctx: ToolCtx<PenScratch>): Result<PenScratch> {
      const s = ctx.scratch;
      const down = s._pendingDown;
      s._pendingDown = null;
      const snap = optsRef.current.snapPoint;
      const raw = down
        ? { x: down.worldX, y: down.worldY }
        : { x: ctx.worldX, y: ctx.worldY };
      // _pendingDown is already snapped on capture; only snap the fallback path.
      const p = down ? raw : snap ? snap(raw) : raw;
      const wx = p.x;
      const wy = p.y;
      const radius = optsRef.current.closeHitRadius / meanScale(ctx.view.scale);
      const totalAnchors =
        (s.current ? s.current.anchors.length : 0) +
        s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);

      // Cmd/Ctrl + click → open-finish (Illustrator convention). Wins
      // over close-on-first-anchor: holding the modifier signals "stop
      // editing" rather than "close to first." Needs ≥2 anchors so
      // there's an actual path to commit.
      if ((ctx.modifiers.meta || ctx.modifiers.ctrl) && totalAnchors >= 2) {
        commit(s);
        s._lastClick = null;
        forceRenderRef.current();
        return claim();
      }

      // Shift+click on a path obj (with no path in progress) → enter edit
      // mode. Unambiguous single-click entry into edit mode; complements the
      // dblclick fallback below.
      if (
        s.mode === 'create' &&
        totalAnchors === 0 &&
        ctx.modifiers.shift &&
        ctx.target?.category === 'node'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const objId = ctx.target!.id as string;
        const obj = optsRef.current.getPathObj?.(objId);
        if (obj) {
          enterEditMode(s, {
            objId,
            path: obj.path,
            closed: obj.closed,
            params: obj.params,
            isParametric: obj.tool !== 'pen' && obj.tool !== 'pencil' && obj.tool !== 'imported',
          });
          s._lastClick = null;
          forceRenderRef.current();
          return claim();
        }
      }

      // Alt+click on a path obj (with no path in progress) → insert an anchor
      // at the nearest point on the path. Polygon paths only — rect/parametric
      // would require a trapdoor (TODO when a consumer needs it).
      if (
        s.mode === 'create' &&
        totalAnchors === 0 &&
        ctx.modifiers.alt &&
        ctx.target?.category === 'node'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const objId = ctx.target!.id as string;
        const obj = optsRef.current.getPathObj?.(objId);
        if (obj && obj.path.kind === 'polygon') {
          const decoded = pathToAnchors(obj.path);
          const hit = nearestSegmentT(decoded.anchors, wx, wy);
          if (hit) {
            const sub = decoded.anchors[hit.sub];
            const a = sub[hit.segIdx], b = sub[hit.segIdx + 1];
            const p0 = a, p1 = a.outHandle ?? a, p2 = b.inHandle ?? b, p3 = b;
            const { left, right } = splitCubicAtT(p0, p1, p2, p3, hit.t);
            a.outHandle = { x: left[1].x, y: left[1].y };
            b.inHandle = { x: right[2].x, y: right[2].y };
            sub.splice(hit.segIdx + 1, 0, {
              x: left[3].x, y: left[3].y,
              inHandle: { x: left[2].x, y: left[2].y },
              outHandle: { x: right[1].x, y: right[1].y },
            });
            const newPath = anchorsToPath(decoded.anchors, decoded.closed);
            const op = createSetPathOp({
              id: objId,
              from: { path: obj.path, closed: obj.closed, params: obj.params },
              to: { path: newPath, closed: obj.closed, params: undefined },
            });
            optsRef.current.applyOps?.([op], 'Add anchor');
            s._lastClick = null;
            forceRenderRef.current();
            return claim();
          }
        }
      }

      // Pen-edit entry: dblclick on an existing path obj enters edit mode.
      // The prior single click on a path target lands an anchor as normal —
      // so the dblclick state has at most one anchor sitting at `_lastClick`.
      // When the second click matches that position and target, drop the
      // stub anchor and enter edit mode instead of compounding anchors.
      const last = s._lastClick;
      const priorOnlyPlacedAnchor =
        s.finishedSubpaths.length === 0 &&
        (s.current === null ||
          (s.current.anchors.length === 1 &&
            !s.current.anchors[0].outHandle &&
            last !== null &&
            dist(s.current.anchors[0].x, s.current.anchors[0].y, last.x, last.y) <= radius));
      if (
        s.mode === 'create' &&
        priorOnlyPlacedAnchor &&
        ctx.target?.category === 'node' &&
        last &&
        performance.now() - last.t <= DOUBLE_CLICK_MS &&
        dist(last.x, last.y, wx, wy) <= radius
      ) {
        // ctx.target is narrowed to NodeHit by the category === 'node' guard above.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const objId = ctx.target!.id as string;
        const obj = optsRef.current.getPathObj?.(objId);
        if (obj) {
          // Backtrack the stub anchor the prior click placed (if any) so
          // edit mode starts from the committed object's anchors only.
          s.current = null;
          s.draggingHandleAt = null;
          enterEditMode(s, {
            objId,
            path: obj.path,
            closed: obj.closed,
            params: obj.params,
            isParametric: obj.tool !== 'pen' && obj.tool !== 'pencil' && obj.tool !== 'imported',
          });
          s._lastClick = null;
          forceRenderRef.current();
          return claim();
        }
      }

      // Double-click on the last placed anchor → open-finish (Illustrator
      // convention). We detect via prior-click timestamp + position; the
      // dispatcher doesn't expose synthetic dblclick. Match within the
      // close-hit radius so the second click can land slightly off.
      if (last && totalAnchors >= 2 && performance.now() - last.t <= DOUBLE_CLICK_MS) {
        const cur = s.current;
        const lastAnchor = cur && cur.anchors.length > 0
          ? cur.anchors[cur.anchors.length - 1]
          : null;
        if (lastAnchor && dist(lastAnchor.x, lastAnchor.y, wx, wy) <= radius) {
          commit(s);
          s._lastClick = null;
          forceRenderRef.current();
          return claim();
        }
      }

      // Close-on-first-anchor (≥3 anchors). When `autoCommitOnClose` is
      // on (default), commit right away so the closed region renders with
      // its fill — Illustrator-style. When off, the closed subpath stays
      // in scratch for compound-path builds and commits on Enter / switch.
      if (s.current && s.current.anchors.length >= 3) {
        const first = s.current.anchors[0];
        if (dist(first.x, first.y, wx, wy) <= radius) {
          s.current.closed = true;
          s.finishedSubpaths.push(s.current);
          s.current = null;
          s.closeHintActive = false;
          s._lastClick = null;
          if (optsRef.current.autoCommitOnClose) commit(s);
          forceRenderRef.current();
          return claim();
        }
      }

      // Otherwise: append a corner anchor (start a new subpath if needed).
      if (!s.current) s.current = { anchors: [], closed: false };
      s.current.anchors.push({ x: wx, y: wy });
      s._lastClick = { t: performance.now(), x: wx, y: wy };
      forceRenderRef.current();
      return claim();
    }

    // Create-mode drag handler, extracted so the route-table '*' entry
    // can call it after the edit-mode early-out.
    function createModeDrag(ctx: ToolCtx<PenScratch>) {
      const s = ctx.scratch;
      const down = s._pendingDown;
      const snap = optsRef.current.snapPoint;
      // _pendingDown is already snapped on capture; only snap the fallback path.
      const fallback = snap
        ? snap({ x: ctx.worldX, y: ctx.worldY })
        : { x: ctx.worldX, y: ctx.worldY };
      const ax = down ? down.worldX : fallback.x;
      const ay = down ? down.worldY : fallback.y;
      if (!s.current) s.current = { anchors: [], closed: false };
      s.current.anchors.push({ x: ax, y: ay });
      s.draggingHandleAt = s.current.anchors.length - 1;
      // Apply initial outHandle from current cursor.
      applyOutHandle(s, ctx, optsRef.current.snapPoint);
      if (down?.alt) {
        s.current.anchors[s.draggingHandleAt].altBroken = true;
      }
      forceRenderRef.current();
      return begin<PenScratch>({
        scratch: s,
        onMove: (c) => {
          const sm = c.scratch;
          if (sm.draggingHandleAt !== null) {
            applyOutHandle(sm, c, optsRef.current.snapPoint);
            if (c.modifiers.alt && sm.current) {
              sm.current.anchors[sm.draggingHandleAt].altBroken = true;
            }
          } else {
            const sp = optsRef.current.snapPoint;
            sm.cursor = sp
              ? sp({ x: c.worldX, y: c.worldY })
              : { x: c.worldX, y: c.worldY };
            updateCloseHint(sm, c.view);
          }
          forceRenderRef.current();
          return claim();
        },
        onRelease: (c) => {
          const sr = c.scratch;
          if (sr.draggingHandleAt !== null) {
            applyOutHandle(sr, c, optsRef.current.snapPoint);
            if (c.modifiers.alt && sr.current) {
              sr.current.anchors[sr.draggingHandleAt].altBroken = true;
            }
            // Track the drag-placed anchor so a quick follow-up click on
            // it triggers double-click open-finish, same as click-placed.
            if (sr.current) {
              const a = sr.current.anchors[sr.draggingHandleAt];
              sr._lastClick = { t: performance.now(), x: a.x, y: a.y };
            }
            sr.draggingHandleAt = null;
            sr._pendingDown = null;
          }
          forceRenderRef.current();
          // claim() (not commit()) so the factory does not null out
          // ctx.scratch — the persistent scratchRef must keep its
          // mutated state visible to the next gesture.
          return claim();
        },
        onCancel: (c) => {
          c.scratch.draggingHandleAt = null;
          c.scratch._pendingDown = null;
          forceRenderRef.current();
        },
      });
    }

    return defineTool<PenScratch>({
      id: 'pen',
      keybinding: { key: 'P' },
      cursor: (ctx) => (ctx.scratch?.closeHintActive ? 'pointer' : 'crosshair'),
      hitOverride: (ctx) => penEditHitOverride({
        worldX: ctx.worldX,
        worldY: ctx.worldY,
        scratch: ctx.scratch,
        view: ctx.view,
        modifiers: ctx.modifiers,
      }),
      presentation: {
        label: 'Pen',
        icon: createElement(PenIcon),
        group: 'draw',
      },
      // Persistent-ref scratch — every gesture sees the same PenScratch so
      // multi-click subpath state survives the dispatcher's per-gesture
      // initScratch contract. The Phase 5b `def.initScratch` substrate
      // forwards this onto Tool.initScratch.
      initScratch: () => scratchRef.current!,

      onDeactivate: (ctx) => {
        const s = ctx.scratch;
        if (s.mode === 'edit') {
          commitEditAndExit(s);
          return;
        }
        // Existing create-mode deactivate logic (preserved):
        const cur = s.current;
        const totalAnchors =
          (cur ? cur.anchors.length : 0) +
          s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
        if (totalAnchors >= 2) commit(s);
        else resetScratch(s);
      },

      // NOTE: a future enhancement could set `claimsAll: (ctx) =>
      // (ctx.scratch?.current?.anchors.length ?? 0) > 0` to guarantee
      // affordance hits never interrupt a mid-path pen. The imperative
      // pen did not have this; leaving it off preserves behavior.
      initial: {
        pointerDown: {
          '*': (ctx) => {
            const s = ctx.scratch;
            const snap = optsRef.current.snapPoint;
            const p = snap
              ? snap({ x: ctx.worldX, y: ctx.worldY })
              : { x: ctx.worldX, y: ctx.worldY };
            s._pendingDown = {
              worldX: p.x,
              worldY: p.y,
              alt: ctx.modifiers.alt,
              shift: ctx.modifiers.shift,
            };
            forceRenderRef.current();
            // Return none() — scratch mutation persists via the
            // scratchRef, but we don't engage. The next gesture stage
            // (click or drag) reads `_pendingDown` from scratch on its
            // own.
            return none();
          },
        },

        click: {
          '*': (ctx) => {
            // Edit mode: empty-click exits edit mode (with commit if dirty).
            if (ctx.scratch.mode === 'edit' && ctx.target?.category === 'empty') {
              commitEditAndExit(ctx.scratch);
              return claim();
            }
            // Edit mode: clicks on nodes are otherwise ignored (the dblclick-to-enter
            // path was already handled; further node clicks while editing
            // should not start a new path). Just no-op.
            if (ctx.scratch.mode === 'edit') return none();
            // Create-mode click logic (preserved):
            return createModeClick(ctx);
          },
          anchor: (ctx) => {
            if (ctx.scratch.mode !== 'edit') return none();
            const extra = (ctx.target as { extra: { sub: number; idx: number } }).extra;
            if (ctx.modifiers.alt) {
              // Scissors — only meaningful on a closed subpath; the action no-ops otherwise.
              scissorsAtAnchor(ctx.scratch, extra);
              const op = commitEditAsOp(ctx.scratch);
              if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Scissors');
            } else {
              selectAnchor(ctx.scratch, { sub: extra.sub, idx: extra.idx, additive: ctx.modifiers.shift });
            }
            forceRenderRef.current();
            return claim();
          },
          segment: (ctx) => {
            if (ctx.scratch.mode !== 'edit') return none();
            const extra = (ctx.target as { extra: { sub: number; segIdx: number; t: number } }).extra;
            addAnchorOnSegment(ctx.scratch, extra);
            const op = commitEditAsOp(ctx.scratch);
            if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Add anchor');
            forceRenderRef.current();
            return claim();
          },
        },

        // Route-table drag: '*' covers create mode (and any edit-mode
        // target that isn't anchor/handle); anchor/handle get their own
        // edit-mode branches.
        drag: {
          '*': (ctx) => {
            if (ctx.scratch.mode === 'edit') return none();
            return createModeDrag(ctx);
          },
          anchor: (ctx) => {
            if (ctx.scratch.mode !== 'edit') return none();
            const extra = (ctx.target as { extra: { sub: number; idx: number } }).extra;
            let lastX = ctx.worldX, lastY = ctx.worldY;
            return begin<PenScratch>({
              scratch: ctx.scratch,
              onMove: (c) => {
                const dx = c.worldX - lastX;
                const dy = c.worldY - lastY;
                lastX = c.worldX; lastY = c.worldY;
                dragAnchor(c.scratch, { sub: extra.sub, idx: extra.idx, dx, dy });
                const op = commitEditAsOp(c.scratch);
                if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Move anchor');
                forceRenderRef.current();
                return claim();
              },
              onRelease: () => claim(),
              onCancel: () => {},
            });
          },
          empty: (ctx) => {
            // Create mode: delegate to the standard create-mode drag path.
            if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return createModeDrag(ctx);
            // Edit mode: Begin marquee. Record start in world coords.
            ctx.scratch.edit.marquee = {
              x0: ctx.worldX, y0: ctx.worldY,
              x1: ctx.worldX, y1: ctx.worldY,
              additive: ctx.modifiers.shift,
            };
            forceRenderRef.current();
            return begin<PenScratch>({
              scratch: ctx.scratch,
              onMove: (c) => {
                if (!c.scratch.edit?.marquee) return none();
                c.scratch.edit.marquee.x1 = c.worldX;
                c.scratch.edit.marquee.y1 = c.worldY;
                forceRenderRef.current();
                return claim();
              },
              onRelease: (c) => {
                const m = c.scratch.edit?.marquee;
                if (!m || !c.scratch.edit) return claim();
                const x = Math.min(m.x0, m.x1);
                const y = Math.min(m.y0, m.y1);
                const width = Math.abs(m.x1 - m.x0);
                const height = Math.abs(m.y1 - m.y0);
                marqueeSelect(c.scratch, { x, y, width, height, additive: m.additive });
                c.scratch.edit.marquee = null;
                forceRenderRef.current();
                return claim();
              },
              onCancel: (c) => {
                if (c.scratch.edit) c.scratch.edit.marquee = null;
                forceRenderRef.current();
              },
            });
          },
          handle: (ctx) => {
            if (ctx.scratch.mode !== 'edit' || !ctx.scratch.edit) return none();
            const extra = (ctx.target as { extra: { sub: number; idx: number; side: 'in' | 'out' } }).extra;
            ctx.scratch.edit.activeHandle = { sub: extra.sub, anchor: extra.idx, side: extra.side };
            return begin<PenScratch>({
              scratch: ctx.scratch,
              onMove: (c) => {
                if (!c.scratch.edit?.activeHandle) return none();
                const h = c.scratch.edit.activeHandle;
                dragHandle(c.scratch, {
                  sub: h.sub, idx: h.anchor, side: h.side,
                  toX: c.worldX, toY: c.worldY,
                  breakSmoothness: c.modifiers.alt,
                });
                const op = commitEditAsOp(c.scratch);
                if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Move handle');
                forceRenderRef.current();
                return claim();
              },
              onRelease: (c) => {
                if (c.scratch.edit) c.scratch.edit.activeHandle = null;
                return claim();
              },
              onCancel: (c) => {
                if (c.scratch.edit) c.scratch.edit.activeHandle = null;
              },
            });
          },
        },

        keyDown: {
          Enter: (ctx) => {
            const s = ctx.scratch;
            if (s.mode === 'edit') {
              commitEditAndExit(s);
              return claim();
            }
            // Existing create-mode logic preserved:
            const totalAnchors =
              (s.current ? s.current.anchors.length : 0) +
              s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
            if (totalAnchors === 0) return none();
            commit(s);
            forceRenderRef.current();
            return claim();
          },
          Escape: (ctx) => {
            const s = ctx.scratch;
            if (s.mode === 'edit') {
              commitEditAndExit(s);
              return claim();
            }
            if (s.current === null && s.finishedSubpaths.length === 0) return none();
            resetScratch(s);
            forceRenderRef.current();
            return claim();
          },
          Backspace: (ctx) => {
            const s = ctx.scratch;
            if (s.mode !== 'edit' || !s.edit) return none();
            if (s.edit.selectedAnchors.size === 0) return none();
            deleteAnchors(s, [...s.edit.selectedAnchors]);
            const op = commitEditAsOp(s);
            if (op && optsRef.current.applyOps) optsRef.current.applyOps([op], 'Delete anchor');
            forceRenderRef.current();
            return claim();
          },
          ArrowUp:    nudgeRouteFor(0, -1),
          ArrowDown:  nudgeRouteFor(0, 1),
          ArrowLeft:  nudgeRouteFor(-1, 0),
          ArrowRight: nudgeRouteFor(1, 0),
        },
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { tool, isEditing };
}

usePenTool.prefs = {
  name: 'Pen',
  description: 'Pen-tool behavior.',
  children: {
    autoCommitOnClose: {
      kind: 'boolean',
      name: 'Auto-commit pen on close',
      description: "When you click the pen tool's first anchor to close a region, commit immediately so it renders with its fill. Off: keep the path in preview until you press Enter (lets you build a compound path from multiple closed subpaths).",
      default: true,
    },
  },
} satisfies ToolPrefGroup;

function applyOutHandle<S extends PenScratch>(
  s: S,
  ctx: ToolCtx<S>,
  snap?: (p: { x: number; y: number }) => { x: number; y: number },
): void {
  if (s.current === null || s.draggingHandleAt === null) return;
  const anchor = s.current.anchors[s.draggingHandleAt];
  const target = snap ? snap({ x: ctx.worldX, y: ctx.worldY }) : { x: ctx.worldX, y: ctx.worldY };
  let dx = target.x - anchor.x;
  let dy = target.y - anchor.y;
  if (ctx.modifiers.shift) {
    const c = constrainTo45(dx, dy);
    dx = c.dx;
    dy = c.dy;
  }
  anchor.outHandle = { x: anchor.x + dx, y: anchor.y + dy };
}
