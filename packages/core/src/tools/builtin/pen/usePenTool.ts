import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { useKitSettings, useLatest } from '@weasel-js/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { asNodeId } from 'core/scene/types';
import { pxExtent, withinPxRadius, nearestPathAnchor, reverseAnchors, type PathAnchorHit } from '@weasel-js/geom';
import { boundsOfPath, type PolygonPath, anchorsToPath, editAnchorSetTracked, pathToAnchors } from '@weasel-js/geom';
import { createPenPreviewLayer, penReachOf } from 'domains/paths/penPreviewLayer';
import { resolveEditablePathOf } from 'domains/paths/editablePath';
import type { Op } from 'core/ops/types';
import { createDeleteOp } from 'core/ops/delete';
import { defaultCommitAdapter } from 'interactions/actions/defaultCommitAdapter';
import { PEN_HANDLE_ROLES, pullHandle } from './penHandle';
import { pointSnap } from 'domains/snap/pointSnap';
import { snapMods } from 'domains/snap/roles';
import type { ModifierState } from 'core/modifierState';
import { cursorFor } from '@weasel-js/cursor';
import { createPointerFollower } from '../shared/pointerFollower';
import { icon } from '../../../icons.gen';

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
 * Mutable state shared across pen-tool gestures. The hook keeps a single
 * instance for its life and changes it in place, so click-by-click state
 * survives gesture boundaries and the tool's preview overlay reads the same
 * object.
 *
 * The pen draws new nodes, and extends an existing node's open subpath from
 * one of its ends (see `continuing`). Reshaping an existing path is anchor
 * editing: double-click a path to enter edit mode.
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

/** Options for `usePenTool`: when a closed subpath commits. A finished path
 *  is inserted through the `insert` dep as kind `'path'`, the route every
 *  shape tool takes, so a consumer shapes the node by overriding that dep.
 *  Anchors, the rubber band and the handles snap through the `snap` dep's
 *  `point` sessions, about the anchor placed before. */
export interface UsePenToolOptions {
  /** Auto-select the new object after commit. Default `true`. */
  autoSelect?: boolean;
  /** When true (default), clicking the first anchor to close a subpath
   *  commits immediately — the closed region renders with its fill right
   *  away. When false, the closed subpath stays in scratch so the user can
   *  start another subpath; commit then fires on Enter / ⌘-click /
   *  double-click, producing a compound path. Switching tools first discards
   *  it, as Escape does. */
  autoCommitOnClose?: boolean;
  /** Screen-px hit radius for "click first anchor to close". Default the `targets.penCloseHitPx` kit setting, else `8`.
   *  Measured as a screen-space circle, so it stays round under non-uniform
   *  zoom; aligns with `useSelectTool.handleHitRadius`. */
  closeHitRadius?: number;
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
 * Click places a corner anchor; click-drag places an anchor with an
 * outgoing bezier handle; click-the-first-anchor closes the subpath; Enter
 * open-finishes; Esc discards, and so does a tool switch. Shift constrains the placement-drag handle to 0/45/90/135°;
 * Alt during drag breaks the handle mirror for the next segment.
 *
 * Reshaping an existing path is not this tool's job — see {@link PenScratch}.
 */
export function usePenTool(
  options: UsePenToolOptions = {},
): Tool {
  const { autoSelect = true, autoCommitOnClose = true, closeHitRadius } = options;

  const scratchRef = useRef<PenScratch | null>(null);
  if (scratchRef.current === null) scratchRef.current = freshScratch();

  // Latest options stashed so handlers see fresh values without rebuilding
  // the Tool record.
  const optsRef = useLatest({ autoSelect, autoCommitOnClose, closeHitRadius, kitSettings: useKitSettings() });
  const [snaps] = useState(pointSnap);

  // Scratch mutations alone don't trigger React re-renders, so the preview
  // layer would not repaint. Force a render after every scratch mutation.
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const [overlay] = useState(() => createPenPreviewLayer({ state: scratchRef.current!, kitSettings: () => optsRef.current.kitSettings }));

  /** Write the pen's subpaths back into the node it picked up: the first
   *  replaces the subpath it continued, any later ones are appended. Skips
   *  the write when nothing changed, so an empty pick-up leaves no undo
   *  entry. */
  const commitContinuation = useCallback(
    (s: PenScratch, trailing: PenSubpath | null, deps: ActionDeps): void => {
      const edit = deps.editAnchors;
      const cont = s.continuing!;
      const drawn = [...s.finishedSubpaths, ...(trailing ? [trailing] : [])];
      if (!edit || drawn.length === 0) return;
      const { anchors: added, closed: addedClosed } = pathToAnchors(buildPath(drawn, null));
      if (cont.reversed) added[0] = reverseAnchors(added[0]);
      const next = editAnchorSetTracked(cont.original, (set) => {
        set.anchors.splice(cont.sub, 1, added[0]);
        set.closed.splice(cont.sub, 1, addedClosed[0]);
        set.anchors.push(...added.slice(1));
        set.closed.push(...addedClosed.slice(1));
      })!;
      if (samePath(next.path, cont.original)) return;
      edit.applyEdit(cont.id, next.path, 'Continue path', next.origins);
      if (optsRef.current.autoSelect) deps.selection?.set([asNodeId(cont.id)]);
    },
    [optsRef],
  );

  const commit = useCallback((s: PenScratch, deps: ActionDeps): void => {
    const trailing = s.current && s.current.anchors.length > 0 ? s.current : null;
    if (s.continuing) {
      commitContinuation(s, trailing, deps);
      resetScratch(s);
      return;
    }
    // One anchor draws nothing; committing it would leave an invisible node.
    const open = trailing && trailing.anchors.length >= 2 ? trailing : null;
    if (s.finishedSubpaths.length === 0 && !open) {
      resetScratch(s);
      return;
    }
    const allClosed =
      s.finishedSubpaths.every((sp) => sp.closed) &&
      (open === null || open.closed);
    const path = buildPath(s.finishedSubpaths, open);
    const id = deps.insert?.commit(boundsOfPath(path), { kind: 'path', path, closed: allClosed }) ?? null;
    if (id !== null && optsRef.current.autoSelect) deps.selection?.set([id]);
    resetScratch(s);
  }, [commitContinuation, optsRef]);

  /** Whether an anchor about to land on `hit` finishes the path by joining
   *  onto another open subpath. Its own continued subpath never counts —
   *  reaching that one's far end is a close. Declines when the deps can't
   *  commit the join as one op batch. */
  const joinable = useCallback((s: PenScratch, deps: ActionDeps, hit: PathAnchorHit | null): hit is PathAnchorHit => {
    if (!hit || hit.end === null || !s.current || s.current.anchors.length === 0) return false;
    const cont = s.continuing;
    if (cont && hit.id === cont.id && hit.sub === cont.sub) return false;
    const scene = deps.scene;
    if (!scene && !deps.applyOps) return false;
    if (!(cont ? deps.editAnchors?.editOps : deps.insert?.build)) return false;
    return cont?.id === hit.id || scene?.get(hit.id as never) !== undefined;
  }, []);

  /** Finish the path onto `hit`, the endpoint its last anchor was just placed
   *  on: the other subpath's anchors follow on from it, turned around when
   *  `hit` is its last anchor, and its node is deleted. The path being drawn
   *  keeps its identity — a continued node keeps its id and style, and a new
   *  path is minted the way any pen path is. One op batch, so one undo. */
  const commitJoin = useCallback((s: PenScratch, deps: ActionDeps, hit: PathAnchorHit): void => {
    const edit = deps.editAnchors!;
    const scene = deps.scene;
    const current = s.current!;
    const { anchors: added, closed: addedClosed } = pathToAnchors(buildPath([...s.finishedSubpaths, current], null));

    const other = (resolveEditablePathOf(scene?.get(hit.id as never)) ?? edit.getEditablePath(hit.id)) as PolygonPath;
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
      const next = editAnchorSetTracked(cont.original, (set) => {
        set.anchors.splice(cont.sub, 1, added[0]);
        set.closed.splice(cont.sub, 1, addedClosed[0]);
        set.anchors.push(...added.slice(1), ...rest.anchors);
        set.closed.push(...addedClosed.slice(1), ...rest.closed);
        if (!sameNode) return;
        set.anchors.splice(hit.sub, 1);
        set.closed.splice(hit.sub, 1);
      })!;
      ops.push(...edit.editOps!(cont.id, next.path, label, next.origins));
      keptId = cont.id;
    } else {
      const path = anchorsToPath([...added, ...rest.anchors], [...addedClosed, ...rest.closed]);
      const built = deps.insert!.build!(boundsOfPath(path), { kind: 'path', path, closed: false });
      if (built === null) return;
      ops.push(...built.ops);
      keptId = built.id;
    }
    if (!sameNode) ops.push(createDeleteOp({ node: scene!.get(hit.id as never) as { id: string } }));

    const applyOps = deps.applyOps;
    if (applyOps) applyOps(ops, label);
    else scene!.applyBatch(ops, label, defaultCommitAdapter(scene!));
    if (optsRef.current.autoSelect) deps.selection?.set([asNodeId(keptId)]);
    resetScratch(s);
  }, [optsRef]);

