/**
 * @experimental
 * `useStandardActions` — register the kit-standard action descriptors into the
 * nearest `<ActionsProvider>` and publish dep sources into the nearest
 * `<DepRegistryProvider>`.
 *
 * Phase 4 rewrite: instead of calling closure-style factories, this hook
 * registers each dep as a live source and each kit-standard descriptor with a
 * legacy run-bridge for pre-Phase-10 `useKeybinding` compatibility.
 *
 * Falls back silently to a no-op when no `<ActionsProvider>` or
 * `<DepRegistryProvider>` is in scope.
 */
import { useEffect, useRef } from 'react';
import type { Action } from './registry';
import { useActionsRegistry } from './registry';
import { useOptionalDepRegistry, type DepName, type DepSchema } from './depRegistry';
// Side-effect import: pulls in the module augmentation that adds `selection`, `view`,
// `scene`, `history`, `pointer`, and `activeTool` keys to `DepSchema`. Without this, tsup's
// per-entry dts compiler doesn't see the augmentation and `DepSchema['selection']` etc.
// fail to type-check. `tsc --noEmit` happens to pick this up via test files; tsup doesn't.
import './depSchema';
import { useOptionalActiveToolContext } from './activeToolContext';

import { escapeAction } from './defaults/escape';
import { cancelGestureAction } from './defaults/cancelGesture';
import { selectAllAction } from './defaults/selectAll';
import { deleteAction } from './defaults/delete';
import { duplicateAction } from './defaults/duplicate';
import { groupAction, ungroupAction } from './defaults/group';
import { undoAction, redoAction } from './defaults/undoRedo';
import { flipAction } from './defaults/flip';
import {
  nudgeUpAction, nudgeDownAction, nudgeLeftAction, nudgeRightAction,
} from './defaults/nudge';
import { reorderForwardAction, reorderBackwardAction } from './defaults/reorder';
import {
  alignLeftAction, alignRightAction, alignTopAction, alignBottomAction,
  alignCenterXAction, alignCenterYAction,
} from './defaults/align';
import {
  distributeHorizontalAction, distributeVerticalAction,
} from './defaults/distribute';
import {
  pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction,
  pathfinderExcludeAction, pathfinderDivideAction, pathfinderCropAction,
} from './defaults/booleans';
import { moveAction } from './defaults/move';
import { resizeAction } from './defaults/resize';
import { rotateAction } from './defaults/rotate';
import { areaSelectAction } from './defaults/areaSelect';
import { insertAction, insertRotateAction } from './defaults/insert';
import { clearSelectionAction } from './defaults/clearSelection';
import { cloneAction } from './defaults/clone';
import { editAnchorsAction } from './defaults/editAnchors';
import { enterPathEditAction } from './defaults/enterPathEdit';
import { exitPathEditAction } from './defaults/exitPathEdit';
import { insertPathAnchorAction } from './defaults/insertPathAnchor';
import { lassoSelectAction } from './defaults/lassoSelect';
import { pinchZoomAction } from './defaults/pinchZoom';
import { viewportDragPanAction } from './defaults/viewportDragPan';
import { enterTextEditAction } from './defaults/enterTextEdit';
import { setFillAction } from './defaults/setFill';
import { setStrokeAction } from './defaults/setStroke';
import { setFillOpacityAction } from './defaults/setFillOpacity';
import { setStrokeOpacityAction } from './defaults/setStrokeOpacity';

// viewportPanAction / viewportZoomAction are NOT in KIT_STANDARD_DESCRIPTORS.
// They are wired conditionally by SceneCanvas via `useViewportActions`
// based on the `viewport.pan` / `viewport.zoom` flags.

/** @experimental */
export interface UseStandardActionsOptions {
  /** Kit selection state — ids of currently selected nodes. */
  selection?: DepSchema['selection'];
  /** Current viewport — camera position + scale. */
  view?: DepSchema['view'];
  /** Scene tree — structural reads + undoable mutations. */
  scene?: DepSchema['scene'];
  /** Undo/redo history bound to the current scene. */
  history?: DepSchema['history'];
  /** Canvas pointer position in world space. */
  pointer?: DepSchema['pointer'];
  /** Currently active tool id + hotkey-hold stack. */
  activeTool?: DepSchema['activeTool'];
}

