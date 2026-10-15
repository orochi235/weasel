/**
 * @experimental
 * `useStandardActions` — register the kit-standard action descriptors into the
 * nearest `<ActionsProvider>` and publish dep sources into the nearest
 * `<DepRegistryProvider>`. Falls back silently to a no-op when either is
 * not in scope.
 */
import { useEffect } from 'react';
import type { Action } from '@weasel-js/routing';
import { useActionsRegistry } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { type DepName, type DepSchema } from '@weasel-js/routing';
import { useOptionalDepRegistry } from '@weasel-js/routing/react';
// Reaches depSchema.ts so tsup's per-entry dts compiler resolves `DepSchema['selection']`
// here; `tsc --noEmit` happens to pick it up via test files, tsup does not. It MUST be
// `import type` — a bare `import './depSchema'` makes esbuild emit a runtime import that it
// then drops under the package's `sideEffects: false`, warning on every build.
import type {} from './depSchema';
import { useOptionalActiveToolContext } from '@weasel-js/routing/react';

import { escapeAction } from './defaults/escape';
import { cancelGestureAction } from './defaults/cancelGesture';
import { selectAllAction } from './defaults/selectAll';
import { deleteAction } from './defaults/delete';
import { duplicateAction } from './defaults/duplicate';
import { transformAgainAction } from './transform-again/action';
import { groupAction, ungroupAction } from './defaults/group';
import { undoAction, redoAction } from './defaults/undoRedo';
import { flipAction } from './flip/action';
import {
  nudgeUpAction, nudgeDownAction, nudgeLeftAction, nudgeRightAction,
} from './defaults/nudge';
import { reorderForwardAction, reorderBackwardAction } from './defaults/reorder';
import {
  alignLeftAction, alignRightAction, alignTopAction, alignBottomAction,
  alignCenterXAction, alignCenterYAction,
} from './align/action';
import {
  distributeHorizontalAction, distributeVerticalAction,
} from './distribute/action';
import {
  pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction,
  pathfinderExcludeAction, pathfinderDivideAction, pathfinderCropAction,
  pathfinderTrimAction, pathfinderMergeAction,
} from './booleans/action';
import { createOutlinesAction } from './outlines/createOutlinesAction';
import { outlineStrokeAction } from './outlines/outlineStrokeAction';
import { moveAction } from './move/action';
import { resizeAction } from './resize/action';
import { rotateAction } from './rotate/action';
import { areaSelectAction } from './defaults/areaSelect';
import { insertAction } from './insert/action';
import { insertRotateAction } from './insert/rotateAction';
import { insertRepositionAction } from './insert/repositionAction';
import { clearSelectionAction } from './defaults/clearSelection';
import { cloneAction } from './clone/action';
import { editAnchorsAction } from './edit-anchors/action';
import { enterPathEditAction } from './defaults/enterPathEdit';
import { exitPathEditAction } from './defaults/exitPathEdit';
import { insertPathAnchorAction } from './defaults/insertPathAnchor';
import { bendSegmentAction } from './defaults/bendSegment';
import { makeHandlesSymmetricAction, retractHandlesAction } from './defaults/anchorHandles';
import { averageAnchorsAction, joinAnchorsAction } from './defaults/anchorJoin';
import { simplifyBrushAction, simplifyBrushToolAction } from './defaults/simplifyBrush';
import { exitPathEditToolAction } from './defaults/pathEditTools';
import {
  joinPathsAction, offsetPathAction, simplifyPathAction, snipAtCrossingsAction,
} from './pathCommands';
import {
  nudgeAnchorsUpAction,
  nudgeAnchorsDownAction,
  nudgeAnchorsLeftAction,
  nudgeAnchorsRightAction,
  deleteAnchorsAction,
  cutPathAtAnchorAction,
  marqueeAnchorsAction,
  selectAnchorAction,
} from './defaults/anchorEditing';
import { lassoSelectAction } from './lasso-select/action';
import { pinchZoomAction } from './defaults/pinchZoom';
import { viewportDragPanAction } from './defaults/viewportDragPan';
import { enterTextEditAction } from './defaults/enterTextEdit';
import { setFillAction } from './defaults/setFill';
import { setStrokeAction } from './defaults/setStroke';
import { setFillOpacityAction } from './defaults/setFillOpacity';
import { setStrokeOpacityAction } from './defaults/setStrokeOpacity';
import { ingestAction } from './defaults/ingest';
import {
  clipboardCopyAction, clipboardCutAction, clipboardPasteAction, clipboardPasteEventAction,
} from './clipboard/action';

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
  /** Currently active tool id + hotkey-hold stack. */
  activeTool?: DepSchema['activeTool'];
  /**
   * Ids of kit-standard actions to leave unregistered, so a consumer can bind
   * its own. Ids that name no kit action are ignored;
   * `KIT_STANDARD_ACTION_IDS` is the full list.
   */
  exclude?: Iterable<string>;
}

/**
 * The ordered list of all kit-standard action descriptors. `viewport.pan`
 * and `viewport.zoom` are NOT in this list — they're registered conditionally
 * by SceneCanvas's `useViewportActions` based on the `viewport.pan` /
 * `viewport.zoom` flags.
 */
