/**
 * The ambient bindings that act on the selection: moving it, cloning it, and
 * resizing or rotating it from its handles. They belong to the selection, not
 * to the select tool, so they run under any tool that does not claim the
 * gesture itself. `<SceneCanvas features>` installs them as the `move` and
 * `transform` presets.
 */
import type { BindingOpts, GestureBinding } from '@weasel-js/routing';
import { isResizeHandle, isRotateHandle, isAnchorOrControl } from '@weasel-js/routing';
import type { Contribution } from '../../overlayBinding';
import type { UseMoveOptions } from '../../../interactions/actions/move/options';
import type { UseRotateOptions } from '../../../interactions/actions/rotate/options';
import { gestureLifecycleParams } from '../../../interactions/actions/gestureLifecycle';

/** Options for {@link selectionMoveContribution}. */
export interface SelectionMoveOptions<TPose = unknown> {
  /** Move-action options: `behaviors` become the move bindings'
   *  `opts.behaviors`, everything else their `opts.params`. */
  move?: UseMoveOptions<TPose>;
  /** Reparent-on-drop behavior for drag-to-move. `'off'` (default) keeps
   *  translate-only commits. `'top'` lands the moved nodes at the top of the
   *  container under the drop point; `'above'` lands them immediately above the
   *  hit sibling. Requires the `nodeAtPoint` dep (`<SceneCanvas>` sources it). */
  reparentOnDrop?: 'off' | 'top' | 'above';
}

/** Id of the entry {@link selectionMoveContribution} builds. */
export const SELECTION_MOVE_ID = 'selection.move';
/** Id of the entry {@link selectionTransformContribution} builds. */
export const SELECTION_TRANSFORM_ID = 'selection.transform';

/** Drag a body to move the selection; Alt-drag to clone it. */
export function selectionMoveBindings<TPose>(
  options: SelectionMoveOptions<TPose> = {},
): GestureBinding[] {
  // Shared move-binding opts (params + behaviors). Applied to
  // both the selected-body and unselected-body move bindings so a
  // first-touch drag and a re-drag commit identically.
  const moveOpts: { opts?: BindingOpts } = (() => {
    const move = options.move ?? {};
    const params: Record<string, unknown> = gestureLifecycleParams({ ...move, label: move.moveLabel });
    if (options.reparentOnDrop && options.reparentOnDrop !== 'off') params.reparentOnDrop = options.reparentOnDrop;
    if (move.dragThresholdPx !== undefined) params.dragThresholdPx = move.dragThresholdPx;
    if (move.expandIds) params.expandIds = move.expandIds;
    const withParams = Object.keys(params).length > 0 ? { params } : undefined;
    const behaviors = options.move?.behaviors?.length
      ? { behaviors: options.move.behaviors as BindingOpts['behaviors'] }
      : undefined;
    return withParams || behaviors
      ? { opts: { ...withParams, ...behaviors } satisfies BindingOpts }
      : {};
  })();

  return [
    // Alt-drag on a body → clone (Illustrator convention).
    // Listed BEFORE bare move so the strict-modifier dispatcher
    // picks this when Alt is held; bare move matches no-mod drags.
    // Both selected and unselected bodies are valid clone targets — the
    // select tool's pointerDown classifier calls `selection.applyClick(top, mods)`
    // on an unselected hit before the drag fires, so cloneAction's
    // `start` sees the hit node in `selection.get()` either way.
    { spec: { kind: 'drag' as const, target: 'selected-body' as const, mods: { alt: true } }, actionId: 'clone' },
    { spec: { kind: 'drag' as const, target: 'unselected-body' as const, mods: { alt: true } }, actionId: 'clone' },
    {
      // Body-drag → move, BUT defer when the pointerdown hit a path
      // anchor / control affordance. Anchors lie on the curve so the
      // body classifier still reports 'selected-body'; without this
      // opt-out, move's binding beats editAnchors's on every anchor drag.
      //
      // `isAnchorOrControl` is the SAME predicate `editAnchorsAction`
      // matches on. That is load-bearing: the two must agree on what
      // counts as an anchor hit or move steals the drag — which is
      // exactly the bug this opt-out exists to prevent.
      spec: {
        kind: 'drag' as const,
        target: {
          kindOf: (afford: unknown, body?: string): boolean =>
            body === 'selected-body' && !isAnchorOrControl(afford),
        },
      },
      actionId: 'move',
      ...moveOpts,
    },
    // Body-drag on a NOT-yet-selected node → also move. The select tool's
    // pointerDown classifier selects the hit node before the drag fires (same
    // contract clone relies on), so by the time moveAction.start() runs the
    // node is in `selection.get()`. Without this binding an unselected-body
    // drag falls through to whatever ambient drag binding comes next — once
    // the `rotate` catch-all, which made the first drag rotate and later ones
    // move. Unselected nodes never carry anchor affordances (those gate on
    // selection), so the plain string-form target is sufficient here.
    {
      spec: { kind: 'drag' as const, target: 'unselected-body' as const },
      actionId: 'move',
      ...moveOpts,
    },
  ];
}

