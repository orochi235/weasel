import { useMemo, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { pickWalk, adapterPickSource, scenePlaneOf } from 'canvas/pickWalk';
import type { View } from 'core/viewport/view';
import type { LayerEnumerableAdapter } from 'core/adapters/types';
import type { MoveAdapter } from 'core/adapters/types';
import type { AreaSelectAdapter } from 'core/adapters/types';
import type { NodeId } from 'core/scene/types';
import { defineTool } from '../../overlayBinding';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { Tool } from '../../overlayBinding';
import { pickTopMostHit } from '../pickTopMostHit';
import { adapterPointQuery } from './adapterPointQuery';
import { onBody, onEmptyCanvas } from './selectionContributions';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import { MULTI_RESIZE_TARGET_ID, type Bounds } from '../shared/selectionTarget';
import { icon } from '../../../icons.gen';
export type { Bounds };
export { MULTI_RESIZE_TARGET_ID };

/** Options for `useSelectTool`: how a point resolves to nodes, how a click
 *  chooses among them, and the appearance of the marquee. */
export interface UseSelectToolOptions<TPose> {
  /** Return ids of all objects whose painted body covers (worldX, worldY).
   *  Order doesn't matter — the tool collapses parent/child overlap via
   *  `pickTopMostHit`. When omitted, defaults to an AABB-vs-point walk of
   *  the adapter's tree using the pose descriptor. Override for tighter
   *  shapes (path / polygon hit-tests). */
  pickEvery?: (worldX: number, worldY: number) => string[];
  /** Optional alt-aware selection-update hit returning the single id the
   *  click should act on. */
  pickBest?: (
    worldX: number,
    worldY: number,
    alt: boolean,
    selection: readonly string[],
  ) => string | null;
  /** How to read poses for the default `pickEvery`. Default
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
   *  at alpha 0 is not under the pointer. Ignored when `pickEvery` is
   *  supplied. */
  alphaOf?: (id: string) => number;
  /** Whether a node's `layer` reaches the screen in the view this tool picks
   *  for. Ignored when `pickEvery` is supplied. */
  layerIsPainted?: (layer: string) => boolean;
  /** The camera of the view this tool picks for. With it, a node on an
   *  adapter layer carrying `parallax` (`getLayers`) is picked where that
   *  camera's plane paints it; without it, every layer is taken to move with
   *  the camera. Ignored when `pickEvery` is supplied. */
  getView?: () => View | null;
  /**
   * When this returns true, a Shift/Meta extend-click must NOT change the
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
   * Set when the press hit an already-selected node inside a multi-selection
   * with no extend modifier.
   *
   * The selection is deliberately NOT collapsed on the press: the user may be
   * starting a drag of the whole set. If the gesture turns out to be a click,
   * `select.collapseDeferred` collapses to this id on release.
   */
  deferredClickId: string | null;
}



/** Active-slot Tool:
 *  - `select.pick` classifies the press (pointerDown) — it runs the tool's own
 *    pickBest/pickEvery so click semantics (selection replace, extend,
 *    deferred collapse) live in one place.
 *  - an empty drag marquees (`areaSelect`) and a click on empty clears the
 *    selection (`clearSelection`); the marquee renders via the dispatcher
 *    overlay layer, driven by areaSelectAction's `overlay()`.
 *  - moving and transforming the selection are not the tool's: they are the
 *    ambient bindings in `selectionContributions.ts`.
 */
export function useSelectTool<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TPose>,
): Tool {

  // pickEvery / boundsOf defaults — for any adapter the kit can derive both
  // from the adapter's tree + `adapter.getPose(id)` + the descriptor.
  const d = (options.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const preciseLeaves = options.leafPicking === 'silhouette';
  const tolerance = options.pickTolerance ?? 0;
  const pickEveryFn = options.pickEvery ?? ((worldX: number, worldY: number): string[] => {
    const camera = options.getView?.() ?? null;
    const planeOf = camera ? scenePlaneOf(adapter.getLayers?.(), camera) : null;
    return pickWalk<TPose>(adapterPickSource(adapter, {
      ...(options.alphaOf ? { alphaOf: options.alphaOf } : {}),
      ...(options.layerIsPainted ? { layerIsPainted: options.layerIsPainted } : {}),
      ...(planeOf ? { planeOf } : {}),
    }), adapterPointQuery(d, preciseLeaves)(worldX, worldY, tolerance));
  });

  const pickEveryRef = useLatest(pickEveryFn);

  // What the last press classified. Written by `select.pick`, read by
  // `select.collapseDeferred` and the cursor. See `PressClassification`.
  const pressRef = useRef<PressClassification>({ deferredClickId: null });

  // Options in a ref so the actions — built once — always see the live
  // callbacks without rebuilding the Tool record.
  const optionsRef = useLatest(options);
  const adapterRef = useLatest(adapter);

  /**
   * `select.pick` — classifies the press and updates the node selection.
   *
   * Bound to `pointerDown` rather than `click` on purpose: pressing an
   * unselected node must highlight it while the button is still down, and any
   * drag that follows has to start from the updated selection (both
   * `moveAction` and `cloneAction` read `selection.get()` in their `start`).
   */
  const pickAction = useMemo<Action>(() => ({
    id: 'select.pick',
    label: 'Select — pick under pointer',
    eligible: { capability: 'creates-selection' },
    requires: ['selection'],
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const p = params as {
          worldX?: number; worldY?: number;
          affordance?: unknown;
          mods?: { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean };
        } | undefined;
        const selection = deps.selection;
        if (!selection || p?.worldX === undefined || p.worldY === undefined) return;
        const mods = p.mods ?? { alt: false, ctrl: false, meta: false, shift: false };
        const opts = optionsRef.current;

        const sel = selection.get();
        const top = opts.pickBest
          ? opts.pickBest(p.worldX, p.worldY, mods.alt, sel)
          : (() => {
              const ids = pickEveryRef.current(p.worldX, p.worldY);
              if (ids.length === 0) return null;
              return pickTopMostHit(ids, adapterRef.current) ?? ids[0];
            })();

        if (top === null) {
          pressRef.current = { deferredClickId: null };
          return;
        }

        const hitAlreadySelected = sel.includes(top as NodeId);
        const isExtend = mods.shift || mods.meta;
        // See `extendClickLocked`. An option rather than `Action.enabled`
        // because it only applies to *extend* presses, and `enabled` is
        // evaluated without the event's modifiers.
        const extendLocked = isExtend && opts.extendClickLocked?.() === true;
        const deferClick = hitAlreadySelected && sel.length > 1 && !isExtend;
        if (!deferClick && !extendLocked) {
          selection.applyClick(top as NodeId, mods);
        }
        pressRef.current = { deferredClickId: deferClick ? top : null };
      },
    },
  }), [optionsRef, pickEveryRef, adapterRef]);

  /**
   * `select.collapseDeferred` — the release half of the deferred multi-click.
   *
   * Pressing an already-selected node inside a multi-selection leaves the
   * selection alone so the press can start a drag of the whole set. If the
   * gesture ends without a drag, this collapses to the clicked node.
   */
  const collapseDeferredAction = useMemo<Action>(() => ({
    id: 'select.collapseDeferred',
    label: 'Select — collapse deferred click',
    eligible: { capability: 'creates-selection' },
    requires: ['selection'],
    // Declining when there is nothing deferred is what keeps this binding
    // from swallowing every click on a node. It is bound at ACTIVE scope, so
    // without the gate it would outrank ambient click bindings like
    // `selectAnchor` and silently break anchor selection.
    enabled: () =>
      pressRef.current.deferredClickId !== null
        ? true
        : ActionDisabledReason.NotApplicable,
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const deferred = pressRef.current.deferredClickId;
        pressRef.current = { deferredClickId: null };
        if (deferred === null) return;
        const selection = deps.selection;
        if (!selection) return;
        const p = params as {
          mods?: { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean };
        } | undefined;
        selection.applyClick(
          deferred as NodeId,
          p?.mods ?? { alt: false, ctrl: false, meta: false, shift: false },
        );
      },
    },
  }), []);

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
        actions: [pickAction, collapseDeferredAction],
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
              mods: { shift: 'optional' as const, alt: 'optional' as const, meta: 'optional' as const, ctrl: 'optional' as const },
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
              mods: { shift: 'optional' as const, alt: 'optional' as const, meta: 'optional' as const, ctrl: 'optional' as const },
            },
            actionId: 'select.collapseDeferred',
            opts: { id: 'select.collapseDeferred' },
          },
          // Empty drag → marquee. `onEmptyCanvas` rather than a bare `'empty'`
          // target: the ambient bindings that own the handles rank below this
          // active one, so `'empty'` took drags that start on them.
          {
            spec: { kind: 'drag' as const, target: { kindOf: onEmptyCanvas } },
            actionId: 'areaSelect',
            opts: { id: 'select.marquee' },
          },
          // resize/rotate bind only drag (no click), so a click on either handle
          // (body genuinely empty) would hit target:'empty' and wrongly clear selection.
          {
            spec: {
              kind: 'click' as const,
              target: { kindOf: onEmptyCanvas },
              mods: {},
            },
            actionId: 'clearSelection',
            opts: { id: 'select.clearOnClick' },
          },
        ],
      };
    },
    [pickAction, collapseDeferredAction],
  );
}
