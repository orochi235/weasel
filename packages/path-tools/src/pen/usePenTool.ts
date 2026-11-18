import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { useKitSettings, useLatest } from '@weasel-js/react';
import { defineTool, pointSnap } from '@weasel-js/core';
import type { ModifierState, Tool } from '@weasel-js/core';
import type { Action, ToolOptionShare } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import type { ActionDeps, InvocationCtx } from '@weasel-js/routing';
import { withinPxRadius, type PathAnchorHit, type PolygonPath } from '@weasel-js/geom';
import { createPenPreviewLayer, penReachOf } from './penPreviewLayer';
import { commitPen } from './penCommit';
import { pickUpEndpoint } from './penContinuation';
import { commitJoin, joinable } from './penJoin';
import { placeAt, withinCloseRadius, type PenPlacement } from './penTargets';
import { PEN_HANDLE_ROLES, pullHandle } from './penHandle';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../icons.gen';
import { penOptionValues, penToolOptions } from './penOptions';
import { anchorCount, freshScratch, resetScratch, startSubpath } from './penScratch';
import { createPointerFollower } from '@weasel-js/editing';

/**
 * In-progress pen anchor. A click places a corner, with no handles. A drag
 * sets `outHandle` to the drag point and `inHandle` to its mirror through
 * the anchor, which shapes the segment coming into it.
 */
export interface PenDraftAnchor {
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
  anchors: PenDraftAnchor[];
  closed: boolean;
  /** Begun by the press right after one that closed and committed a path:
   *  the second click of a double click on the first anchor, which the
   *  double click takes back. */
  followsClose?: boolean;
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
  /** The last press closed and committed a path; the next subpath begun
   *  `followsClose`. */
  justClosed?: boolean;
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
   *  it, as Escape does. The `autoCommitOnClose` option's default. */
  autoCommitOnClose?: boolean;
  /** Laid over the pen's own option shares: `{ fill: null }` keeps the pen's
   *  fill its own. Keep it stable across renders. */
  share?: ToolOptionShare;
  /** Screen-px hit radius for "click first anchor to close". Default the `targets.penCloseHitPx` kit setting, else `8`.
   *  Measured as a screen-space circle, so it stays round under non-uniform
   *  zoom; aligns with `useSelectTool.handleHitRadius`. */
  closeHitRadius?: number;
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
  const { autoSelect = true, autoCommitOnClose, closeHitRadius, share } = options;
  const toolOptions = useMemo(() => penToolOptions(share, autoCommitOnClose), [share, autoCommitOnClose]);

  const scratchRef = useRef<PenScratch | null>(null);
  if (scratchRef.current === null) scratchRef.current = freshScratch();

  const optsRef = useLatest({ autoSelect, toolOptions, closeHitRadius, kitSettings: useKitSettings() });
  const [snaps] = useState(pointSnap);

  // Scratch mutations alone don't trigger React re-renders, so the preview
  // layer would not repaint. Force a render after every scratch mutation.
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const [overlay] = useState(() => createPenPreviewLayer({ state: scratchRef.current!, kitSettings: () => optsRef.current.kitSettings }));

  const commit = useCallback((s: PenScratch, deps: ActionDeps): void => commitPen(s, deps, optsRef.current), [optsRef]);

  const commitJoinAt = useCallback((s: PenScratch, deps: ActionDeps, hit: PathAnchorHit): void => commitJoin(s, deps, hit, optsRef.current), [optsRef]);

  const pickUpEndpointAt = useCallback((deps: ActionDeps, wx: number, wy: number): boolean =>
    pickUpEndpoint(scratchRef.current!, deps, wx, wy, penReachOf(optsRef.current).close), [optsRef]);

  const placeAnchorAt = useCallback((deps: ActionDeps, x: number, y: number, mods: ModifierState): PenPlacement =>
    placeAt(deps, snaps, x, y, mods, penReachOf(optsRef.current).close, scratchRef.current!.current?.anchors.at(-1)), [snaps, optsRef]);