/** Options for {@link selectionTransformContribution}. Resize takes its
 *  options through the `resizePolicy` dep (`useResizePolicy`), not here. */
export interface SelectionTransformOptions<TPose = unknown> {
  /** Rotate-action options: `behaviors` become the rotate binding's
   *  `opts.behaviors`, everything else its `opts.params`. */
  rotate?: UseRotateOptions<TPose>;
}

/** Drag a resize handle to resize the selection, the rotation handle to rotate it. */
export function selectionTransformBindings<TPose>(
  options: SelectionTransformOptions<TPose> = {},
): GestureBinding[] {
  const rotate = options.rotate ?? {};
  const params: Record<string, unknown> = gestureLifecycleParams({ ...rotate, label: rotate.rotateLabel });
  if (rotate.pivot) params.pivot = rotate.pivot;
  const opts: BindingOpts = {
    ...(Object.keys(params).length > 0 ? { params } : {}),
    ...(rotate.behaviors?.length ? { behaviors: rotate.behaviors as BindingOpts['behaviors'] } : {}),
  };
  return [
    { spec: { kind: 'drag' as const, target: { kindOf: isResizeHandle } }, actionId: 'resize' },
    {
      spec: { kind: 'drag' as const, target: { kindOf: isRotateHandle } },
      actionId: 'rotate',
      ...(Object.keys(opts).length > 0 ? { opts } : {}),
    },
  ];
}

/** An always-live entry carrying {@link selectionMoveBindings}. Add it to a
 *  canvas's ambient list; `<SceneCanvas features={['move']}>` does. */
export function selectionMoveContribution<TPose>(
  options: SelectionMoveOptions<TPose> = {},
): Contribution {
  return {
    id: SELECTION_MOVE_ID,
    eligibility: { always: true },
    bindings: selectionMoveBindings(options),
  };
}

/** An always-live entry carrying {@link selectionTransformBindings}. Add it
 *  to a canvas's ambient list; `<SceneCanvas features={['transform']}>` does. */
export function selectionTransformContribution<TPose>(
  options: SelectionTransformOptions<TPose> = {},
): Contribution {
  return {
    id: SELECTION_TRANSFORM_ID,
    eligibility: { always: true },
    bindings: selectionTransformBindings(options),
  };
}

/** Id of the entry {@link areaSelectContribution} builds. */
export const AREA_SELECT_ID = 'selection.areaSelect';

/** A press on empty canvas: no hit, and not on chrome over it — the rotation
 *  handle and the outer half of a resize handle sit off the body. */
export const onEmptyCanvas = (hit: unknown, body?: string): boolean => hit == null && body === 'empty';

/** An always-live entry that marquee-selects on a drag across empty canvas,
 *  under any tool that does not claim the drag itself. No preset installs it:
 *  the select tool already marquees, and a canvas that wants it under every
 *  tool adds this to its ambient list. */
export function areaSelectContribution(): Contribution {
  return {
    id: AREA_SELECT_ID,
    eligibility: { always: true },
    bindings: [{ spec: { kind: 'drag', target: { kindOf: onEmptyCanvas } }, actionId: 'areaSelect' }],
  };
}
