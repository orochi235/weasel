/** The actions the pen tool owns: place an anchor, drag out a handle, finish, and discard. */
import type { ModifierState, PointSnap } from '@weasel-js/core';
import type { KitSettingsStore } from '@weasel-js/react';
import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import type { Action, ActionDeps, InvocationCtx } from '@weasel-js/routing';
import type { PathAnchorHit } from '@weasel-js/geom';
import { commitPen, type PenCommitSettings } from './penCommit';
import { pickUpEndpoint } from './penContinuation';
import { PEN_HANDLE_ROLES, pullHandle } from './penHandle';
import { commitJoin, joinable } from './penJoin';
import { penOptionValues } from './penOptions';
import { penReachOf } from './penPreviewLayer';
import { anchorCount, resetScratch, startSubpath } from './penScratch';
import { placeAt, withinCloseRadius, type PenPlacement } from './penTargets';
import type { PenTrail } from './penTrail';
import type { PenScratch } from './usePenTool';

/** The tool's options as they stand when an action runs. */
export interface PenSettings extends PenCommitSettings {
  closeHitRadius?: number;
  kitSettings?: KitSettingsStore;
}

/** What the pen's actions share, fixed for the tool's life. */
export interface PenActionEnv {
  /** The tool's one scratch, changed in place. */
  scratch: PenScratch;
  snaps: PointSnap;
  trail: PenTrail;
  settings: () => PenSettings;
  repaint: () => void;
}

const NO_KEYS: ModifierState = { alt: false, ctrl: false, meta: false, shift: false };

/** The pen's actions, registered by `useToolActions` from inside the
 *  ActionsProvider — see `ToolDef.actions`. */
export function createPenActions(env: PenActionEnv): Action[] {
  return [
    createPlaceAnchorAction(env),
    createFinishOpenAction(env),
    createDragHandleAction(env),
    createFinishAction(env),
    createCancelAction(env),
  ];
}

const closePxOf = (env: PenActionEnv): number => penReachOf(env.settings()).close;

function placementFor(env: PenActionEnv, deps: ActionDeps, x: number, y: number, mods: ModifierState): PenPlacement {
  return placeAt(deps, env.snaps, x, y, mods, closePxOf(env), env.scratch.current?.anchors.at(-1));
}

function createPlaceAnchorAction(env: PenActionEnv): Action {
  const { scratch, trail } = env;
  return defineAction({
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
        if (pickUpEndpoint(scratch, deps, press.x, press.y, closePxOf(env))) {
          trail.update(deps);
          return;
        }
        const { x: wx, y: wy, hit } = placementFor(env, deps, press.x, press.y, p.mods ?? NO_KEYS);

        // Close-on-first-anchor (>= 3 anchors). With `autoCommitOnClose`
        // off the closed subpath stays in scratch for compound-path builds.
        if (scratch.current && scratch.current.anchors.length >= 3) {
          const first = scratch.current.anchors[0];
          if (withinCloseRadius(deps, first.x, first.y, wx, wy, closePxOf(env))) {
            scratch.current.closed = true;
            scratch.finishedSubpaths.push(scratch.current);
            scratch.current = null;
            scratch.closeHintActive = false;
            if (penOptionValues(env.settings().toolOptions, deps).autoCommitOnClose) { commitPen(scratch, deps, env.settings()); scratch.justClosed = true; }
            trail.update(deps);
            return;
          }
        }

        const join = joinable(scratch, deps, hit);
        scratch.current ??= startSubpath(scratch);
        scratch.current.anchors.push({ x: wx, y: wy });
        if (join) commitJoin(scratch, deps, hit, env.settings());
        trail.update(deps);
      },
    },
  });
}

function createFinishOpenAction({ scratch, trail, settings }: PenActionEnv): Action {
  return defineAction({
    id: 'pen.finishOpen',
    label: 'Pen — finish open path',
    eligible: { capability: 'creates-paths' },
    requires: ['editAnchors', 'insert', 'operands', 'toolOptionValues'],
    // Needs a path, or a double click's own lone anchor, to take back. Declining lets a
    // ⌘-click with fewer than two anchors reach the plain-click binding.
    enabled: () => (anchorCount(scratch) >= 2 || scratch.current?.followsClose ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: (deps, p) => {
        if (!p?.viaDoubleClick && anchorCount(scratch) < 2) return 'pass';

        // A double click arrives AFTER both of its clicks, so the second one has already
        // appended an anchor: pop it, and the subpath with it when it was the only one
        // (the FIRST click closed a subpath and the second started a fresh one).
        if (p?.viaDoubleClick && scratch.current) {
          scratch.current.anchors.pop();
          if (scratch.current.anchors.length === 0) scratch.current = null;
        }

        commitPen(scratch, deps, settings());
        trail.refresh();
        return undefined;
      },
    },
  });
}

function createDragHandleAction(env: PenActionEnv): Action {
  const { scratch, trail, repaint } = env;
  return {
    id: 'pen.dragHandle',
    label: 'Pen — drag out a bezier handle',
    eligible: { capability: 'creates-paths' },
    modifierRoles: PEN_HANDLE_ROLES,
    requires: ['view', 'pointer', 'areaSelect', 'editAnchors', 'scene', 'applyOps', 'insert', 'operands', 'snap', 'toolOptionValues'],
    invoker: {
      timing: 'ongoing' as const,
      start: (ctx: InvocationCtx) => {
        // `drag.start` is the pointerdown position, so the anchor lands
        // where the user pressed rather than where the drag threshold
        // happened to be crossed.
        const origin = ctx.drag?.start ?? ctx.world;
        // Dragging from an open path's end picks the path up and pulls
        // that end's own handle rather than placing a new anchor on it.
        const pickedUp = pickUpEndpoint(scratch, ctx.deps, origin.x, origin.y, closePxOf(env));
        // Dragging on another open path's endpoint joins onto it once
        // the handle is set.
        let joinHit: PathAnchorHit | null = null;
        if (!pickedUp) {
          const { x: ax, y: ay, hit } = placementFor(env, ctx.deps, origin.x, origin.y, ctx.modifiers);
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
            repaint();
          },
          onEnd: (endCtx: InvocationCtx, reason: 'commit' | 'cancel') => {
            try {
              if (reason === 'cancel') {
                // `start` appended the anchor (or picked a path up); a
                // cancel has to take it back out.
                if (pickedUp) {
                  resetScratch(scratch);
                } else if (scratch.current && scratch.draggingHandleAt === scratch.current.anchors.length - 1) {
                  scratch.current.anchors.pop();
                  if (scratch.current.anchors.length === 0) scratch.current = null;
                }
                scratch.draggingHandleAt = null;
                return;
              }
              handle.to(endCtx);
              scratch.draggingHandleAt = null;
              if (joinHit && scratch.current) commitJoin(scratch, ctx.deps, joinHit, env.settings());
            } finally {
              handle.end();
              trail.refresh();
            }
          },
        };
      },
    },
  };
}

function createFinishAction({ scratch, trail, settings }: PenActionEnv): Action {
  return {
    id: 'pen.finish',
    label: 'Pen — finish path',
    eligible: { capability: 'creates-paths' },
    requires: ['editAnchors', 'insert', 'operands', 'toolOptionValues'],
    enabled: () => (anchorCount(scratch) > 0 ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate' as const,
      run: (deps) => {
        commitPen(scratch, deps, settings());
        trail.refresh();
      },
    },
  };
}

function createCancelAction({ scratch, trail }: PenActionEnv): Action {
  return {
    id: 'pen.cancel',
    label: 'Pen — discard path',
    eligible: { capability: 'creates-paths' },
    // Declining with nothing drawn is what keeps Escape's first-match
    // ladder intact: an empty pen passes the key to `escape`, which goes
    // on to clear the selection / return to the default tool.
    enabled: () => (scratch.current !== null || scratch.finishedSubpaths.length > 0
      ? true
      : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate' as const,
      run: () => {
        resetScratch(scratch);
        trail.refresh();
      },
    },
  };
}
