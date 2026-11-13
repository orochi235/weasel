import { useCallback, useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import type { View } from 'core/viewport/view';
import type { LayerEnumerableAdapter } from 'core/adapters/types';
import type { MoveAdapter } from 'core/adapters/types';
import type { AreaSelectAdapter } from 'core/adapters/types';
import { defineTool } from '../../overlayBinding';
import type { WorldPoint } from '@weasel-js/routing';
import { ANY_MODS } from '@weasel-js/gestures';
import type { Tool } from '../../overlayBinding';
import { pickTopMostHit } from '../pickTopMostHit';
import { rangeAmong } from './selectRange';
import { createSelectPickAction } from './selectPick';
import { createCollapseDeferredAction } from './collapseDeferred';
import { GROUP_LEAVE_PRESS_BINDING } from './groupEntry';
import { createSelectDeepAction } from '../../../interactions/actions/defaults/selectDeep';
import { onBody, onEmptyCanvas } from './selectionContributions';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { MULTI_RESIZE_TARGET_ID, type Bounds } from '../shared/selectionTarget';
import { icon } from '../../../icons.gen';
export type { Bounds };
export { MULTI_RESIZE_TARGET_ID };

/** Options for `useSelectTool`: how a point resolves to nodes, how a click
 *  chooses among them, and the appearance of the marquee. */
export interface UseSelectToolOptions<TPose> {
  /** Return ids of all objects whose painted body covers `world`.
   *  Order doesn't matter — the tool collapses parent/child overlap via
   *  `pickTopMostHit`. When omitted, defaults to an AABB-vs-point walk of
   *  the adapter's tree using the pose descriptor. Override for tighter
   *  shapes (path / polygon hit-tests). `viewId` is the view the press
   *  landed in, where the host routes views. */
  pickEvery?: (world: WorldPoint, viewId?: string | null) => string[];
  /** Optional alt-aware selection-update hit returning the single id the
   *  click should act on. */
  pickBest?: (world: WorldPoint, alt: boolean, selection: readonly string[], viewId?: string | null) => string | null;
  /** How to read poses for the default `pickEvery` and `between`. Default
   *  `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
  /**
   * How the default `pickEvery` decides a **leaf** node covers the pointer.
   * Ignored when `pickEvery` is supplied.
   *
   * - `'aabb'` (default) — the pose rect: a click anywhere in the bounding
   *   box selects the node.
   * - `'silhouette'` — the pose rect as a pre-test, then the ink the painter
   *   lays down: `findShapeSilhouette` filled or not per the painter's `ink`,
   *   plus its outline widened by the stroke half-width and `pickTolerance`.
   *   A click inside the bounding box but outside the drawn shape misses —
   *   the concave notch of a star, the corner outside an ellipse, the blank
   *   half of a text box — while a click on the thin outline of an unfilled
   *   shape hits.
   *
   * Container nodes already consult their silhouette unconditionally (it is
   * how their clip is derived). A painter with no `silhouette` falls back to
   * the AABB.
   */
  leafPicking?: 'aabb' | 'silhouette';
  /**
   * Grab slop around a shape's outline, in **world** units. Default 0.
   *
   * Only consulted under `leafPicking: 'silhouette'`. World units because
   * this hook has no view; `<SceneCanvas>` takes a screen-pixel figure
   * (`geometry.pickTolerancePx`) and divides by scale on its own pick path.
   * Without some slop a hairline outline is an unhittable target.
   */
  pickTolerance?: number;
  /** Painted alpha per node in the view this tool picks for. A node painted
   *  at alpha 0 is not under the pointer, nor in a range. Read by the default
   *  `pickEvery` and `between`. */
  alphaOf?: (id: string) => number;
  /** Whether a node's `layer` reaches the screen in the view this tool picks
   *  for. Read by the default `pickEvery` and `between`. */
  layerIsPainted?: (layer: string) => boolean;
  /** The camera of the view this tool picks for. With it, a node on an
   *  adapter layer carrying `parallax` (`getLayers`) is picked where that
   *  camera's plane paints it; without it, every layer is taken to move with
   *  the camera. Ignored when `pickEvery` is supplied. */
  getView?: () => View | null;
  /**
   * When this returns true, a toggle or range click must NOT change the
   * node selection.
   *
   * `<SceneCanvas>` wires it to "a path is in anchor-edit mode", where
   * Shift-click means "add this anchor to the anchor selection". Without
   * the lock the same click also toggles the edited node out of the node
   * selection, and the `editAnchors` dep treats that as the edit target
   * disappearing.
   *
   * Only extend-clicks are locked. A plain click still re-selects, so
   * clicking a different node exits edit mode as usual.
   */
  extendClickLocked?: () => boolean;
  /**
   * The nodes a range from `from` to `to` covers. The tool keeps those a press there could
   * select itself, so a range takes a group whole, and inside an entered group stays in it.
   * `useSelectTool` defaults it to every node whose center lies in the box the two span;
   * without it a range walks the selection's own order.
   */
  between?: (from: string, to: string) => readonly string[];
}

/** Intersection of the move + area-select adapter interfaces.
 *  Resize and rotate run through `resizeAction` / `rotateAction`. */
export type SelectAdapter<TNode extends { id: string }, TPose> =
  MoveAdapter<TNode, TPose>
  & AreaSelectAdapter
  & LayerEnumerableAdapter;

/**
 * What the press classified, carried from `select.pick` (pointerDown) to
 * `select.collapseDeferred` (click) and to the tool's cursor.
 *
 * This is tool-local bookkeeping between two dispatches of the same gesture,
 * so it lives in a ref the tool owns rather than in dispatcher state.
 *
 * @internal
 */
interface PressClassification {
  /**
   * Set when a press with no extend modifier hit an already-selected node
   * inside a multi-selection, or a node inside a selected group.
   *
   * The selection is deliberately NOT collapsed on the press: the user may be
   * starting a drag of the whole set, or of the group. If the gesture turns out to be a click,
   * `select.collapseDeferred` collapses to this id on release.
   */
  deferredClickId: string | null;
}



/** The routed view as a trailing argument, or none: a pick no view was routed for is asked as before. */
function routed(viewId: string | null | undefined): [] | [string | null] {
  return viewId === undefined ? [] : [viewId];
}

/** The select tool over a picker the host supplies (`pickEvery`), with no
 *  2D default: what a host that is not a 2D canvas builds on. `useSelectTool`
 *  is this with the kit's adapter walk as the default picker.
 *
 *  Active-slot Tool:
 *  - `select.pick` classifies the press (pointerDown) — it runs the tool's own
 *    pickBest/pickEvery so click semantics (selection replace, extend,
 *    deferred collapse) live in one place.
 *  - an empty drag marquees (`areaSelect`) and a click on empty clears the
 *    selection (`clearSelection`); the marquee renders via the dispatcher
 *    overlay layer, driven by areaSelectAction's `overlay()`.
 *  - moving and transforming the selection are not the tool's: they are the
 *    ambient bindings in `selectionContributions.ts`.
 */
export function useSelectToolWith<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TPose> & Required<Pick<UseSelectToolOptions<TPose>, 'pickEvery'>>,
): Tool {
  const pickEveryRef = useLatest(options.pickEvery);

  // What the last press classified. Written by `select.pick`, read by
  // `select.collapseDeferred` and the cursor. See `PressClassification`.
  const pressRef = useRef<PressClassification>({ deferredClickId: null });

  // Options in a ref so the actions — built once — always see the live
  // callbacks without rebuilding the Tool record.
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  // The node under a point, before any group above it is considered.
  const pickHit = useCallback((world: WorldPoint, alt: boolean, sel: readonly string[], viewId?: string | null): string | null => {
    const opts = optionsRef.current;
    if (opts.pickBest) return opts.pickBest(world, alt, sel, ...routed(viewId));
    const ids = pickEveryRef.current(world, ...routed(viewId));
    if (ids.length === 0) return null;
    return pickTopMostHit(ids, adapterRef.current) ?? ids[0];
  }, [optionsRef, pickEveryRef, adapterRef]);

  const extendLocked = useCallback(() => optionsRef.current.extendClickLocked?.() === true, [optionsRef]);
  const settled = useCallback(() => { pressRef.current = { deferredClickId: null }; }, []);
  // A range among what a press inside `level` selects.
  const rangeIn = useCallback((level: string | null) => {
    const between = optionsRef.current.between;
    if (!between) return undefined;
    return rangeAmong(between, adapterRef.current, level);
  }, [optionsRef, adapterRef]);
  const deepAction = useMemo(
    () => createSelectDeepAction({
      pickHit, extendLocked, settled, rangeAt: (hit) => rangeIn(adapterRef.current.getParent(hit)),
    }),
    [pickHit, extendLocked, settled, rangeIn, adapterRef],
  );

  const pickAction = useMemo(() => createSelectPickAction({
    pickHit, extendLocked, rangeIn,
    tree: () => adapterRef.current,
    pressed: (deferred) => { pressRef.current = { deferredClickId: deferred }; },
  }), [pickHit, extendLocked, rangeIn, adapterRef]);


  const collapseDeferredAction = useMemo(() => createCollapseDeferredAction(pressRef), []);

  return useMemo(
    () => {
      const base = defineTool({
        id: 'select',
        keybinding: { key: 'V' },
        capabilities: ['creates-selection'],
        hookName: 'useSelectTool',
        // The mid-gesture cursors live on the actions that own those gestures
        // (`moveAction.activeCursor`, `areaSelectAction.activeCursor`).
        cursor: 'default',
        presentation: {
          label: 'Select',
          icon: icon('select'),
          group: 'select',
        },
        actions: [pickAction, deepAction, collapseDeferredAction],
      });

      return {
        ...base,
        // Declarative bindings for the gesture dispatcher. The select tool
        // only chooses: press → classify + select, release → collapse a
        // deferred multi-click, empty drag → marquee, click on empty → clear.
        // Moving, cloning, resizing and rotating the selection are ambient
        // bindings owned by the selection (`selectionContributions.ts`), so
        // they run under any tool that leaves the gesture unclaimed.
        bindings: [
          // Cmd+Alt-press selects the node itself, past every group. It outranks
          // `select.pick` because a required modifier counts in specificity.
          {
            spec: {
              kind: 'pointerDown' as const,
              target: { kindOf: onBody },
              mods: { mod: true, alt: true, shift: 'optional' as const },
            },
            actionId: 'select.deep',
            opts: { id: 'select.deep' },
          },
          // Every press that landed on the scene rather than on chrome. It
          // classifies the press and applies the selection change, and it does
          // not consume the gesture — the same press goes on to open a drag or
          // synthesize a click.
          //
          // The no-affordance target is load-bearing twice over. A press on a
          // resize handle, a rotate ring, a path anchor, or a registered
          // layer's own chrome is not a body pick, and re-picking underneath
          // it would change the selection the user was about to act on. And
          // because it is expressed in the SPEC rather than as an early
          // return in the action, the press falls through to whatever owns
          // that chrome instead of being consumed here — which is how an
          // ambient binding (`@weasel-js/hud`) gets to see it at all.
          //
          // Modifiers are all `'optional'` because they are *data* here
          // (forwarded to `SelectionApi.applyClick`) rather than a route.
          {
            spec: {
              kind: 'pointerDown' as const,
              target: { kindOf: onBody },
              mods: ANY_MODS,
            },
            actionId: 'select.pick',
            opts: { id: 'select.pick' },
          },
          // Release half of the deferred multi-click, modifiers as above. On a node
          // only: a drag leaves a deferral unspent, and a click on empty must clear.
          {
            spec: {
              kind: 'click' as const,
              target: { kindOf: onBody },
              mods: ANY_MODS,
            },
            actionId: 'select.collapseDeferred',
            opts: { id: 'select.collapseDeferred' },
          },
          GROUP_LEAVE_PRESS_BINDING,
          // Empty drag → marquee, adding to the selection with Shift held. `onEmptyCanvas` rather than a bare `'empty'`
          // target: the ambient bindings that own the handles rank below this
          // active one, so `'empty'` took drags that start on them.
          {
            spec: { kind: 'drag' as const, target: { kindOf: onEmptyCanvas }, mods: { shift: 'optional' as const } },
            actionId: 'areaSelect',
            opts: { id: 'select.marquee' },
          },
          // resize/rotate bind only drag (no click), so a click on either handle
          // (body genuinely empty) would hit target:'empty' and wrongly clear selection.
          {
            spec: { kind: 'click' as const, target: { kindOf: onEmptyCanvas }, mods: {} },
            actionId: 'clearSelection',
            opts: { id: 'select.clearOnClick' },
          },
        ],
      };
    },
    [pickAction, deepAction, collapseDeferredAction],
  );
}
