import { useCallback, useMemo, useReducer, useRef, createElement } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { ToolPrefGroup } from '../../prefs';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { ActionDeps, InvocationCtx } from '@weasel-js/routing';
import type { AreaSelectDep, EditAnchorsDep, ViewApi } from 'interactions/actions/depSchema';
import { pxExtent, withinPxRadius } from 'core/viewport/pxExtent';
import { PenIcon } from '../../../icons';
import type { PolygonPath } from 'features/paths/types';
import { anchorsToPath, pathToAnchors } from 'features/paths/anchors';
import { nearestPathAnchor, reverseAnchors, type PathAnchorHit } from 'features/paths/nearestAnchor';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { createDeleteOp } from 'core/ops/delete';
import type { Scene } from 'core/scene/types';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { constrainTo45 } from '../../../util/constrainTo45';
import { cursorFor } from '@weasel-js/cursor';

/**
 * In-progress pen anchor. A click places a corner, with no handles. A drag
 * sets `outHandle` to the drag point and `inHandle` to its mirror through
 * the anchor, which shapes the segment coming into it.
 */
export interface PenAnchor {
  x: number;
  y: number;
  outHandle?: { x: number; y: number };
  inHandle?: { x: number; y: number };
  /** True once Alt is held during the placement drag: from then on the
   *  in-handle stays where it is, and an anchor dragged with Alt down from
   *  the start gets none. */
  altBroken?: boolean;
}

/** One in-progress subpath of the pen tool: its anchors so far, and whether
 *  the user has closed it. */
export interface PenSubpath {
  anchors: PenAnchor[]; // LOCAL PenAnchor — in-progress
  closed: boolean;
}

/**
 * Mutable scratch shared across pen-tool gestures. The hook keeps a stable
 * reference to a single instance and `initScratch` returns it on every call,
 * so click-by-click state survives gesture boundaries and the preview layer
 * can read the same object.
 *
 * ## The pen draws paths; it does not reshape them
 *
 * It draws new nodes, and extends an existing node's open subpath from one
 * of its ends (see `continuing`). Reshaping an existing path is anchor
 * editing: double-click a path to
 * enter edit mode, then use the `editAnchors` / `insertPathAnchor` /
 * `nudgeAnchors` / `deleteAnchors` / `marqueeAnchors` / `cutPathAtAnchor`
 * Actions.
 *
 * The pen used to carry a second, private implementation of all of that,
 * with its own scratch mode, hit-test override, overlay, and undo
 * plumbing. It was reachable only through a `getPathObj` option whose
 * contract required `pose.kind` to be `'polygon'` or `'rect'` — which no
 * kit-created node has, including the ones the pen itself creates. So it
 * was dead in every consumer while shadowing the live implementation, and
 * the two had drifted. Its geometry now lives in
 * `features/paths/anchorEdits.ts`, driven by those Actions.
 */
export interface PenScratch {
  finishedSubpaths: PenSubpath[];
  current: PenSubpath | null;
  cursor: { x: number; y: number } | null;
  draggingHandleAt: number | null;
  closeHintActive: boolean;
  /** Set while the pen is extending an existing node's open subpath rather
   *  than drawing a new node. `current` then starts as that subpath (turned
   *  around when it was picked up by its first anchor), and the commit
   *  writes back into the node. */
  continuing: PenContinuation | null;
}

/** Which existing subpath the pen picked up, and the node's path as it was. */
export interface PenContinuation {
  id: string;
  /** Index of the picked-up subpath within `original`. */
  sub: number;
  /** True when it was picked up by its first anchor, so `current` runs
   *  backwards and is turned around again on commit. */
  reversed: boolean;
  /** The node's path in world coords at pick-up. */
  original: PolygonPath;
}

/** Options for `usePenTool`: how a finished path becomes a pose, where it is
 *  inserted, and when a closed subpath commits. */