const KIT_STANDARD_DESCRIPTORS: Action[] = [
  escapeAction,
  cancelGestureAction,
  selectAllAction,
  duplicateAction,
  transformAgainAction,
  deleteAction,
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
  alignCenterXAction,
  alignRightAction,
  alignTopAction,
  alignCenterYAction,
  alignBottomAction,
  distributeHorizontalAction,
  distributeVerticalAction,
  pathfinderUnionAction,
  pathfinderSubtractAction,
  pathfinderIntersectAction,
  pathfinderExcludeAction,
  pathfinderDivideAction,
  pathfinderCropAction,
  pathfinderTrimAction,
  pathfinderMergeAction,
  createOutlinesAction,
  outlineStrokeAction,
  moveAction,
  resizeAction,
  rotateAction,
  areaSelectAction,
  insertAction,
  insertRotateAction,
  insertRepositionAction,
  cloneAction,
  editAnchorsAction,
  enterPathEditAction,
  exitPathEditAction,
  insertPathAnchorAction,
  bendSegmentAction,
  nudgeAnchorsUpAction,
  nudgeAnchorsDownAction,
  nudgeAnchorsLeftAction,
  nudgeAnchorsRightAction,
  deleteAnchorsAction,
  cutPathAtAnchorAction,
  simplifyBrushAction,
  simplifyBrushToolAction,
  exitPathEditToolAction,
  retractHandlesAction,
  makeHandlesSymmetricAction,
  averageAnchorsAction,
  joinAnchorsAction,
  simplifyPathAction,
  offsetPathAction,
  snipAtCrossingsAction,
  joinPathsAction,
  marqueeAnchorsAction,
  selectAnchorAction,
  lassoSelectAction,
  pinchZoomAction,
  viewportDragPanAction,
  clearSelectionAction,
  enterTextEditAction,
  setFillAction,
  setStrokeAction,
  setFillOpacityAction,
  setStrokeOpacityAction,
  ingestAction,
  clipboardCutAction,
  clipboardCopyAction,
  clipboardPasteAction,
  clipboardPasteEventAction,
];

/** Every id `useStandardActions` can register, in registration order. It
 *  holds `clipboard.pasteEvent` back unless `ingest` is excluded. */
export const KIT_STANDARD_ACTION_IDS: readonly string[] =
  KIT_STANDARD_DESCRIPTORS.map((a) => a.id);

/**
 * Kit-standard actions that stay unregistered while another one is
 * registered, because that one binds the same gesture and does everything
 * this one does: both answering it would act twice. Keyed by the action that
 * yields.
 */
const YIELDS_TO: Readonly<Record<string, string>> = {
  'clipboard.pasteEvent': 'ingest',
};

/**
 * @experimental
 * Register each kit-standard dep source and action descriptor into the
 * surrounding `<ActionsProvider>` and `<DepRegistryProvider>` (typically
 * provided by `<SceneCanvas>`); a silent no-op when either is absent.
 *
 * Each option is published as a live source in the dep registry under its
 * canonical name (`selection`, `scene`, …). The source reads the latest
 * option value at invocation time, so consumers don't have to memoize their
 * dep objects.
 */
export function useStandardActions(opts: UseStandardActionsOptions): void {
  // --- Stabilize opts via ref ---
  const optsRef = useLatest(opts);

  // --- activeTool fallback: read from context when not supplied in opts ---
  const activeToolCtx = useOptionalActiveToolContext();
  const activeToolCtxRef = useLatest(activeToolCtx);

  // --- Dep source registration ---
  const depReg = useOptionalDepRegistry();

  useEffect(() => {
    if (!depReg) return;
    const unregisters: Array<() => void> = [];
    const keys = ['selection', 'view', 'scene', 'history'] as const;
    for (const key of keys) {
      unregisters.push(
        depReg.register(key as DepName, () => optsRef.current[key] as DepSchema[DepName]),
      );
    }
    // activeTool: prefer the explicit opt; fall back to the context value so
    // SceneCanvas doesn't need to thread it through StandardActionsRegistrar.
    unregisters.push(
      depReg.register('activeTool' as DepName, () =>
        (optsRef.current.activeTool ?? activeToolCtxRef.current) as DepSchema[DepName],
      ),
    );
    return () => { for (const u of unregisters) u(); };
  }, [depReg, optsRef, activeToolCtxRef]);

  // --- Action descriptor registration ---
  const reg = useActionsRegistry();

  // Joined so a fresh array of the same ids does not re-register every render.
  const excludeKey = opts.exclude ? [...opts.exclude].join('\u0000') : '';

  useEffect(() => {
    if (!reg || !depReg) return;
    const excluded = new Set(excludeKey ? excludeKey.split('\u0000') : []);
    const unregisters = KIT_STANDARD_DESCRIPTORS
      .filter((a) => !excluded.has(a.id))
      .filter((a) => {
        const over = YIELDS_TO[a.id];
        return over === undefined || excluded.has(over);
      })
      .map((a) => reg.register(a));
    return () => { for (const u of unregisters) u(); };
  }, [reg, depReg, excludeKey]);
}