  /** From idle, a press on an open subpath's end anchor picks that subpath
   *  up: it becomes `current`, turned so the pressed end is last. Returns
   *  whether it did. */
  const pickUpEndpoint = useCallback((deps: ActionDeps, wx: number, wy: number): boolean => {
    const scratch = scratchRef.current!;
    if (scratch.current || scratch.finishedSubpaths.length > 0) return false;
    const hit = openEndNear(deps, wx, wy, penReachOf(optsRef.current).close);
    if (!hit) return false;
    const original = deps.editAnchors!.getEditablePath(hit.id) as PolygonPath;
    const picked = pathToAnchors(original).anchors[hit.sub];
    const reversed = hit.end === 'first' && picked.length > 1;
    scratch.current = { anchors: reversed ? reverseAnchors(picked) : picked, closed: false };
    scratch.continuing = { id: hit.id, sub: hit.sub, reversed, original };
    return true;
  }, [optsRef]);

  /** Where an anchor pressed at `(x, y)` lands: on an open subpath's end
   *  within the close-hit radius of the press, which `hit` names, else
   *  wherever the snap session puts it. */
  const placeAt = useCallback((deps: ActionDeps, x: number, y: number, mods: ModifierState): { x: number; y: number; hit: PathAnchorHit | null } => {
    const hit = openEndNear(deps, x, y, penReachOf(optsRef.current).close);
    if (hit) return { x: hit.x, y: hit.y, hit };
    const last = scratchRef.current!.current?.anchors.at(-1);
    return { ...snaps.place(deps.snap, { x, y }, snapMods({ modifiers: mods }), last).point, hit: null };
  }, [snaps, optsRef]);

  /** Is a world point within the close-hit radius of `(ax, ay)`? Measured as a
   *  screen-space circle, so the zone stays round under non-uniform zoom. */
  const withinCloseRadius = useCallback((deps: ActionDeps, ax: number, ay: number, wx: number, wy: number): boolean =>
    withinPxRadius(ax - wx, ay - wy, penReachOf(optsRef.current).close, viewScale(deps)), [optsRef]);

  // The rubber band and the close hint trail the `pointer` dep while a path is
  // in progress. `followed` is the deps last followed through.
  const trail = useMemo(() => {
    let followed: ActionDeps | undefined;
    const follower = createPointerFollower(() => track());
    const track = (): void => {
      const s = scratchRef.current!;
      if (!s.current && s.finishedSubpaths.length === 0) follower.unfollow();
      const at = s.current ? follower.pointer()?.get() ?? null : null;
      // A handle drag snaps through its own session, and hides the rubber band.
      if (!at || s.draggingHandleAt !== null) snaps.stop();
      s.cursor = !at ? null
        : s.draggingHandleAt !== null ? { x: at.worldX, y: at.worldY }
          : snaps.trail(followed?.snap, { x: at.worldX, y: at.worldY }, s.current?.anchors.at(-1));
      const first = s.current && s.current.anchors.length >= 3 ? s.current.anchors[0] : null;
      s.closeHintActive = first !== null && s.cursor !== null && withinPxRadius(
        first.x - s.cursor.x, first.y - s.cursor.y,
        penReachOf(optsRef.current).close, followed?.view?.get().scale ?? { x: 1, y: 1 },
      );
      forceRender();
    };
    return {
      /** Repaint after a scratch change. */
      refresh: track,
      /** The same, following `deps`' pointer from here on. */
      update(deps: ActionDeps): void {
        followed = deps; // eslint-disable-line react-hooks/immutability -- the trail's own deps, read by `track`
        follower.follow(deps.pointer);
        track();
      },
      stop(): void {
        follower.unfollow();
        snaps.stop();
        forceRender();
      },
    };
  }, [snaps, optsRef]);