export interface UsePenToolOptions<TPose> {
  /** Wrap a finished PolygonPath in the consumer's pose type. */
  wrapPath: (path: PolygonPath, opts: { closed: boolean }) => TPose;
  /** Insert + select adapter. */
  adapter: {
    addNode: (pose: TPose) => string;
    setSelection: (ids: string[]) => void;
    /** Build, without inserting, the node `addNode` would insert for `pose`,
     *  so the pen can put it in a larger op batch — a new path finished on
     *  another open path's endpoint is inserted and the other path deleted
     *  in one undo step. Without it, that click only places an anchor. */
    makeNode?: (pose: TPose) => { id: string };
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
   *  Measured as a screen-space circle, so it stays round under non-uniform
   *  zoom; aligns with `useSelectTool.handleHitRadius`. */
  closeHitRadius?: number;
  /** Screen-px radius within which a placed anchor lands exactly on an
   *  existing path's anchor. Default `8`; `0` turns it off. Takes precedence
   *  over `snapPoint`, which applies only when no anchor is in range. */
  anchorSnapRadius?: number;
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
    continuing: null,
  };
}

function resetScratch(s: PenScratch): void {
  s.finishedSubpaths = [];
  s.current = null;
  s.cursor = null;
  s.draggingHandleAt = null;
  s.closeHintActive = false;
  s.continuing = null;
}

/** Total anchors across finished subpaths plus the in-progress one. */
function anchorCount(s: PenScratch): number {
  return (s.current ? s.current.anchors.length : 0)
    + s.finishedSubpaths.reduce((n, sp) => n + sp.anchors.length, 0);
}

/** Build a PolygonPath from the pen's accumulated subpaths, by the same
 *  rule as any anchor set: segment A→B is a cubic through A's out-handle and
 *  B's in-handle when either exists, else a line. */