  const closesAt = useCallback((deps: ActionDeps, ax: number, ay: number, wx: number, wy: number): boolean =>
    withinCloseRadius(deps, ax, ay, wx, wy, penReachOf(optsRef.current).close), [optsRef]);

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
        : s.draggingHandleAt !== null ? { ...at.world }
          : snaps.trail(followed?.snap, at.world, s.current?.anchors.at(-1));
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
      defineAction({
        id: 'pen.placeAnchor',
        label: 'Pen — place anchor',
        eligible: { capability: 'creates-paths' },
        requires: ['view', 'pointer', 'areaSelect', 'editAnchors', 'scene', 'applyOps', 'insert', 'operands', 'snap', 'toolOptionValues'],
        invoker: {
          timing: 'immediate',
          run: (deps, p) => {
            const press = p?.press;
            if (!press) return;
            // The press point, not the release: a click may drift up to the
            // drag threshold.
            if (pickUpEndpointAt(deps, press.x, press.y)) {
              trail.update(deps);
              return;
            }
            const { x: wx, y: wy, hit } = placeAnchorAt(deps, press.x, press.y, p.mods ?? NO_KEYS);
            const scratch = s();

            // Close-on-first-anchor (>= 3 anchors). With `autoCommitOnClose`
            // off the closed subpath stays in scratch for compound-path builds.
            if (scratch.current && scratch.current.anchors.length >= 3) {
              const first = scratch.current.anchors[0];
              if (closesAt(deps, first.x, first.y, wx, wy)) {
                scratch.current.closed = true;
                scratch.finishedSubpaths.push(scratch.current);
                scratch.current = null;
                scratch.closeHintActive = false;
                if (penOptionValues(optsRef.current.toolOptions, deps).autoCommitOnClose) { commit(scratch, deps); scratch.justClosed = true; }
                trail.update(deps);
                return;
              }
            }

            const join = joinable(scratch, deps, hit);
            scratch.current ??= startSubpath(scratch);
            scratch.current.anchors.push({ x: wx, y: wy });
            if (join) commitJoinAt(scratch, deps, hit);
            trail.update(deps);
          },
        },
      }),

      defineAction({
        id: 'pen.finishOpen',
        label: 'Pen — finish open path',
        eligible: { capability: 'creates-paths' },
        requires: ['editAnchors', 'insert', 'operands', 'toolOptionValues'],
        // Needs a path, or a double click's own lone anchor, to take back. Declining lets a
        // ⌘-click with fewer than two anchors reach the plain-click binding.
        enabled: () => (anchorCount(s()) >= 2 || s().current?.followsClose ? true : ActionDisabledReason.NotApplicable),
        invoker: {
          timing: 'immediate',
          run: (deps, p) => {
            const scratch = s();
            if (!p?.viaDoubleClick && anchorCount(scratch) < 2) return 'pass';

            // A double click arrives AFTER both of its clicks, so the second one has already
            // appended an anchor: pop it, and the subpath with it when it was the only one
            // (the FIRST click closed a subpath and the second started a fresh one).
            if (p?.viaDoubleClick && scratch.current) {
              scratch.current.anchors.pop();
              if (scratch.current.anchors.length === 0) scratch.current = null;
            }

            commit(scratch, deps);
            trail.refresh();
            return undefined;
          },
        },
      }),

      {
        id: 'pen.dragHandle',
        label: 'Pen — drag out a bezier handle',
        eligible: { capability: 'creates-paths' },
        modifierRoles: PEN_HANDLE_ROLES,
        requires: ['view', 'pointer', 'areaSelect', 'editAnchors', 'scene', 'applyOps', 'insert', 'operands', 'snap', 'toolOptionValues'],
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
            const pickedUp = pickUpEndpointAt(ctx.deps, origin.x, origin.y);
            // Dragging on another open path's endpoint joins onto it once
            // the handle is set.
            let joinHit: PathAnchorHit | null = null;
            if (!pickedUp) {
              const { x: ax, y: ay, hit } = placeAnchorAt(ctx.deps, origin.x, origin.y, ctx.modifiers);
              if (joinable(scratch, ctx.deps, hit)) joinHit = hit;
              scratch.current ??= startSubpath(scratch);
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
                  if (joinHit && se.current) commitJoinAt(se, ctx.deps, joinHit);
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
        requires: ['editAnchors', 'insert', 'operands', 'toolOptionValues'],
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
  }, [commit, placeAnchorAt, closesAt, pickUpEndpointAt, commitJoinAt, optsRef, trail, forceRender]);

  return useMemo(() => {
    return defineTool({
      id: 'pen',
      keybinding: { key: 'P' },
      capabilities: ['creates-paths'],
      hookName: 'usePenTool',
      options: toolOptions,
      cursor: () =>
        scratchRef.current?.closeHintActive
          ? 'pointer'
          : cursorFor('pen', { fallback: 'crosshair' }),
      presentation: {
        label: 'Pen',
        icon: icon('core:pen'),
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
  }, [actions, trail, overlay, toolOptions]);
}


const NO_KEYS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };
