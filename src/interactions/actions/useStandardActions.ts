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
import { useOptionalDepRegistry, type DepRegistry, type DepName, type DepSchema } from './depRegistry';

import { escapeAction } from './defaults/escape';
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
 * Count: 2 (escape/selectAll) + 1 (delete) + 1 (duplicate) + 1 (group) +
 *        1 (ungroup) + 2 (undo/redo) + 1 (flip) + 4 (nudge) + 2 (reorder) +
 *        6 (align) + 2 (distribute) + 6 (pathfinder) = 29
 */
const KIT_STANDARD_DESCRIPTORS: Action[] = [
  escapeAction,
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
];

/**
 * Attach a legacy `run` bridge to `action` so pre-Phase-10 keystroke dispatch
 * (which calls `action.run()`) still works. The bridge reads all kit-standard
 * dep sources from the dep registry at invocation time and delegates to
 * `invoker.run`. Params are `undefined` — legacy callers can't know which
 * parametric binding fired.
 *
 * Only applies to `ImmediateInvoker` actions (`timing === 'immediate'`). Other
 * timing strategies are returned unchanged.
 */
function withLegacyRunBridge(action: Action, depReg: DepRegistry): Action {
  if (!action.invoker || action.invoker.timing !== 'immediate') return action;
  const inv = action.invoker;
  return {
    ...action,
    run: () => {
      // Pass the full live dep bag — invokers guard against undefined and cast
      // as needed. Params are undefined: legacy callers can't signal which
      // parametric binding (e.g. flip axis, nudge magnitude) was intended, so
      // each descriptor defaults to a sensible variant (see its invoker body).
      const liveDeps = {
        selection: depReg.get('selection' as DepName),
        scene: depReg.get('scene' as DepName),
        history: depReg.get('history' as DepName),
        view: depReg.get('view' as DepName),
        pointer: depReg.get('pointer' as DepName),
        activeTool: depReg.get('activeTool' as DepName),
      };
      inv.run(liveDeps as any, undefined);
    },
  };
}

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
    const keys = ['selection', 'view', 'scene', 'history', 'pointer', 'activeTool'] as const;
    for (const key of keys) {
      unregisters.push(
        r.register(key as DepName, () => optsRef.current[key] as DepSchema[DepName]),
      );
    }
    return () => { for (const u of unregisters) u(); };
  }, [depReg]);

  // --- Action descriptor registration with legacy run bridge ---
  const reg = useActionsRegistry();
  const regRef = useRef(reg);
  regRef.current = reg;

  useEffect(() => {
    if (!reg || !depReg) return;
    const bridged = KIT_STANDARD_DESCRIPTORS.map((d) => withLegacyRunBridge(d, depReg));
    const unregisters = bridged.map((a) => reg.register(a));
    return () => { for (const u of unregisters) u(); };
  }, [reg, depReg]);
}
