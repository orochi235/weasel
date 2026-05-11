import { useMemo, useReducer, useRef } from 'react';
import { defineTool } from '../defineTool';
import type { Tool, ToolCtx } from '../types';
import { PathBuilder } from 'features/paths/builder';
import type { PolygonPath } from 'features/paths/types';
import { constrainTo45 } from '../../util/constrainTo45';

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
  anchors: PenAnchor[];
  closed: boolean;
}

/** Mutable scratch shared across pen-tool gestures. The hook keeps a stable
 *  reference to a single instance and `initScratch` returns it on every call,
 *  so click-by-click state survives gesture boundaries and the preview layer
 *  can read the same object. */
export interface PenScratch {
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

export interface UseUserPenToolOptions<TPose> {
  /** Wrap a finished PolygonPath in the consumer's pose type. */
  wrapPath: (path: PolygonPath, opts: { closed: boolean }) => TPose;
  /** Insert + select adapter. */
  adapter: {
    addNode: (pose: TPose) => string;
    setSelection: (ids: string[]) => void;
  };
  /** Auto-select the new object after commit. Default `true`. */
  autoSelect?: boolean;
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
}

function freshScratch(): PenScratch {
  return {
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

/** Active-slot Tool: click + drag to build a `PolygonPath` Illustrator-style.
 *
 *  State machine: Idle / Drawing / BetweenSubpaths (see design doc).
 *  Click places a corner anchor; click-drag places an anchor with an
 *  outgoing bezier handle; click-the-first-anchor closes the subpath; Enter
 *  open-finishes; Esc discards; tool-switch commits if ≥2 anchors else
 *  discards. Shift constrains the placement-drag handle to 0/45/90/135°;
 *  Alt during drag breaks the handle mirror for the next segment. */
export function useUserPenTool<TPose>(
  options: UseUserPenToolOptions<TPose>,
): Tool<PenScratch> {
  const { wrapPath, adapter, autoSelect = true, closeHitRadius = 8, snapPoint } = options;

  // Persistent scratch: single ref reused across gestures so multi-click
  // state survives the dispatcher's per-gesture initScratch contract.
  const scratchRef = useRef<PenScratch | null>(null);
  if (scratchRef.current === null) scratchRef.current = freshScratch();

  // Latest options stashed so handlers see fresh values without rebuilding
  // the Tool record (which would lose scratch identity in the dispatcher).
  const optsRef = useRef({ wrapPath, adapter, autoSelect, closeHitRadius, snapPoint });
  optsRef.current = { wrapPath, adapter, autoSelect, closeHitRadius, snapPoint };

  // Scratch is a mutable ref (so click-by-click state survives the
  // dispatcher's per-gesture initScratch contract). Mutations alone don't
  // trigger React re-renders, so Canvas never re-paints and the preview
  // layer stays invisible until something else (e.g. commit) bumps host
  // state. Force a render after every scratch mutation so the host's
  // <Canvas layers={{...}}> literal gets a new identity and the paint
  // useEffect fires. Pull the trigger via ref so the memoized Tool record
  // doesn't need to rebuild.
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const forceRenderRef = useRef(forceRender);
  forceRenderRef.current = forceRender;

  return useMemo(() => {
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

    function updateCloseHint(s: PenScratch, view: { scale: number }): void {
      const cur = s.current;
      if (!cur || cur.anchors.length < 3 || !s.cursor) {
        s.closeHintActive = false;
        return;
      }
      const first = cur.anchors[0];
      const radius = optsRef.current.closeHitRadius / view.scale;
      s.closeHintActive = dist(first.x, first.y, s.cursor.x, s.cursor.y) <= radius;
    }

    return defineTool<PenScratch>({
      id: 'pen',
      keybinding: 'P',
      cursor: (ctx) => (ctx.scratch?.closeHintActive ? 'pointer' : 'crosshair'),
      initScratch: () => scratchRef.current!,

      onDeactivate: (ctx) => {
        const s = ctx.scratch;
        const cur = s.current;
        const totalAnchors =
          (cur ? cur.anchors.length : 0) +
          s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
        if (totalAnchors >= 2) commit(s);
        else resetScratch(s);
      },

      pointer: {
        onDown: (_e, ctx) => {
          const s = ctx.scratch;
          const snap = optsRef.current.snapPoint;
          const p = snap ? snap({ x: ctx.worldX, y: ctx.worldY }) : { x: ctx.worldX, y: ctx.worldY };
          s._pendingDown = {
            worldX: p.x,
            worldY: p.y,
            alt: ctx.modifiers.alt,
            shift: ctx.modifiers.shift,
          };
          forceRenderRef.current();
          return 'claim';
        },

        onClick: (_e, ctx) => {
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
          const radius = optsRef.current.closeHitRadius / ctx.view.scale;
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
            return 'claim';
          }

          // Double-click on the last placed anchor → open-finish (Illustrator
          // convention). We detect via prior-click timestamp + position; the
          // dispatcher doesn't expose synthetic dblclick. Match within the
          // close-hit radius so the second click can land slightly off.
          const last = s._lastClick;
          if (last && totalAnchors >= 2 && performance.now() - last.t <= DOUBLE_CLICK_MS) {
            const cur = s.current;
            const lastAnchor = cur && cur.anchors.length > 0
              ? cur.anchors[cur.anchors.length - 1]
              : null;
            if (lastAnchor && dist(lastAnchor.x, lastAnchor.y, wx, wy) <= radius) {
              commit(s);
              s._lastClick = null;
              forceRenderRef.current();
              return 'claim';
            }
          }

          // Close-on-first-anchor (≥3 anchors).
          if (s.current && s.current.anchors.length >= 3) {
            const first = s.current.anchors[0];
            if (dist(first.x, first.y, wx, wy) <= radius) {
              s.current.closed = true;
              s.finishedSubpaths.push(s.current);
              s.current = null;
              s.closeHintActive = false;
              s._lastClick = null;
              forceRenderRef.current();
              return 'claim';
            }
          }

          // Otherwise: append a corner anchor (start a new subpath if needed).
          if (!s.current) s.current = { anchors: [], closed: false };
          s.current.anchors.push({ x: wx, y: wy });
          s._lastClick = { t: performance.now(), x: wx, y: wy };
          forceRenderRef.current();
          return 'claim';
        },
      },

      drag: {
        onStart: (_e, ctx) => {
          const s = ctx.scratch;
          const down = s._pendingDown;
          const snap = optsRef.current.snapPoint;
          // _pendingDown is already snapped on capture; only snap the fallback path.
          const fallback = snap ? snap({ x: ctx.worldX, y: ctx.worldY }) : { x: ctx.worldX, y: ctx.worldY };
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
          return 'claim';
        },

        onMove: (_e, ctx) => {
          const s = ctx.scratch;
          if (s.draggingHandleAt !== null) {
            applyOutHandle(s, ctx, optsRef.current.snapPoint);
            if (ctx.modifiers.alt && s.current) {
              s.current.anchors[s.draggingHandleAt].altBroken = true;
            }
          } else {
            const snap = optsRef.current.snapPoint;
            s.cursor = snap ? snap({ x: ctx.worldX, y: ctx.worldY }) : { x: ctx.worldX, y: ctx.worldY };
            updateCloseHint(s, ctx.view);
          }
          forceRenderRef.current();
          return 'claim';
        },

        onEnd: (_e, ctx) => {
          const s = ctx.scratch;
          if (s.draggingHandleAt !== null) {
            applyOutHandle(s, ctx, optsRef.current.snapPoint);
            if (ctx.modifiers.alt && s.current) {
              s.current.anchors[s.draggingHandleAt].altBroken = true;
            }
            // Track the drag-placed anchor so a quick follow-up click on
            // it triggers double-click open-finish, same as click-placed.
            if (s.current) {
              const a = s.current.anchors[s.draggingHandleAt];
              s._lastClick = { t: performance.now(), x: a.x, y: a.y };
            }
            s.draggingHandleAt = null;
            s._pendingDown = null;
          }
          forceRenderRef.current();
          return 'claim';
        },

        onCancel: (ctx) => {
          ctx.scratch.draggingHandleAt = null;
          ctx.scratch._pendingDown = null;
          forceRenderRef.current();
        },
      },

      keyboard: {
        onDown: (e, ctx) => {
          const s = ctx.scratch;
          if (e.key === 'Enter') {
            const totalAnchors =
              (s.current ? s.current.anchors.length : 0) +
              s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
            if (totalAnchors === 0) return 'pass';
            commit(s);
            forceRenderRef.current();
            return 'claim';
          }
          if (e.key === 'Escape') {
            if (s.current === null && s.finishedSubpaths.length === 0) return 'pass';
            resetScratch(s);
            forceRenderRef.current();
            return 'claim';
          }
          return 'pass';
        },
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

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