/**
 * The ordered list of all kit-standard action descriptors. Each descriptor
 * carries an `invoker` that reads from the dep registry at dispatch time.
 *
 * Count: 3 (escape/cancelGesture/selectAll) + 1 (delete) + 1 (duplicate) + 1 (group) +
 *        1 (ungroup) + 2 (undo/redo) + 1 (flip) + 4 (nudge) + 2 (reorder) +
 *        6 (align) + 2 (distribute) + 6 (pathfinder) + 1 (move) +
 *        6 (resize/rotate/areaSelect/insert/insertRotate/clone) + 3 (editAnchors/lassoSelect/pinchZoom) +
 *        1 (viewport.dragPan) + 1 (clearSelection) + 1 (enterTextEdit) + 4 (setFill/setStroke/setFillOpacity/setStrokeOpacity) = 47
 *
 * `viewport.pan` and `viewport.zoom` are NOT in this list — they're registered
 * conditionally by SceneCanvas's `useViewportActions` based on the
 * `viewport.pan` / `viewport.zoom` flags. See `src/canvas/SceneCanvas/useViewportActions.ts`.
 */
const KIT_STANDARD_DESCRIPTORS: Action[] = [
  escapeAction,
  cancelGestureAction,
  selectAllAction,
  deleteAction,
  duplicateAction,
  groupAction,
  ungroupAction,
  undoAction,
  redoAction,
  flipAction,
  nudgeUpAction,
  nudgeDownAction,
  nudgeLeftAction,
  nudgeRightAction,
  reorderForwardAction,
  reorderBackwardAction,
  alignLeftAction,
  alignRightAction,
  alignTopAction,
  alignBottomAction,
  alignCenterXAction,
  alignCenterYAction,
  distributeHorizontalAction,
  distributeVerticalAction,
  pathfinderUnionAction,
  pathfinderSubtractAction,
  pathfinderIntersectAction,
  pathfinderExcludeAction,
  pathfinderDivideAction,
  pathfinderCropAction,
  moveAction,
  resizeAction,
  rotateAction,
  areaSelectAction,
  insertAction,
  insertRotateAction,
  cloneAction,
  editAnchorsAction,
  enterPathEditAction,
  exitPathEditAction,
  insertPathAnchorAction,
  lassoSelectAction,
  pinchZoomAction,
  viewportDragPanAction,
  clearSelectionAction,
  enterTextEditAction,
  setFillAction,
  setStrokeAction,
  setFillOpacityAction,
  setStrokeOpacityAction,
];

/**
 * @experimental
 * Register each kit-standard dep source and action descriptor into the
 * surrounding providers.
 *
 * **Provider requirements:** both `<ActionsProvider>` and
 * `<DepRegistryProvider>` must be in scope (typically provided by
 * `<SceneCanvas>`). The hook falls back silently to a no-op when either
 * provider is absent.
 *
 * **Dep registration:** each non-undefined option is published as a live source
 * in the dep registry under its canonical name (`selection`, `scene`, …). The
 * source thunk reads the latest option value at invocation time via a ref, so
 * consumers don't have to memoize their dep objects.
 */
export function useStandardActions(opts: UseStandardActionsOptions): void {
  // --- Stabilize opts via ref ---
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // --- activeTool fallback: read from context when not supplied in opts ---
  // Falls back to null when no <ActiveToolContextProvider> is in scope
  // (preserves silent-no-op contract for consumers that mount without SceneCanvas).
  const activeToolCtx = useOptionalActiveToolContext();
  const activeToolCtxRef = useRef(activeToolCtx);
  activeToolCtxRef.current = activeToolCtx;

  // --- Dep source registration ---
  // Must be unconditional (rules of hooks). Each effect only registers when a
  // provider is present (depReg !== null guard is inside the effect body).
  const depReg = useOptionalDepRegistry();
  const depRegRef = useRef(depReg);
  depRegRef.current = depReg;

  useEffect(() => {
    const r = depRegRef.current;
    if (!r) return;
    const unregisters: Array<() => void> = [];
    const keys = ['selection', 'view', 'scene', 'history', 'pointer'] as const;
    for (const key of keys) {
      unregisters.push(
        r.register(key as DepName, () => optsRef.current[key] as DepSchema[DepName]),
      );
    }
    // activeTool: prefer the explicit opt; fall back to the context value so
    // SceneCanvas doesn't need to thread it through StandardActionsRegistrar.
    unregisters.push(
      r.register('activeTool' as DepName, () =>
        (optsRef.current.activeTool ?? activeToolCtxRef.current) as DepSchema[DepName],
      ),
    );
    return () => { for (const u of unregisters) u(); };
  }, [depReg]);

  // --- Action descriptor registration with legacy run bridge ---
  const reg = useActionsRegistry();
  const regRef = useRef(reg);
  regRef.current = reg;

  useEffect(() => {
    if (!reg || !depReg) return;
    // Phase 14e Task 7: `withLegacyRunBridge` is gone. Kit-standard descriptors
    // register their `invoker` directly. `registry.trigger(id)` reads from the
    // dep registry to build deps when calling `invoker.run` (so ActionBar /
    // palette callers still work without a per-action `run` thunk).
    const unregisters = KIT_STANDARD_DESCRIPTORS.map((a) => reg.register(a));
    return () => { for (const u of unregisters) u(); };
  }, [reg, depReg]);
}