  /**
   * Actions the pen owns, registered by `useToolActions` from inside the
   * ActionsProvider — see `ToolDef.actions`. They close over `scratchRef`,
   * so the state never leaves the hook.
   */
  const actions = useMemo<Action[]>(() => {
    const s = () => scratchRef.current!;

    return [
      {
        id: 'pen.placeAnchor',
        label: 'Pen — place anchor',
        eligible: { capability: 'creates-paths' },
        requires: ['view', 'pointer', 'areaSelect', 'editAnchors', 'scene', 'applyOps', 'insert', 'selection', 'snap'],
        invoker: {
          timing: 'immediate' as const,
          run: (deps, params) => {
            const p = params as { pressX?: number; pressY?: number; mods?: ModifierState } | undefined;
            if (p?.pressX === undefined || p.pressY === undefined) return;
            // The press point, not the release: a click may drift up to the
            // drag threshold.
            if (pickUpEndpoint(deps, p.pressX, p.pressY)) {
              trail.update(deps);
              return;
            }
            const { x: wx, y: wy, hit } = placeAt(deps, p.pressX, p.pressY, p.mods ?? NO_KEYS);
            const scratch = s();

            // Close-on-first-anchor (>= 3 anchors). With `autoCommitOnClose`
            // off the closed subpath stays in scratch for compound-path builds.
            if (scratch.current && scratch.current.anchors.length >= 3) {
              const first = scratch.current.anchors[0];
              if (withinCloseRadius(deps, first.x, first.y, wx, wy)) {
                scratch.current.closed = true;
                scratch.finishedSubpaths.push(scratch.current);
                scratch.current = null;
                scratch.closeHintActive = false;
                if (optsRef.current.autoCommitOnClose) commit(scratch, deps);
                trail.update(deps);
                return;
              }
            }

            const join = joinable(scratch, deps, hit);
            if (!scratch.current) scratch.current = { anchors: [], closed: false };
            scratch.current.anchors.push({ x: wx, y: wy });
            if (join) commitJoin(scratch, deps, hit);
            trail.update(deps);
          },
        },
      },

      {
        id: 'pen.finishOpen',
        label: 'Pen — finish open path',
        eligible: { capability: 'creates-paths' },
        requires: ['editAnchors', 'insert', 'selection'],
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
            // subpath and the second started a fresh one).
            if (p?.viaDoubleClick && scratch.current) {
              scratch.current.anchors.pop();
              if (scratch.current.anchors.length === 0) scratch.current = null;
            }

            commit(scratch, deps);
            trail.refresh();
          },
        },
      },

      {
        id: 'pen.dragHandle',
        label: 'Pen — drag out a bezier handle',
        eligible: { capability: 'creates-paths' },
        modifierRoles: PEN_HANDLE_ROLES,
        requires: ['view', 'pointer', 'areaSelect', 'editAnchors', 'scene', 'applyOps', 'insert', 'selection', 'snap'],
        invoker: {
          timing: 'ongoing' as const,
          start: (ctx: InvocationCtx) => {
            const scratch = s();
            // `drag.start` is the pointerdown position, so the anchor lands
            // where the user pressed rather than where the drag threshold
            // happened to be crossed.
            const origin = ctx.drag?.start ?? ctx.world;
            // Dragging from an open path's end picks the path up and pulls
            // that end's own handle rather than placing a new anchor on it.
            const pickedUp = pickUpEndpoint(ctx.deps, origin.x, origin.y);
            // Dragging on another open path's endpoint joins onto it once
            // the handle is set.
            let joinHit: PathAnchorHit | null = null;
            if (!pickedUp) {
              const { x: ax, y: ay, hit } = placeAt(ctx.deps, origin.x, origin.y, ctx.modifiers);
              if (joinable(scratch, ctx.deps, hit)) joinHit = hit;
              if (!scratch.current) scratch.current = { anchors: [], closed: false };
              scratch.current.anchors.push({ x: ax, y: ay });
            }
            scratch.draggingHandleAt = scratch.current!.anchors.length - 1;
            // A picked-up endpoint's in-handle belongs to the existing
            // segment into it, which the pen does not reshape.
            const handle = pullHandle(scratch, ctx, !pickedUp);
            handle.to(ctx);
            trail.update(ctx.deps);

            return {
              onMove: (moveCtx: InvocationCtx) => {
                handle.to(moveCtx);
                forceRender();
              },
              onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
                const se = s();
                try {
                  if (reason === 'cancel') {
                    // `start` appended the anchor (or picked a path up); a
                    // cancel has to take it back out.
                    if (pickedUp) {
                      resetScratch(se);
                    } else if (se.current && se.draggingHandleAt === se.current.anchors.length - 1) {
                      se.current.anchors.pop();
                      if (se.current.anchors.length === 0) se.current = null;
                    }
                    se.draggingHandleAt = null;
                    return;
                  }
                  handle.to(endCtx);
                  se.draggingHandleAt = null;
                  if (joinHit && se.current) commitJoin(se, ctx.deps, joinHit);
                } finally {
                  handle.end();
                  trail.refresh();
                }
              },
            };
          },
        },
      },

      {
        id: 'pen.finish',
        label: 'Pen — finish path',
        eligible: { capability: 'creates-paths' },
        requires: ['editAnchors', 'insert', 'selection'],
        enabled: () => (anchorCount(s()) > 0 ? true : ActionDisabledReason.NotApplicable),
        invoker: {
          timing: 'immediate' as const,
          run: (deps) => {
            commit(s(), deps);
            trail.refresh();
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
            trail.refresh();
          },
        },
      },
    ];
  }, [commit, placeAt, withinCloseRadius, pickUpEndpoint, joinable, commitJoin, optsRef, trail, forceRender]);

  return useMemo(() => {
    return defineTool({
      id: 'pen',
      keybinding: { key: 'P' },
      capabilities: ['creates-paths'],
      hookName: 'usePenTool',
      cursor: () =>
        scratchRef.current?.closeHintActive
          ? 'pointer'
          : cursorFor('pen', { fallback: 'crosshair' }),
      presentation: {
        label: 'Pen',
        icon: icon('pen'),
        group: 'draw',
      },
      actions,
      overlay,
      overlayPosition: 'before-selection',

      onDeactivate: () => {
        // Anything still in scratch is incomplete. Switching tools mid-path
        // discards it, as Escape does, rather than committing a stub polyline.
        resetScratch(scratchRef.current!);
        trail.stop();
      },

      bindings: [
        // Plain click places an anchor; ⌘/Ctrl-click open-finishes. Strict
        // modifier matching keeps the two apart.
        { spec: { kind: 'click' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.placeAnchor', opts: { id: 'pen.click' } },
        { spec: { kind: 'click' as const, mods: { mod: true, shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.finishOpen', opts: { id: 'pen.modClick' } },
        // Double-click on the last anchor also open-finishes.
        {
          spec: { kind: 'doubleClick' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } },
          actionId: 'pen.finishOpen',
          opts: { id: 'pen.doubleClick', params: { viaDoubleClick: true } },
        },
        { spec: { kind: 'drag' as const, mods: { shift: 'optional' as const, alt: 'optional' as const, ctrl: 'optional' as const } }, actionId: 'pen.dragHandle', opts: { id: 'pen.drag' } },
        { spec: { kind: 'key' as const, key: 'Enter' }, actionId: 'pen.finish', opts: { id: 'pen.finish' } },
        { spec: { kind: 'key' as const, key: 'Escape' }, actionId: 'pen.cancel', opts: { id: 'pen.cancel' } },
      ],
    });
  }, [actions, trail, overlay]);
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
} satisfies PrefGroup;

const NO_KEYS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };

/** The end anchor of an open subpath within `px` screen pixels of `(wx, wy)`,
 *  nearest first; null when there is none. */
function openEndNear(deps: ActionDeps, wx: number, wy: number, px: number): PathAnchorHit | null {
  return nearestPathAnchor(pathsNear(deps, wx, wy, px), { x: wx, y: wy }, px, viewScale(deps), (h) => h.end !== null);
}

function viewScale(deps: ActionDeps): { x: number; y: number } {
  return deps.view?.get().scale ?? { x: 1, y: 1 };
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
  const area = deps.areaSelect;
  const edit = deps.editAnchors;
  if (!area || !edit) return [];
  const view = deps.view;
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