function buildPath(
  subpaths: PenSubpath[],
  trailing: PenSubpath | null,
): PolygonPath {
  const all = [...subpaths];
  if (trailing && trailing.anchors.length > 0) all.push(trailing);
  return anchorsToPath(all.map((sp) => sp.anchors), all.map((sp) => sp.closed));
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
 * Reshaping an existing path is not this tool's job — see {@link PenScratch}.
 */
export function usePenTool<TPose>(
  options: UsePenToolOptions<TPose>,
): Tool<PenScratch> {
  const { wrapPath, adapter, autoSelect = true, autoCommitOnClose = true, closeHitRadius = 8, anchorSnapRadius = 8, snapPoint } = options;

  // Persistent scratch: single ref reused across gestures so multi-click
  // state survives the dispatcher's per-gesture initScratch contract.
  const scratchRef = useRef<PenScratch | null>(null);
  if (scratchRef.current === null) scratchRef.current = freshScratch();

  // Latest options stashed so handlers see fresh values without rebuilding
  // the Tool record (which would lose scratch identity in the dispatcher).
  const optsRef = useRef({ wrapPath, adapter, autoSelect, autoCommitOnClose, closeHitRadius, anchorSnapRadius, snapPoint });
  optsRef.current = { wrapPath, adapter, autoSelect, autoCommitOnClose, closeHitRadius, anchorSnapRadius, snapPoint };

  // Scratch is a mutable ref (so click-by-click state survives the
  // dispatcher's per-gesture initScratch contract). Mutations alone don't
  // trigger React re-renders, so Canvas never re-paints and the preview
  // layer stays invisible until something else (e.g. commit) bumps host
  // state. Force a render after every scratch mutation so the host's
  // <Canvas layers={{...}}> literal gets a new identity and the paint
  // useEffect fires. Pull the trigger via ref so the memoized Tool record
  // doesn't need to rebuild.
  const [, forceRenderInternal] = useReducer((x: number) => x + 1, 0);
  const forceRenderRef = useRef(forceRenderInternal);
  forceRenderRef.current = forceRenderInternal;

  // Geometry helpers shared by the actions below. They read `optsRef` so a
  // re-render with new options is visible without rebuilding the actions
  // (which would lose the scratch identity `penPreviewLayer` reads through
  // `Tool.initScratch`).

  /** Write the pen's subpaths back into the node it picked up: the first
   *  replaces the subpath it continued, any later ones are appended. Skips
   *  the write when nothing changed, so an empty pick-up leaves no undo
   *  entry. */
  const commitContinuation = useCallback(
    (s: PenScratch, trailing: PenSubpath | null, edit: EditAnchorsDep | undefined): void => {
      const cont = s.continuing!;
      const drawn = [...s.finishedSubpaths, ...(trailing ? [trailing] : [])];
      if (!edit || drawn.length === 0) return;
      const { anchors: added, closed: addedClosed } = pathToAnchors(buildPath(drawn, null));
      if (cont.reversed) added[0] = reverseAnchors(added[0]);
      const set = pathToAnchors(cont.original);
      set.anchors.splice(cont.sub, 1, added[0]);
      set.closed.splice(cont.sub, 1, addedClosed[0]);
      set.anchors.push(...added.slice(1));
      set.closed.push(...addedClosed.slice(1));
      const next: PolygonPath = { ...anchorsToPath(set.anchors, set.closed), fillRule: cont.original.fillRule };
      if (samePath(next, cont.original)) return;
      edit.applyEdit(cont.id, next, 'Continue path');
      if (optsRef.current.autoSelect) optsRef.current.adapter.setSelection([cont.id]);
    },
    [],
  );

  const commit = useCallback((s: PenScratch, deps: ActionDeps): void => {
    const trailing = s.current && s.current.anchors.length > 0 ? s.current : null;
    if (s.continuing) {
      commitContinuation(s, trailing, deps.editAnchors as EditAnchorsDep | undefined);
      resetScratch(s);
      return;
    }
    if (s.finishedSubpaths.length === 0 && !trailing) return;
    const allClosed =
      s.finishedSubpaths.every((sp) => sp.closed) &&
      (trailing === null || trailing.closed);
    const path = buildPath(s.finishedSubpaths, trailing);
    const pose = optsRef.current.wrapPath(path, { closed: allClosed });
    const id = optsRef.current.adapter.addNode(pose);
    if (optsRef.current.autoSelect) optsRef.current.adapter.setSelection([id]);
    resetScratch(s);
  }, [commitContinuation]);

  /** Whether an anchor about to land on `hit` finishes the path by joining
   *  onto another open subpath. Its own continued subpath never counts —
   *  reaching that one's far end is a close. Declines when the deps can't
   *  commit the join as one op batch. */
  const joinable = useCallback((s: PenScratch, deps: ActionDeps, hit: PathAnchorHit | null): hit is PathAnchorHit => {
    if (!hit || hit.end === null || !s.current || s.current.anchors.length === 0) return false;
    const cont = s.continuing;
    if (cont && hit.id === cont.id && hit.sub === cont.sub) return false;
    const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
    if (!scene && !deps.applyOps) return false;
    if (!(cont ? (deps.editAnchors as EditAnchorsDep).editOps : optsRef.current.adapter.makeNode)) return false;
    return cont?.id === hit.id || scene?.get(hit.id as never) !== undefined;
  }, []);

  /** Finish the path onto `hit`, the endpoint its last anchor was just placed
   *  on: the other subpath's anchors follow on from it, turned around when
   *  `hit` is its last anchor, and its node is deleted. The path being drawn
   *  keeps its identity — a continued node keeps its id and style, and a new
   *  path is minted the way any pen path is. One op batch, so one undo. */
  const commitJoin = useCallback((s: PenScratch, deps: ActionDeps, hit: PathAnchorHit): void => {
    const edit = deps.editAnchors as EditAnchorsDep;
    const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
    const current = s.current!;
    const { anchors: added, closed: addedClosed } = pathToAnchors(buildPath([...s.finishedSubpaths, current], null));

    const other = edit.getEditablePath(hit.id) as PolygonPath;
    const otherSet = pathToAnchors(other);
    const tail = hit.end === 'last' ? reverseAnchors(otherSet.anchors[hit.sub]) : otherSet.anchors[hit.sub];
    const joined = added[added.length - 1];
    const joint = joined[joined.length - 1];
    const out = current.anchors[current.anchors.length - 1].outHandle ?? tail[0].outHandle;
    if (out) joint.outHandle = { ...out };
    joined.push(...tail.slice(1));

    const cont = s.continuing;
    const sameNode = cont?.id === hit.id;
    const rest = sameNode ? { anchors: [], closed: [] } : {
      anchors: otherSet.anchors.filter((_, i) => i !== hit.sub),
      closed: otherSet.closed.filter((_, i) => i !== hit.sub),
    };
    const label = 'Join paths';
    const ops: Op[] = [];
    let keptId: string;
    if (cont) {
      if (cont.reversed) added[0] = reverseAnchors(added[0]);
      const set = pathToAnchors(cont.original);
      set.anchors.splice(cont.sub, 1, added[0]);
      set.closed.splice(cont.sub, 1, addedClosed[0]);
      set.anchors.push(...added.slice(1), ...rest.anchors);
      set.closed.push(...addedClosed.slice(1), ...rest.closed);
      if (sameNode) {
        set.anchors.splice(hit.sub, 1);
        set.closed.splice(hit.sub, 1);
      }
      const next: PolygonPath = { ...anchorsToPath(set.anchors, set.closed), fillRule: cont.original.fillRule };
      ops.push(...edit.editOps!(cont.id, next, label));
      keptId = cont.id;
    } else {
      const path = anchorsToPath([...added, ...rest.anchors], [...addedClosed, ...rest.closed]);
      const node = optsRef.current.adapter.makeNode!(optsRef.current.wrapPath(path, { closed: false }));
      ops.push(createInsertOp({ node }));
      keptId = node.id;
    }
    if (!sameNode) ops.push(createDeleteOp({ node: scene!.get(hit.id as never) as { id: string } }));

    const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
    if (applyOps) applyOps(ops, label);
    else scene!.applyBatch(ops, label, defaultCommitAdapter(scene!));
    if (optsRef.current.autoSelect) optsRef.current.adapter.setSelection([keptId]);
    resetScratch(s);
  }, []);

  /** From idle, a press on an open subpath's end anchor picks that subpath
   *  up: it becomes `current`, turned so the pressed end is last. Returns
   *  whether it did. */
  const pickUpEndpoint = useCallback((deps: ActionDeps, wx: number, wy: number): boolean => {
    const scratch = scratchRef.current!;
    if (scratch.current || scratch.finishedSubpaths.length > 0) return false;
    const radius = optsRef.current.closeHitRadius;
    const scale = viewScale(deps);
    const hit = nearestPathAnchor(pathsNear(deps, wx, wy, radius), { x: wx, y: wy }, radius, scale, (h) => h.end !== null);
    if (!hit) return false;
    const original = (deps.editAnchors as EditAnchorsDep).getEditablePath(hit.id) as PolygonPath;
    const picked = pathToAnchors(original).anchors[hit.sub];
    const reversed = hit.end === 'first' && picked.length > 1;
    scratch.current = { anchors: reversed ? reverseAnchors(picked) : picked, closed: false };
    scratch.continuing = { id: hit.id, sub: hit.sub, reversed, original };
    return true;
  }, []);

  const snap = useCallback((x: number, y: number): { x: number; y: number } => {
    const fn = optsRef.current.snapPoint;
    return fn ? fn({ x, y }) : { x, y };
  }, []);

  /** Where an anchor pressed at `(x, y)` lands: on an existing path's anchor
   *  when one is within `anchorSnapRadius`, else wherever `snapPoint` puts it.
   *  `hit` names the anchor it snapped to. */
  const placeAt = useCallback((deps: ActionDeps, x: number, y: number): { x: number; y: number; hit: PathAnchorHit | null } => {
    const radius = optsRef.current.anchorSnapRadius;
    if (radius > 0) {
      const hit = nearestPathAnchor(pathsNear(deps, x, y, radius), { x, y }, radius, viewScale(deps));
      if (hit) return { x: hit.x, y: hit.y, hit };
    }
    return { ...snap(x, y), hit: null };
  }, [snap]);

  /** Is a world point within the close-hit radius of `(ax, ay)`? Measured as a
   *  screen-space circle, so the zone stays round under non-uniform zoom. */
  const withinCloseRadius = useCallback(
    (deps: ActionDeps, ax: number, ay: number, wx: number, wy: number): boolean => {
      return withinPxRadius(ax - wx, ay - wy, optsRef.current.closeHitRadius, viewScale(deps));
    },
    [],
  );

  /**
   * Actions the pen owns, registered by `useToolActions` from inside the
   * ActionsProvider — see `ToolDef.actions`.
   *
   * They close over `scratchRef`, which is why the pen needs no `Selector`
   * exposing tool scratch to the action layer: the state never leaves the
   * hook. `useMemo([])` keeps their identity stable for the same reason
   * `scratchRef` is a ref — the preview layer reads that one object.
   */
  const actions = useMemo<Action[]>(() => {
    const s = () => scratchRef.current!;

    return [
      {
        id: 'pen.placeAnchor',
        label: 'Pen — place anchor',
        eligible: { capability: 'creates-paths' },
        requires: ['view', 'areaSelect', 'editAnchors', 'scene', 'applyOps'],
        invoker: {
          timing: 'immediate' as const,
          run: (deps, params) => {
            const p = params as { pressX?: number; pressY?: number } | undefined;
            if (p?.pressX === undefined || p.pressY === undefined) return;
            // The press point, not the release: a click may drift up to the
            // drag threshold, and an anchor should land where you put the
            // pointer down. Snapping happens here rather than at press time
            // so the snapped value is what the geometry records.
            if (pickUpEndpoint(deps, p.pressX, p.pressY)) {
              forceRenderRef.current();
              return;
            }
            const { x: wx, y: wy, hit } = placeAt(deps, p.pressX, p.pressY);
            const scratch = s();

            // Close-on-first-anchor (>= 3 anchors). With `autoCommitOnClose`
            // on (default) this commits right away so the closed region
            // renders with its fill — Illustrator-style. With it off the
            // closed subpath stays in scratch for compound-path builds and
            // commits on Enter / tool switch.
            if (scratch.current && scratch.current.anchors.length >= 3) {
              const first = scratch.current.anchors[0];
              if (withinCloseRadius(deps, first.x, first.y, wx, wy)) {
                scratch.current.closed = true;
                scratch.finishedSubpaths.push(scratch.current);
                scratch.current = null;
                scratch.closeHintActive = false;
                if (optsRef.current.autoCommitOnClose) commit(scratch, deps);
                forceRenderRef.current();
                return;
              }
            }

            const join = joinable(scratch, deps, hit);
            // Otherwise: append a corner anchor, starting a subpath if needed.
            if (!scratch.current) scratch.current = { anchors: [], closed: false };
            scratch.current.anchors.push({ x: wx, y: wy });
            if (join) commitJoin(scratch, deps, hit);
            forceRenderRef.current();
          },
        },
      },

      {
        id: 'pen.finishOpen',
        label: 'Pen — finish open path',
        eligible: { capability: 'creates-paths' },
        requires: ['editAnchors'],
        // Needs an actual path to commit. Declining also lets the gesture
        // fall through: a ⌘-click with fewer than two anchors reaches the
        // plain-click binding and places an anchor instead.
        enabled: () => (anchorCount(s()) >= 2 ? true : ActionDisabledReason.NotApplicable),
        invoker: {
          timing: 'immediate' as const,
          run: (deps, params) => {
            const scratch = s();
            const p = params as { viaDoubleClick?: boolean } | undefined;

            // A double click arrives AFTER both of its clicks, so the second
            // one has already appended an anchor. Undo exactly that before
            // committing: pop it, and drop the subpath entirely if it was the
            // only anchor in it (which happens when the FIRST click closed a
            // subpath and the second started a fresh one). The net effect
            // matches the pen's old private 300ms detector — one anchor
            // placed, path finished — while using the dispatcher's single
            // definition of a double click.
            //
            // No position check is needed: the anchor to drop is by
            // construction the one the second click just appended.
            if (p?.viaDoubleClick && scratch.current) {
              scratch.current.anchors.pop();
              if (scratch.current.anchors.length === 0) scratch.current = null;
            }

            commit(scratch, deps);
            forceRenderRef.current();
          },
        },
      },

      {
        id: 'pen.dragHandle',
        label: 'Pen — drag out a bezier handle',
        eligible: { capability: 'creates-paths' },
        requires: ['view', 'areaSelect', 'editAnchors', 'scene', 'applyOps'],
        invoker: {
          timing: 'ongoing' as const,
          start: (ctx: InvocationCtx) => {
            const scratch = s();
            // `drag.start` is the pointerdown position — the dispatcher
            // buffers the press and releases it at the drag threshold, so the
            // anchor lands where the user pressed rather than where the
            // threshold happened to be crossed.
            const origin = ctx.drag?.start ?? ctx.world;
            // Dragging from an open path's end picks the path up and pulls
            // that end's own handle rather than placing a new anchor on it.
            const pickedUp = pickUpEndpoint(ctx.deps, origin.x, origin.y);
            // Dragging on another open path's endpoint joins onto it once
            // the handle is set.
            let joinHit: PathAnchorHit | null = null;
            if (!pickedUp) {
              const { x: ax, y: ay, hit } = placeAt(ctx.deps, origin.x, origin.y);
              if (joinable(scratch, ctx.deps, hit)) joinHit = hit;
              if (!scratch.current) scratch.current = { anchors: [], closed: false };
              scratch.current.anchors.push({ x: ax, y: ay });
            }
            scratch.draggingHandleAt = scratch.current!.anchors.length - 1;
            if (ctx.modifiers.alt) {
              scratch.current!.anchors[scratch.draggingHandleAt].altBroken = true;
            }
            // A picked-up endpoint's in-handle belongs to the existing
            // segment into it, which the pen does not reshape.
            const linked = !pickedUp;
            applyOutHandle(scratch, ctx.world, ctx.modifiers.shift, linked, optsRef.current.snapPoint);
            forceRenderRef.current();

            return {
              onMove: (moveCtx: InvocationCtx) => {
                const sm = s();
                if (sm.draggingHandleAt === null) return;
                if (moveCtx.modifiers.alt && sm.current) {
                  sm.current.anchors[sm.draggingHandleAt].altBroken = true;
                }
                applyOutHandle(sm, moveCtx.world, moveCtx.modifiers.shift, linked, optsRef.current.snapPoint);
                forceRenderRef.current();
              },
              onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
                const se = s();
                if (reason === 'cancel') {
                  // `start` appended the anchor (or picked a path up); a
                  // cancel (pointercancel is the reachable one — Escape and a
                  // tool switch both reset the whole scratch first) has to
                  // take it back out.
                  if (pickedUp) {
                    resetScratch(se);
                  } else if (se.current && se.draggingHandleAt === se.current.anchors.length - 1) {
                    se.current.anchors.pop();
                    if (se.current.anchors.length === 0) se.current = null;
                  }
                  se.draggingHandleAt = null;
                  forceRenderRef.current();
                  return;
                }
                if (se.draggingHandleAt !== null) {
                  if (endCtx.modifiers.alt && se.current) {
                    se.current.anchors[se.draggingHandleAt].altBroken = true;
                  }
                  applyOutHandle(se, endCtx.world, endCtx.modifiers.shift, linked, optsRef.current.snapPoint);
                  se.draggingHandleAt = null;
                }
                if (joinHit && se.current) commitJoin(se, ctx.deps, joinHit);
                forceRenderRef.current();
              },
            };
          },
        },
      },

      {
        id: 'pen.finish',
        label: 'Pen — finish path',
        eligible: { capability: 'creates-paths' },
        requires: ['editAnchors'],
        enabled: () => (anchorCount(s()) > 0 ? true : ActionDisabledReason.NotApplicable),
        invoker: {
          timing: 'immediate' as const,
          run: (deps) => {
            commit(s(), deps);
            forceRenderRef.current();
          },
        },
      },

      {
        id: 'pen.cancel',
        label: 'Pen — discard path',
        eligible: { capability: 'creates-paths' },
        // Declining with nothing drawn is what keeps Escape's first-match
        // ladder intact: an empty pen passes the key to `escape`, which goes
        // on to clear the selection / return to the default tool.
        enabled: () => {
          const scratch = s();
          return scratch.current !== null || scratch.finishedSubpaths.length > 0
            ? true
            : ActionDisabledReason.NotApplicable;
        },
        invoker: {
          timing: 'immediate' as const,
          run: () => {
            resetScratch(s());
            forceRenderRef.current();
          },
        },
      },
    ];
  }, [commit, placeAt, withinCloseRadius, pickUpEndpoint, joinable, commitJoin]);

  return useMemo(() => {
    return defineTool<PenScratch>({
      id: 'pen',
      capabilities: ['creates-paths'],
      hookName: 'usePenTool',
      // Reads the tool's own ref rather than a scratch handed in by a
      // dispatcher — the pen owns this state and nothing else needs it.
      cursor: () =>
        scratchRef.current?.closeHintActive
          ? 'pointer'
          : cursorFor('pen', { fallback: 'crosshair' }),
      presentation: {
        label: 'Pen',
        icon: createElement(PenIcon),
        group: 'draw',
      },
      // Persistent-ref scratch. `penPreviewLayer` reads the in-progress path
      // by calling `Tool.initScratch()` and getting this same object back, so
      // the identity is load-bearing.
      initScratch: () => scratchRef.current!,
      actions,

      onDeactivate: () => {
        // Anything still in scratch is by definition incomplete — the user
        // hasn't closed it (close-on-first-anchor), open-finished it
        // (cmd-click), or pressed Enter. Switching tools mid-path should
        // discard, not auto-commit a stub polyline that the user didn't
        // ask for. Mirrors Escape's behavior so "stop drawing" is
        // consistent across exits.
        resetScratch(scratchRef.current!);
        forceRenderRef.current();
      },

      bindings: [
        // Plain click places an anchor; ⌘/Ctrl-click open-finishes
        // (Illustrator). Strict modifier matching keeps the two apart, and
        // `mod` resolves to meta on mac / ctrl elsewhere — the tool-route
        // grammar's modifier matcher accepted either key on either platform.
        { spec: { kind: 'click' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.placeAnchor' },
        { spec: { kind: 'click' as const, mods: { mod: true, shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.finishOpen' },
        // Double-click on the last anchor also open-finishes. This used to be
        // a private 300ms/radius check inside the click route — a fourth
        // double-click detector in a codebase that had just collapsed three
        // into one (audit 3.3).
        {
          spec: { kind: 'doubleClick' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } },
          actionId: 'pen.finishOpen',
          opts: { params: { viaDoubleClick: true } },
        },
        { spec: { kind: 'drag' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.dragHandle' },
        { spec: { kind: 'key' as const, key: 'Enter' }, actionId: 'pen.finish' },
        { spec: { kind: 'key' as const, key: 'Escape' }, actionId: 'pen.cancel' },
      ],
    });
  }, [actions]);
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

/** Point the anchor's outgoing handle at `target`, optionally snapped and
 *  optionally constrained to 45° steps. When `linked` and not Alt-broken,
 *  the in-handle follows as its mirror through the anchor. */
function applyOutHandle<S extends PenScratch>(
  s: S,
  target: { x: number; y: number },
  shift: boolean,
  linked: boolean,
  snap?: (p: { x: number; y: number }) => { x: number; y: number },
): void {
  if (s.current === null || s.draggingHandleAt === null) return;
  const anchor = s.current.anchors[s.draggingHandleAt];
  const to = snap ? snap(target) : target;
  let dx = to.x - anchor.x;
  let dy = to.y - anchor.y;
  if (shift) {
    const c = constrainTo45(dx, dy);
    dx = c.dx;
    dy = c.dy;
  }
  anchor.outHandle = { x: anchor.x + dx, y: anchor.y + dy };
  if (linked && !anchor.altBroken) anchor.inHandle = { x: anchor.x - dx, y: anchor.y - dy };
}

function viewScale(deps: ActionDeps): { x: number; y: number } {
  return (deps.view as ViewApi | undefined)?.get().scale ?? { x: 1, y: 1 };
}

/** Existing editable paths, world coords, with ink within `px` screen
 *  pixels of `(wx, wy)` — front-to-back, as the area query returns them.
 *  Empty when the host publishes no `areaSelect` or `editAnchors` dep. */
function pathsNear(
  deps: ActionDeps,
  wx: number,
  wy: number,
  px: number,
): Array<{ id: string; path: PolygonPath }> {
  const area = deps.areaSelect as AreaSelectDep | undefined;
  const edit = deps.editAnchors as EditAnchorsDep | undefined;
  if (!area || !edit) return [];
  const view = deps.view as ViewApi | undefined;
  const e = pxExtent(px, viewScale(deps));
  const ids = area.hitTestArea({ x: wx - e.x, y: wy - e.y, width: 2 * e.x, height: 2 * e.y }, view);
  const out: Array<{ id: string; path: PolygonPath }> = [];
  for (const id of ids) {
    const path = edit.getEditablePath(id) as PolygonPath | null;
    if (path?.kind === 'polygon') out.push({ id, path });
  }
  return out;
}

function samePath(a: PolygonPath, b: PolygonPath): boolean {
  if (a.commands.length !== b.commands.length || a.coords.length !== b.coords.length) return false;
  for (let i = 0; i < a.commands.length; i++) if (a.commands[i] !== b.commands[i]) return false;
  for (let i = 0; i < a.coords.length; i++) if (a.coords[i] !== b.coords[i]) return false;
  return true;
}
