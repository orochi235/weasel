import { useMemo, useRef, createElement } from 'react';
import { SelectIcon } from '../../../icons';
import { pathContainsPoint } from 'features/paths/pathHitTest';
import type { Path } from 'features/paths/types';
import { findShapeSilhouette, shapeCoversPoint } from 'canvas/NodeShape';
import type { Node } from 'core/scene/types';
import type { MoveAdapter } from 'core/adapters/types';
import type { AreaSelectAdapter } from 'core/adapters/types';
import type { NodeId } from 'core/scene/types';
import { defineTool } from '../../routing';
import type { UseMoveOptions } from '../../../interactions/actions/move/options';
import type { BindingOpts } from '../../../interactions/actions/invoker';
import type { Action } from '../../../interactions/actions/registry';
import { ActionDisabledReason } from '../../../interactions/actions/registry';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Tool } from '../../types';
import type { DebugSink } from '../../../debug/types';
import { pickTopMostHit } from '../pickTopMostHit';
// Shared affordance predicates — the single source of truth for "what does
// this affordance kind mean" (`interactions/dispatcher/predicates.ts`). The
// action descriptors these bindings route to read the same functions, so a
// tool binding and its action can't disagree about what a hit is.
import {
  isResizeHandle,
  isRotateHandle,
  isAnchorOrControl,
} from '../../../interactions/dispatcher/predicates';
import { MULTI_RESIZE_TARGET_ID, type Bounds } from '../shared/selectionTarget';
export type { Bounds };
export { MULTI_RESIZE_TARGET_ID };

export interface UseSelectToolOptions<TPose> {
  /** Return ids of all objects whose painted body covers (worldX, worldY).
   *  Order doesn't matter — the tool collapses parent/child overlap via
   *  `pickTopMostHit`. When omitted, defaults to a rect AABB-vs-point scan
   *  over `adapter.getNodes()` using `poseBounds` (identity by default,
   *  works for `{x,y,width,height}` poses). Override for tighter shapes
   *  (path / polygon hit-tests). */
  pickEvery?: (worldX: number, worldY: number) => string[];
  /** Optional alt-aware selection-update hit returning the single id the
   *  click should act on. */
  pickBest?: (
    worldX: number,
    worldY: number,
    alt: boolean,
    selection: readonly string[],
  ) => string | null;
  /** Project a pose to its AABB. Default: identity. */
  poseBounds?: (pose: TPose) => Bounds;
  /**
   * How the default `pickEvery` decides a **leaf** node covers the pointer.
   * Ignored when `pickEvery` is supplied.
   *
   * - `'aabb'` (default) — the pose rect. Cheap, and the historical behavior:
   *   a click anywhere in the bounding box selects the node.
   * - `'silhouette'` — the pose rect as a pre-test, then the ink the painter
   *   lays down: `findShapeSilhouette` filled or not per the painter's `ink`,
   *   plus its outline widened by the stroke half-width and `pickTolerance`.
   *   A click inside the bounding box but outside the drawn shape misses —
   *   the concave notch of a star, the corner outside an ellipse, the blank
   *   half of a text box — while a click on the thin outline of an unfilled
   *   shape hits.
   *
   * Container nodes already consult their silhouette unconditionally (it is
   * how their clip is derived); this extends the same test to leaves. Not the
   * default because it changes what a click selects for every existing
   * consumer, and a painter with no `silhouette` is unaffected either way —
   * it falls back to the AABB.
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
  /** Move-action options. The move gesture is dispatcher-routed,
   *  so only `behaviors` is consumed here — threaded into the move binding's
   *  `opts.behaviors`. Other `UseMoveOptions` fields are accepted for API shape
   *  but not read by this tool. */
  move?: UseMoveOptions<TPose>;
  /**
   * When this returns true, a Shift/Meta extend-click must NOT change the
   * node selection.
   *
   * `<SceneCanvas>` wires it to "a path is in anchor-edit mode", where
   * Shift-click means "add this anchor to the anchor selection". Without
   * the lock the same click also toggles the edited node out of the node
   * selection, and the `editAnchors` dep treats that as the edit target
   * disappearing — so multi-selecting anchors silently exited edit mode.
   *
   * Only extend-clicks are locked. A plain click still re-selects, so
   * clicking a different node exits edit mode as usual.
   */
  extendClickLocked?: () => boolean;
  /** Optional debug sink. Reserved for future overlay/affordance hitbox
   *  recording. */
  debug?: DebugSink;
  /** Reparent-on-drop behavior for drag-to-move. `'off'` (default)
   *  preserves translate-only commits. `'top'` lands the moved nodes at
   *  the top of the container under the drop point. `'above'` lands them
   *  immediately above the hit sibling in z-order (falls back to `'top'`
   *  semantics when the hit is itself a container). Requires the
   *  `nodeAtPoint` dep to be registered (sourced by `<SceneCanvas>`). */
  reparentOnDrop?: 'off' | 'top' | 'above';
}

/** Intersection of the move + area-select adapter interfaces.
 *  Resize / rotate adapters moved to `useResizeTool` / `useRotateTool`. */
export type SelectAdapter<TNode extends { id: string }, TPose> =
  MoveAdapter<TNode, TPose>
  & AreaSelectAdapter;

/**
 * What the press classified, carried from `select.pick` (pointerDown) to
 * `select.collapseDeferred` (click) and to the tool's cursor.
 *
 * This is tool-local bookkeeping between two dispatches of the same gesture,
 * so it lives in a ref the tool owns rather than in dispatcher state. It used
 * to be the tool's `SelectScratch`, held by the tool-routing dispatcher, and
 * carried an `ids` list that nothing ever read — `moveAction` computes its own
 * ids from the live selection.
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
 *  - drag is owned exclusively by the dispatcher via `Tool.bindings`
 *    (selected-body → moveAction, rotate-handle → rotateAction, handle:* →
 *    resizeAction, empty → areaSelectAction, click on empty → clearSelection).
 *  - Move ghosts render via the preview-ghost layer (driven by moveAction's
 *    `previewIds`/`previewPose`); the marquee renders via the dispatcher
 *    overlay layer (driven by areaSelectAction's `overlay()`).
 */
export function useSelectTool<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TPose>,
): Tool<null> {

  // pickEvery / boundsOf defaults — for any rect-pose adapter the kit can
  // derive both from `adapter.getNodes()` + `adapter.getPose(id)` +
  // poseBounds (identity by default).
  const poseBoundsFn = options.poseBounds ?? ((p: TPose) => p as unknown as Bounds);
  const preciseLeaves = options.leafPicking === 'silhouette';
  // World units here, not screen: this hook has no view. `<SceneCanvas>`
  // converts from screen px on its own pick path; a bare `useSelectTool`
  // consumer that zooms should pass `pickTolerance` from its own scale.
  const tolerance = options.pickTolerance ?? 0;
  const pickEveryFn = options.pickEvery ?? ((worldX: number, worldY: number): string[] => {
    const hier = adapter as unknown as {
      getNode?: (id: string) => unknown;
      getChildren?: (parentId: string | null) => readonly string[];
    };

    /** AABB first (cheap), then the painter's ink when asked for and
     *  available. A painter with no `silhouette` — or one that returns null,
     *  as `kit:text` does for an empty node — keeps the AABB answer.
     *
     *  The AABB pre-filter is grown by `tolerance` for the same reason
     *  `<SceneCanvas>`'s is: a shape's outline, and the slop around it, reach
     *  outside the shape's own bounds, and an un-grown pre-filter would
     *  discard those hits before the refinement could claim them. */
    const covers = (node: unknown, pose: TPose, b: Bounds): boolean => {
      const t = preciseLeaves ? tolerance : 0;
      if (!(worldX >= b.x - t && worldX <= b.x + b.width + t
            && worldY >= b.y - t && worldY <= b.y + b.height + t)) {
        return false;
      }
      if (!preciseLeaves) return true;
      return shapeCoversPoint(
        node as Node<unknown, string, TPose>, pose, worldX, worldY, { tolerance },
      );
    };

    if (typeof hier.getChildren !== 'function' || typeof hier.getNode !== 'function') {
      const out: string[] = [];
      for (const obj of adapter.getNodes()) {
        const pose = adapter.getPose(obj.id);
        if (covers(obj, pose, poseBoundsFn(pose))) out.push(obj.id);
      }
      return out;
    }

    const out: string[] = [];

    function walk(parentId: string | null, ancestorClips: readonly Path[]): void {
      nextChild: for (const childId of hier.getChildren!(parentId)) {
        const node = hier.getNode!(childId) as {
          kind?: string;
          clipFromPose?: (pose: TPose) => Path | null;
        };
        const pose = adapter.getPose(childId);

        if (node.kind === 'container') {
          let ownClip: Path | null = null;
          if (typeof node.clipFromPose === 'function') {
            ownClip = node.clipFromPose(pose);
          } else {
            ownClip = findShapeSilhouette(
              node as unknown as Node<unknown, string, TPose>,
              pose,
            );
          }

          const b = poseBoundsFn(pose);
          const inAabb = worldX >= b.x && worldX <= b.x + b.width
              && worldY >= b.y && worldY <= b.y + b.height;
          const inClip = ownClip === null || pathContainsPoint(ownClip, worldX, worldY);
          let passesAncestors = true;
          for (const clip of ancestorClips) {
            if (!pathContainsPoint(clip, worldX, worldY)) { passesAncestors = false; break; }
          }
          if (inAabb && inClip && passesAncestors) {
            out.push(childId);
          }

          const childClips: readonly Path[] =
            ownClip !== null ? [...ancestorClips, ownClip] : ancestorClips;

          walk(childId, childClips);
        } else {
          for (const clip of ancestorClips) {
            if (!pathContainsPoint(clip, worldX, worldY)) continue nextChild;
          }
          if (covers(node, pose, poseBoundsFn(pose))) out.push(childId);
        }
      }
    }

    walk(null, []);
    return out;
  });
  const pickEveryRef = useRef(pickEveryFn);
  pickEveryRef.current = pickEveryFn;

  // What the last press classified. Written by `select.pick`, read by
  // `select.collapseDeferred` and the cursor. See `PressClassification`.
  const pressRef = useRef<PressClassification>({ deferredClickId: null });

  // Options in a ref so the actions — built once — always see the live
  // callbacks without rebuilding the Tool record.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;

  /**
   * `select.pick` — classifies the press and updates the node selection.
   *
   * Bound to `pointerDown` rather than `click` on purpose: pressing an
   * unselected node must highlight it while the button is still down, and any
   * drag that follows has to start from the updated selection (both
   * `moveAction` and `cloneAction` read `selection.get()` in their `start`).
   *
   * Eligibility replaces the `selectionAllowed` option the audit added as an
   * interim per-route patch: this action carries the same
   * `creates-selection` capability rule the `clearSelection` binding declares,
   * so a mode that forbids selection now gates both halves of the tool by one
   * mechanism instead of by which dispatcher the route happened to live on.
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
        const selection = deps.selection as SelectionApi | undefined;
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
        // While a path is in anchor-edit mode, an extend-click belongs to the
        // anchor selection, not the node selection. Letting it through would
        // toggle the edited node out of the node selection, which the
        // `editAnchors` dep reads as "the edit target is gone" — so
        // shift-clicking a second anchor silently tore down edit mode.
        // Plain clicks still fall through: clicking a different node exits
        // edit mode, which is what you'd expect.
        //
        // This stays an option rather than becoming `Action.enabled` because
        // it only applies to *extend* presses, and `enabled` is evaluated
        // without the event's modifiers.
        const extendLocked = isExtend && opts.extendClickLocked?.() === true;
        const deferClick = hitAlreadySelected && sel.length > 1 && !isExtend;
        if (!deferClick && !extendLocked) {
          selection.applyClick(top as NodeId, mods);
        }
        pressRef.current = { deferredClickId: deferClick ? top : null };
      },
    },
  }), []);

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
    // from swallowing every click. It is bound with no target (any click can
    // in principle be the release of a deferred press) at ACTIVE scope, so
    // without the gate it would outrank ambient click bindings like
    // `selectAnchor` and silently break anchor selection. Same fall-through
    // contract `clearSelection.enabled` relies on.
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
        const selection = deps.selection as SelectionApi | undefined;
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
      const base = defineTool<null>({
        id: 'select',
        capabilities: ['creates-selection'],
        hookName: 'useSelectTool',
        // A plain string: the mid-gesture cursors this used to compute from
        // gesture scratch now live on the actions that own those gestures
        // (`moveAction.activeCursor`, `areaSelectAction.activeCursor`), so
        // they apply to any consumer binding them, not just this tool.
        cursor: 'default',
        presentation: {
          label: 'Select',
          icon: createElement(SelectIcon),
          group: 'select',
        },
        actions: [pickAction, collapseDeferredAction],
      });

      // Shared move-binding opts (reparent-on-drop + behaviors). Applied to
      // both the selected-body and unselected-body move bindings so a
      // first-touch drag and a re-drag commit identically.
      const moveOpts: { opts?: BindingOpts } = (() => {
        const reparent = options.reparentOnDrop && options.reparentOnDrop !== 'off'
          ? { params: { reparentOnDrop: options.reparentOnDrop } }
          : undefined;
        const behaviors = options.move?.behaviors?.length
          ? { behaviors: options.move.behaviors as BindingOpts['behaviors'] }
          : undefined;
        return reparent || behaviors
          ? { opts: { ...reparent, ...behaviors } satisfies BindingOpts }
          : {};
      })();

      return {
        ...base,
        // Declarative bindings for the gesture dispatcher.
        // Binding priority (first match wins):
        //   0. Press → classify + select (runs before click/drag classification).
        //   1. Handle drags (resize) — guard on AffordanceHit kind.
        //   2. Rotate-handle drag — single-selection rotation.
        //   3. Body drag (selected OR unselected) — move the selection.
        //   4. Empty drag — marquee area-select.
        //   5. Click on empty (no modifiers) → clear selection.
        bindings: [
          // Every press that landed on the scene rather than on chrome. This
          // is the former `initial.pointerDown['*']` route: it classifies the
          // press and applies the selection change, and it does not consume
          // the gesture — the same press goes on to open a drag or synthesize
          // a click.
          //
          // The no-affordance target is load-bearing twice over. A press on a
          // resize handle, a rotate ring, a path anchor, or a registered
          // layer's own chrome is not a body pick, and re-picking underneath
          // it would change the selection the user was about to act on. And
          // because it is expressed in the SPEC rather than as an early
          // return in the action, the press falls through to whatever owns
          // that chrome instead of being consumed here — which is how an
          // ambient binding (`@weasel-js/hud`) gets to see it at all. The old
          // pipeline got both properties by construction: affordance hits
          // bypassed the active tool entirely.
          //
          // Modifiers are all `'optional'` because they are *data* here
          // (forwarded to `SelectionApi.applyClick`, which resolves them
          // against the host's configured extend key) rather than a route.
          {
            spec: {
              kind: 'pointerDown' as const,
              target: { kindOf: (hit: unknown) => hit == null },
              mods: { shift: 'optional' as const, alt: 'optional' as const, meta: 'optional' as const, ctrl: 'optional' as const },
            },
            actionId: 'select.pick',
          },
          // Release half of the deferred multi-click. Same `'optional'`
          // modifiers, same reason.
          {
            spec: {
              kind: 'click' as const,
              target: { kindOf: (hit: unknown) => hit == null },
              mods: { shift: 'optional' as const, alt: 'optional' as const, meta: 'optional' as const, ctrl: 'optional' as const },
            },
            actionId: 'select.collapseDeferred',
          },
          { spec: { kind: 'drag' as const, target: { kindOf: isResizeHandle } }, actionId: 'resize' },
          { spec: { kind: 'drag' as const, target: { kindOf: isRotateHandle } }, actionId: 'rotate' },
          // Alt-drag on a body → clone (Illustrator convention).
          // Listed BEFORE bare move so the strict-modifier dispatcher
          // picks this when Alt is held; bare move matches no-mod drags.
          // Both selected and unselected bodies are valid clone targets — the
          // pointerDown classifier calls `selection.applyClick(top, mods)` on
          // an unselected hit before the drag fires, so cloneAction's
          // `start` sees the hit node in `selection.get()` either way.
          { spec: { kind: 'drag' as const, target: 'selected-body' as const, mods: { alt: true } }, actionId: 'clone' },
          { spec: { kind: 'drag' as const, target: 'unselected-body' as const, mods: { alt: true } }, actionId: 'clone' },
          {
            // Body-drag → move, BUT defer when the pointerdown hit a path
            // anchor / control affordance. Anchors lie on the curve so the
            // body classifier still reports 'selected-body'; without this
            // opt-out, move's active-scope binding beats editAnchors's
            // ambient-scope binding on every anchor drag.
            //
            // `isAnchorOrControl` is the SAME predicate `editAnchorsAction`
            // matches on. That is load-bearing: the two must agree on what
            // counts as an anchor hit or move steals the drag — which is
            // exactly the bug this opt-out exists to prevent. (It used to be
            // a hand-rolled regex here that lacked the trailing-index
            // requirement, so the two sides could disagree.)
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
          // Body-drag on a NOT-yet-selected node → also move. The pointerDown
          // classifier selects the hit node before the drag fires (same
          // contract clone relies on), so by the time moveAction.start() runs
          // the node is in `selection.get()`. Without this active binding an
          // unselected-body drag finds no active match and falls through to
          // ambient scope, where the `rotate` catch-all (`{ kind: 'drag' }`,
          // start()-guarded only on a non-empty selection) hijacks it — the
          // "first drag rotates, later drags move" bug. Unselected nodes never
          // carry anchor affordances (those gate on selection), so the plain
          // string-form target is sufficient here.
          {
            spec: { kind: 'drag' as const, target: 'unselected-body' as const },
            actionId: 'move',
            ...moveOpts,
          },
          // Drag on empty canvas → marquee. Same no-affordance requirement as
          // the `clearSelection` click below: a bare `target: 'empty'` reads
          // only `bodyTarget`, so a drag starting on chrome that floats over
          // empty canvas (a hud window titlebar) matched here and beat the
          // chrome owner's ambient drag binding on scope priority alone.
          {
            spec: {
              kind: 'drag' as const,
              target: { kindOf: (hit: unknown, body?: string) => hit == null && body === 'empty' },
            },
            actionId: 'areaSelect',
          },
          // Click on empty canvas → clear. Same no-affordance requirement as
          // the press binding above, and for the same two reasons: clicking a
          // widget that happens to float over empty canvas isn't a click on
          // empty canvas, and declining in the SPEC lets the chrome's owner
          // have the click instead of it being consumed here.
          {
            spec: {
              kind: 'click' as const,
              target: { kindOf: (hit: unknown, body?: string) => hit == null && body === 'empty' },
              mods: {},
            },
            actionId: 'clearSelection',
          },
        ],
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options.debug, options.reparentOnDrop, options.move, pickAction, collapseDeferredAction],
  );
}
