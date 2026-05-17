import { useMemo, useRef, createElement } from 'react';
import { useIsDispatcherMounted } from 'interactions/dispatcher/dispatcherPresence';
import { SelectIcon } from '../../../icons';
import { pathContainsPoint } from 'features/paths/pathHitTest';
import type { Path } from 'features/paths/types';
import { findShapeSilhouette } from 'canvas/shapePainters';
import type { Node } from 'core/scene/types';
import { useMove, type UseMoveOptions } from 'interactions/actions/move/move';
import { useAreaSelect, type UseAreaSelectOptions } from 'interactions/actions/area-select/areaSelect';
import type { MoveAdapter } from 'core/adapters/types';
import type { AreaSelectAdapter } from 'core/adapters/types';
import type { NodeId } from 'core/scene/types';
import { defineTool, mods, begin, claim, none, forwardActionTo } from '../../routing';
import type { ActionFn } from '../../routing';
import type { Tool, ToolCtx } from '../../types';
import type { DebugSink } from '../../../debug/types';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { viewToMat3, type DrawCommand } from '../../../renderer';
import { pickTopMostHit } from '../pickTopMostHit';
import { MULTI_RESIZE_TARGET_ID, type Bounds } from '../shared/selectionTarget';
export type { Bounds };
export { MULTI_RESIZE_TARGET_ID };

export interface AreaSelectOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

export interface MoveOverlayStyle {
  ghostAlpha?: number;
}

export interface UseSelectToolOptions<TNode extends { id: string }, TPose> {
  /** Return ids of all objects whose painted body covers (worldX, worldY).
   *  Order doesn't matter — the tool collapses parent/child overlap via
   *  `pickTopMostHit`. When omitted, defaults to a rect AABB-vs-point scan
   *  over `adapter.getNodes()` using `poseBounds` (identity by default,
   *  works for `{x,y,width,height}` poses). Override for tighter shapes
   *  (path / polygon hit-tests). */
  pickEvery?: (worldX: number, worldY: number) => string[];
  /** Optional alt-aware selection-update hit returning the single id the
   *  click should act on. When set, `pointer.onDown` routes the body-hit
   *  branch through this instead of `pickTopMostHit(pickEvery(...))` — used by
   *  nesting consumers to resolve clicks to the outermost ancestor by
   *  default and drill one level deeper per alt-click. Receives the live
   *  selection so the drill step knows where to start. Returning `null`
   *  means "no body hit". When omitted, the tool uses
   *  `pickTopMostHit(pickEvery(...))`. */
  pickBest?: (
    worldX: number,
    worldY: number,
    alt: boolean,
    selection: readonly string[],
  ) => string | null;
  /** Return the world-space bounds of `id`, or null if not found. When
   *  omitted, defaults to `poseBounds(adapter.getPose(id))`, mirroring the
   *  default `pickEvery`. Override when your TPose isn't AABB-shaped. */
  boundsOf?: (id: string) => Bounds | null;
  /** Project a pose to its AABB. Default: identity (works for poses that
   *  carry top-level `x`/`y`/`width`/`height`). Used as the fallback
   *  projection for the auto-derived `pickEvery` and `boundsOf`. */
  poseBounds?: (pose: TPose) => Bounds;
  move?: UseMoveOptions<TPose>;
  areaSelect?: UseAreaSelectOptions;
  /** Optional debug sink. Reserved for future overlay/affordance hitbox
   *  recording — useSelectTool no longer routes through affordances itself
   *  (resize + rotate moved to `useResizeTool` / `useRotateTool`). Kept on
   *  the public surface so consumers don't have to thread it differently
   *  when the affordance recording lands. */
  debug?: DebugSink;
  /** Style for the area-select marquee. */
  areaSelectOverlayStyle?: AreaSelectOverlayStyle;
  /** Style for the move ghost (currently just `ghostAlpha`). */
  moveOverlayStyle?: MoveOverlayStyle;
  /** Consumer's draw function for ghost objects (move in-flight). Returns
   *  world-space DrawCommand[] for one ghost. If omitted, ghosts are not
   *  rendered (only the marquee draws). Optional only because some demos
   *  (e.g. NestingDemo) compose ghosts via custom layers. */
  drawGhost?: (
    obj: TNode | null,
    pose: TPose,
    view: { x: number; y: number; scale: { x: number; y: number } },
  ) => DrawCommand[];
  /** Object lookup for the ghost render, paired with `drawGhost`. Optional. */
  getNode?: (id: string) => TNode | null;
  /** Returns the live selection ids. Currently unused inside useSelectTool —
   *  retained on the option surface for compatibility with consumers (and so
   *  `useSelectWithAnchorEdit` etc. can forward it without conditional
   *  spreading). The synthetic `MULTI_RESIZE_TARGET_ID` previewBounds is
   *  owned by `useResizeTool` now. */
  getSelection?: () => readonly string[];
  /** Optional double-tap hook. When the dispatcher detects a double-tap (two
   *  sub-threshold clicks within `dblTap.windowMs` / `dblTap.maxDistance`),
   *  this fires with the world-space tap coords and the ids whose body covers
   *  that point (via `pickEvery`). Return value is ignored — internally the
   *  dbl-tap claim suppresses the second `onClick`. Use this to drive modal
   *  entry (e.g. select → edit-anchors) instead of attaching `onDoubleClick`
   *  to a wrapper DOM node. */
  onDoubleTap?: (args: {
    worldX: number;
    worldY: number;
    ids: string[];
    event: PointerEvent;
  }) => void;
}

/** Intersection of the move + area-select adapter interfaces.
 *  Resize / rotate adapters moved to `useResizeTool` / `useRotateTool`. */
export type SelectAdapter<TNode extends { id: string }, TPose> =
  MoveAdapter<TNode, TPose>
  & AreaSelectAdapter;

/** @internal */
export type SelectScratch =
  | { kind: 'idle' }
  | { kind: 'move'; ids: string[]; deferredClickId: string | null }
  | { kind: 'area' };

/** Active-slot Tool wrapping `useMove` + `useAreaSelect`.
 *
 *  Hit-test priority:
 *  1. pointer.onDown body hit → move + immediate selection.
 *  2. pointer.onDown empty → area-select marquee (or click-to-clear).
 *
 *  Resize + rotate live in `useResizeTool` / `useRotateTool` — their
 *  affordances participate in dispatch via the same ambient/overlay pipeline,
 *  not through this hook. `scratch` routes `drag.*` to the matching
 *  controller. */
export function useSelectTool<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TNode, TPose>,
): Tool<SelectScratch> {
  const move = useMove<TNode, TPose>(adapter, options.move ?? {});
  // Default to no marquee behaviors. start/move/end still run (so empty-click
  // clear via onClick keeps working) but a drag from empty space doesn't
  // mutate the selection unless the consumer opts in with
  // `areaSelect: { behaviors: [selectFromMarquee()] }`. Most demos don't
  // need marquee selection, and consumers that do should declare it
  // explicitly rather than getting it as an invisible side effect of mounting
  // a select tool.
  const areaSelectOptions = useMemo<UseAreaSelectOptions>(() => {
    const provided = options.areaSelect;
    if (provided?.behaviors) return provided;
    return { ...(provided ?? {}), behaviors: [] };
  }, [options.areaSelect]);
  const areaSelect = useAreaSelect(adapter, areaSelectOptions);

  // Latest-callback ref for `onDoubleTap` so the memoized tool body picks up
  // re-renders without rebuilding the Tool record. Same pattern as `styleRefs`.
  const onDoubleTapRef = useRef(options.onDoubleTap);
  onDoubleTapRef.current = options.onDoubleTap;

  // pickEvery / boundsOf defaults — for any rect-pose adapter the kit can
  // derive both from `adapter.getNodes()` + `adapter.getPose(id)` +
  // poseBounds (identity by default). Consumers override for tighter shapes
  // (e.g. path-pose canvases) or for a domain-specific pick order.
  const poseBoundsFn = options.poseBounds ?? ((p: TPose) => p as unknown as Bounds);
  const pickEveryFn = options.pickEvery ?? ((worldX: number, worldY: number): string[] => {
    // Detect whether the adapter exposes a hierarchical surface (getChildren +
    // getNode). Scene-derived adapters (sceneToAdapter) provide both; plain
    // flat adapters (arrayAdapter) may not. When both are present, perform a
    // clip-aware hierarchical walk so that leaves occluded by an ancestor
    // container's clipFromPose are excluded. When absent, fall back to the
    // original flat scan over getNodes() — same O(n) AABB test as before.
    const hier = adapter as unknown as {
      getNode?: (id: string) => unknown;
      getChildren?: (parentId: string | null) => readonly string[];
    };

    if (typeof hier.getChildren !== 'function' || typeof hier.getNode !== 'function') {
      // Flat-adapter path (no hierarchy surface).
      const out: string[] = [];
      for (const obj of adapter.getNodes()) {
        const b = poseBoundsFn(adapter.getPose(obj.id));
        if (worldX >= b.x && worldX <= b.x + b.width
            && worldY >= b.y && worldY <= b.y + b.height) {
          out.push(obj.id);
        }
      }
      return out;
    }

    // Clip-aware hierarchical walk (analogous to walkClipAware in sceneAdapter,
    // but for point queries using pathContainsPoint instead of pathIntersectsRect).
    const out: string[] = [];

    function walk(parentId: string | null, ancestorClips: readonly Path[]): void {
      nextChild: for (const childId of hier.getChildren!(parentId)) {
        const node = hier.getNode!(childId) as {
          kind?: string;
          clipFromPose?: (pose: TPose) => Path | null;
        };
        const pose = adapter.getPose(childId);

        if (node.kind === 'container') {
          // Compute this container's own clip, if any. Explicit
          // `clipFromPose` wins; otherwise fall back to the painter
          // silhouette so non-rect shape kinds clip correctly without
          // per-node wiring (mirrors the renderer's container-clip path).
          let ownClip: Path | null = null;
          if (typeof node.clipFromPose === 'function') {
            ownClip = node.clipFromPose(pose);
          } else {
            ownClip = findShapeSilhouette(
              node as unknown as Node<unknown, string, TPose>,
              pose,
            );
          }

          // Containers are hit-tested against their AABB, but if the container
          // has a clip the click must also lie within that clip. This mirrors
          // the semantic that clicking outside the visible (clipped) region of
          // a container should not select it.
          const b = poseBoundsFn(pose);
          const inAabb = worldX >= b.x && worldX <= b.x + b.width
              && worldY >= b.y && worldY <= b.y + b.height;
          const inClip = ownClip === null || pathContainsPoint(ownClip, worldX, worldY);
          // Also gate on ancestor clips.
          let passesAncestors = true;
          for (const clip of ancestorClips) {
            if (!pathContainsPoint(clip, worldX, worldY)) { passesAncestors = false; break; }
          }
          if (inAabb && inClip && passesAncestors) {
            out.push(childId);
          }

          // Build child clip chain: append own clip if present.
          const childClips: readonly Path[] =
            ownClip !== null ? [...ancestorClips, ownClip] : ancestorClips;

          walk(childId, childClips);
        } else {
          // Leaf node: skip this leaf (continue to next sibling) if the point
          // lies outside any ancestor clip. Using a labeled continue so we
          // advance the outer childId loop, not the inner clip loop.
          for (const clip of ancestorClips) {
            if (!pathContainsPoint(clip, worldX, worldY)) continue nextChild;
          }
          const b = poseBoundsFn(pose);
          if (worldX >= b.x && worldX <= b.x + b.width
              && worldY >= b.y && worldY <= b.y + b.height) {
            out.push(childId);
          }
        }
      }
    }

    walk(null, []);
    return out;
  });
  const pickEveryRef = useRef(pickEveryFn);
  pickEveryRef.current = pickEveryFn;

  // Refs let the overlay closure pull the latest style/callbacks without
  // rebuilding the Tool record on every render.
  const styleRefs = useRef({
    areaSelectOverlayStyle: options.areaSelectOverlayStyle,
    moveOverlayStyle: options.moveOverlayStyle,
    drawGhost: options.drawGhost,
    getNode: options.getNode,
  });
  styleRefs.current = {
    areaSelectOverlayStyle: options.areaSelectOverlayStyle,
    moveOverlayStyle: options.moveOverlayStyle,
    drawGhost: options.drawGhost,
    getNode: options.getNode,
  };

  // Ghost / marquee overlay. Move-ghosts + area-select marquee only —
  // resize/rotate ghosts moved to their respective tools' overlays. These
  // are decorative chrome, NOT affordances, so they live outside the
  // affordance layer pipeline.
  //
  // The layer is `space: 'screen'`. The marquee branch already lives in
  // screen coords (via `worldToScreen`); ghosts go through `drawGhost`,
  // wrapped in a world-transform group. When `drawGhost` is omitted,
  // ghosts are invisible during drag — fallback consumers can opt in via
  // SceneCanvas's preview-ghost layer driven by scene-slot `drawOne`.
  const ghostOverlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'select-overlay',
      label: 'Select overlay',
      space: 'screen',
      draw: (_data, view) => {
        const refs = styleRefs.current;
        const aOv = areaSelect.overlay;
        if (aOv) {
          const cfg = refs.areaSelectOverlayStyle ?? {};
          const fill = cfg.fill ?? 'rgba(164, 139, 212, 0.18)';
          const stroke = cfg.stroke ?? '#a48bd4';
          const dash = cfg.dash ?? [3, 3];
          const lineWidth = cfg.lineWidth ?? 1;
          const t = viewToTransform(view);
          const x = Math.min(aOv.start.worldX, aOv.current.worldX);
          const y = Math.min(aOv.start.worldY, aOv.current.worldY);
          const w = Math.abs(aOv.current.worldX - aOv.start.worldX);
          const h = Math.abs(aOv.current.worldY - aOv.start.worldY);
          const [sx, sy] = worldToScreen(x, y, t);
          const sw = w * view.scale.x;
          const sh = h * view.scale.y;
          return [{
            kind: 'path',
            path: { kind: 'rect', x: sx, y: sy, width: sw, height: sh },
            fill: { color: fill },
            stroke: { paint: { color: stroke }, width: lineWidth, dash },
          }];
        }

        const drawGhost = refs.drawGhost;
        const getNode = refs.getNode;
        if (!drawGhost || !getNode) return [];
        const moveAlpha = refs.moveOverlayStyle?.ghostAlpha ?? 0.85;
        const wrap = (alpha: number, cmds: DrawCommand[]): DrawCommand[] =>
          cmds.length === 0 ? [] : [{ kind: 'group', alpha, transform: viewToMat3(view), children: cmds }];

        const mOv = move.overlay;
        if (mOv) {
          const cmds: DrawCommand[] = [];
          for (const [id, pose] of mOv.poses) {
            for (const c of drawGhost(getNode(id), pose, view)) cmds.push(c);
          }
          return wrap(moveAlpha, cmds);
        }
        return [];
      },
    }),
    [move, areaSelect],
  );

  // The Tool's overlay is just the ghost/marquee layer. Resize + rotate
  // affordances live in their own tools' overlays, which the dispatcher
  // composes via the active+ambient walk.
  const overlay = ghostOverlay;

  // previewPose: surface the move controller's in-flight pose for the
  // dragged id. Lets Canvas.helpersRef.getEffectivePose stay overlay-aware
  // without reaching into hook internals. Resize/rotate slices moved to
  // their respective tools' previewPose.
  const previewPose = (id: string): TPose | null => {
    const mOv = move.overlay;
    if (mOv) {
      const p = mOv.poses.get(id);
      if (p !== undefined) return p as TPose;
    }
    return null;
  };

  // previewIds: every id whose committed paint should be suppressed while a
  // move gesture is in flight, so the source doesn't bleed through the ghost.
  // Resize/rotate suppression moved to those tools' previewIds.
  const previewIds = (): Iterable<string> | null => {
    const out = new Set<string>();
    const mOv = move.overlay;
    if (mOv) for (const id of mOv.hideIds) out.add(id);
    return out.size > 0 ? out : null;
  };

  // pointerDown classifier — declarative route table that subsumes the
  // body-hit / empty branches of the original legacyOnDown shim. Decides
  // whether the upcoming gesture will move the existing selection (hit
  // is part of it) or a freshly-clicked id, and primes scratch via
  // begin(spec) so drag.onStart sees the classified state. No
  // onMove/onRelease in the spec: pointerDown stays out of engaged
  // phase — the dispatcher's drag pipeline (declarative drag route)
  // owns the engaged spec.
  const pointerDownBody: ActionFn<SelectScratch> = (ctx) => {
    const sel = ctx.selection.current;
    const top = options.pickBest
      ? options.pickBest(ctx.worldX, ctx.worldY, ctx.modifiers.alt, sel)
      : (() => {
          const ids = pickEveryFn(ctx.worldX, ctx.worldY);
          if (ids.length === 0) return null;
          // pickTopMostHit collapses parent/child overlap (container's
          // bounds also cover the child) and falls back to "last id" for
          // pure sibling hits — matches the bottom-first iteration order
          // most demos produce.
          return pickTopMostHit(ids, adapter) ?? ids[0];
        })();
    if (top !== null) {
      // Capture pre-click selection so we can decide whether the drag
      // moves the existing set or just the freshly-clicked object.
      // `ctx.selection.current` is the React snapshot from the
      // dispatcher's render — it does not reflect mutations made by
      // applyClick during this same callback.
      const preClick = sel;
      const hitAlreadySelected = preClick.includes(top as NodeId);
      const isExtend = ctx.modifiers.shift || ctx.modifiers.meta;
      // When the hit is already part of a multi-selection and no
      // extend modifier is held, defer the collapse-to-single to
      // onClick. Otherwise applying it on down would wipe the
      // multi-selection before a drag can move the whole set.
      const deferClick = hitAlreadySelected && preClick.length > 1 && !isExtend;
      if (!deferClick) ctx.selection.applyClick(top as NodeId, ctx.modifiers);
      // If the user clicked something already selected, drag the whole
      // selection. Otherwise the click switches selection and the drag
      // moves only the clicked object — matches Figma/Sketch behavior
      // ("dragging an unselected object shouldn't move the old one").
      const moveIds: string[] = hitAlreadySelected && preClick.length > 0 ? [...preClick] : [top];
      const moveScratch: SelectScratch = {
        kind: 'move',
        ids: moveIds,
        deferredClickId: deferClick ? top : null,
      };
      return begin<SelectScratch>({ scratch: moveScratch });
    }
    // No body hit (pickBest returned null, or pickEvery was empty):
    // fall through to empty/marquee branch.
    const areaScratch: SelectScratch = { kind: 'area' };
    return begin<SelectScratch>({ scratch: areaScratch });
  };

  // Compute the ids the move gesture should drag, given the current hit and
  // live selection. Mirrors the rule the imperative `onDown` shim follows when
  // it stashes `scratch.ids`: if the body-hit is part of the existing
  // selection, drag the whole set; otherwise drag just the hit id.
  //
  // `ctx.selection.current` is the React snapshot at dispatch time — it
  // doesn't reflect the `applyClick` the onDown shim has just enqueued, which
  // is what preserves the "drag an unselected rect moves only that rect"
  // semantic. The freshly-clicked id won't yet appear in `selection.current`.
  const computeMoveIds = (ctx: ToolCtx<SelectScratch>): NodeId[] => {
    const hit = ctx.target;
    const hitId = hit?.category === 'node' ? (hit.id as NodeId) : null;
    if (!hitId) return [];
    const selected = ctx.selection.current;
    if (selected.includes(hitId)) return [...selected] as NodeId[];
    return [hitId];
  };

  // Drag route table. Keyed by `ctx.target.kind`:
  //   rect/text/path → move.beginAt(ids); empty → areaSelect.beginAt
  //   (with a scratch-driven fall-through to move when pointerDownBody
  //   already classified the gesture as 'move' against the tool's own
  //   pickEvery — see `dragEmpty` below).
  //
  // beginAt returns a `Result<'begin'>` whose `spec` carries the gesture's
  // continuation closures (onMove/onRelease/onCancel). The routing factory
  // installs those closures into its `activeSpec` slot, so engaged-phase
  // pointer events route through the same gesture primitive without any
  // scratch-kind switch in this file.
  //
  // `beginMove` prefers ids stashed by pointerDownBody (which uses the
  // tool's own pickEvery / pickBest) over `computeMoveIds(ctx)`, which
  // re-derives from `ctx.target.id` (Canvas's pickEvery prop). Those two
  // can disagree when consumers wire a tool-side pickEvery without also
  // forwarding it to <Canvas pickEvery=>; preferring scratch lets the
  // tool work without that double-wiring trap.
  const beginMove: ActionFn<SelectScratch> = (ctx) => {
    const ids = ctx.scratch?.kind === 'move' ? (ctx.scratch.ids as NodeId[]) : computeMoveIds(ctx);
    return move.beginAt(ctx, ids) as ReturnType<ActionFn<SelectScratch>>;
  };

  // dblTap forwards to the consumer's onDoubleTap escape-hatch via the
  // shared `forwardActionTo` routing util — same shape any tool with a
  // consumer-callback hook can use.
  const forwardDblTap = forwardActionTo<SelectScratch, {
    worldX: number; worldY: number; ids: string[]; event: PointerEvent;
  }>(
    onDoubleTapRef,
    (ctx, e) => ({
      worldX: ctx.worldX,
      worldY: ctx.worldY,
      ids: pickEveryRef.current(ctx.worldX, ctx.worldY),
      event: e as PointerEvent,
    }),
  );
  const beginArea: ActionFn<SelectScratch> = (ctx) =>
    areaSelect.beginAt(ctx) as ReturnType<ActionFn<SelectScratch>>;

  // Click action handlers. Run on sub-threshold release after the imperative
  // `onDown` shim has already populated scratch + selection:
  //   - scratch.kind === 'move' with deferredClickId → collapse the
  //     multi-selection to the deferred id. onDown deferred this so a
  //     pre-threshold drag could move the whole set instead.
  //   - scratch.kind === 'area' (empty pointerdown) → clear the selection.
  //     onDown deferred to release so an accidental tap on empty doesn't
  //     wipe the set mid-thought.
  //   - any other scratch → onDown's applyClick already mutated selection.
  //
  // These handlers call `ctx.selection.applyClick` / `ctx.selection.clear`
  // imperatively rather than emitting setSelectionOp via `apply()`, because
  // `selection.applyClick` is the single source of selection mutation in
  // useSelectTool today (it's how onDown writes selection). Emitting a
  // setSelectionOp here would double-mutate against onDown's applyClick.
  // Migrating both onDown and onClick to ops-only selection is Phase 4.5
  // (pointerDown route table) work.
  const collapseDeferredClick: ActionFn<SelectScratch> = (ctx) => {
    if (ctx.scratch.kind === 'move' && ctx.scratch.deferredClickId !== null) {
      ctx.selection.applyClick(ctx.scratch.deferredClickId as NodeId, ctx.modifiers);
      return claim();
    }
    return none();
  };
  // clearOnEmpty — REMOVED (Phase 14a): was `[mods()]: clearOnEmpty` in the
  // click route table below. Replaced by the `clearSelection` binding in
  // Tool.bindings (fired by the new gesture dispatcher via clearSelectionAction).
  // The function body is kept as a comment for rollback reference:
  //   if (ctx.scratch.kind === 'area') { ctx.selection.clear(); return claim(); }
  //   return none();

  // When the new gesture dispatcher is mounted (inside a SceneCanvas or other
  // DispatcherPresenceProvider), the drag bindings take over from the old
  // route-table drag entries. When it's absent (legacy Canvas, tests that
  // don't use SceneCanvas), the flag stays false and the old path fires as
  // before — no double-application risk, no silent no-ops.
  const gestureDispatcherMounted = useIsDispatcherMounted();

  return useMemo(
    () => {
      // Declarative factory — every gesture surface is a route table:
      // pointerDown classifies the upcoming gesture into scratch (move
      // vs. area); drag dispatches to move.beginAt / areaSelect.beginAt;
      // click handles deferred-clear / deferred-collapse; dblTap forwards
      // to the consumer callback with the raw PointerEvent.
      const base = defineTool<SelectScratch>({
        id: 'select',
        keybinding: { key: 'V' },
        // Cursor resolver reads scratch.kind directly rather than going
        // through engaged-phase override. defineTool's `phaseOf` switches
        // to engaged whenever `scratch != null`, but useSelectTool's
        // resting scratch is `{ kind: 'idle' }` (not null) so an
        // engaged-phase route table would shadow the initial routes on
        // every fresh gesture. A top-level function-form cursor sidesteps
        // that — it's the same effect (move → 'move', area → 'crosshair',
        // anything else → 'default') without the phase machinery.
        cursor: (ctx) => {
          if (ctx.scratch?.kind === 'move') return 'move';
          if (ctx.scratch?.kind === 'area') return 'crosshair';
          return 'default';
        },
        presentation: {
          label: 'Select',
          icon: createElement(SelectIcon),
          group: 'select',
        },
        initial: {
          // pointerDown: body-hit / empty classifier. The handler runs
          // the tool's own `pickBest` / `pickEveryFn` regardless of
          // `ctx.target.kind` because the dispatcher's `target` is
          // derived from Canvas's optional `pickEvery` prop (which may
          // be unset or wired to a different pick predicate than the
          // tool's). Pre-migration, `legacyOnDown` ignored target and
          // always consulted its own pickEvery — we preserve that. The
          // handler decides body vs. empty internally and primes scratch
          // via begin(spec). Wired for every key (rect/text/path/'*'/
          // empty) since the routing engine's `empty` doesn't fall
          // through to `'*'`. Handles applyClick + bring-to-front
          // imperatively because selection mutation is shared with the
          // imperative onClick path; emitting an op here would
          // double-mutate against the selection API.
          // pointerDownBody decides body vs. empty internally (via its own
          // pickEveryFn), so the kit's route key doesn't matter — we just
          // need to be invoked on every pointerdown. '*' now catches empty
          // hits via the wildcard fall-through (T1 of the wildcard semantic
          // flip), so a single entry covers every target kind.
          pointerDown: {
            '*': pointerDownBody,
          },
          drag: {
            // Any node click → move. Empty space → marquee — unless
            // pointerDownBody already classified the gesture as 'move'
            // against the tool's own pickEvery / pickBest, in which case
            // honor scratch over `ctx.target` (which can disagree when
            // <Canvas pickEvery=> isn't separately wired). Consumers that
            // want per-kind drag behavior (e.g. text → enter-edit) can
            // override by passing a custom drag route table.
            '*': beginMove,
            empty: (ctx) =>
              (ctx.scratch?.kind === 'move' ? beginMove(ctx) : beginArea(ctx)) as ReturnType<ActionFn<SelectScratch>>,
          },
          // Click route table with modifier sub-tables (Task 5). Each
          // node-kind route only runs the deferred-collapse path —
          // selection-replace was already done in onDown's applyClick.
          // Empty target routes split on modifier: plain release clears,
          // shift/mod release preserves the set.
          //
          // Alt-click does not clone today: useSelectTool's existing
          // alt-click behavior is to ignore alt (it falls through to
          // applyClick which doesn't treat alt as an extend modifier),
          // which in single-mode replaces selection and in multi-mode
          // also replaces selection. Cloning is owned by useCloneTool
          // via alt-drag, not click. We don't add an [mods('alt')] route
          // because there's no distinct alt-click behavior to express —
          // the default route (no sub-table) already covers it.
          click: {
            '*': collapseDeferredClick,
            empty: {
              // [mods()]: clearOnEmpty — REMOVED (Phase 14a): replaced by the
              // `clearSelection` binding in Tool.bindings. When the gesture
              // dispatcher is mounted, the binding fires clearSelectionAction
              // instead. The route-table entry is removed to avoid double-fire.
              // Modifier-keyed entries stay here: shift/mod/mod+shift preserve
              // the selection (no-op). These are route-table territory until 14b.
              [mods('shift')]:   () => none(),
              [mods('mod')]:     () => none(),
              [mods('mod', 'shift')]: () => none(),
            },
          },
          // dblTap: forward to the consumer's onDoubleTap callback. The
          // raw PointerEvent now arrives as the second ActionFn parameter
          // (Phase 4.5 Task 3), so this route no longer needs an
          // imperative shim. Returns claim() so the dispatcher suppresses
          // the regular onClick on this gesture. '*' now catches empty
          // hits via the wildcard fall-through, so a single entry covers
          // every target kind.
          dblTap: {
            '*': forwardDblTap,
          },
        },
      });

      // The routing factory's translated Tool covers every gesture
      // channel (pointer.onDown / onClick / drag / dblTap.onTap) via the
      // route tables above. We only need to layer kit-only fields that
      // aren't part of ToolDef — overlay, previewPose, previewIds,
      // initScratch. `base.cursor` is the factory-supplied resolver that
      // honors the engaged-phase override above; don't override it here.
      return {
        ...base,
        initScratch: () => ({ kind: 'idle' as const }),
        overlay,
        previewPose,
        previewIds,
        // Phase 13: declarative drag bindings for the new gesture dispatcher.
        // These replace the `drag: { '*': beginMove, empty: ... }` route table
        // entries above (which are kept as dead code for Phase 14 cleanup).
        // `bindingsOverrideDrag: true` suppresses the old dispatcher's drag
        // channel so only the new dispatcher handles drag gestures.
        //
        // Binding priority (first match wins):
        //   1. Handle drags (resize) — most specific, guard on AffordanceHit kind.
        //   2. Rotate-handle drag — single-selection rotation.
        //   3. Body drag (selected) — move the selection.
        //   4. Empty drag — marquee area-select.
        //
        // The `kindOf` predicates receive the `AffordanceHit | undefined` from
        // `buildAffordanceAt` (via `InvocationCtx.drag.affordance`), threaded
        // through the event's `affordance` field. String-form targets
        // ('selected-body', 'empty') are resolved by the `classifyTarget` thunk
        // wired in `GestureDispatcherMounter`.
        bindings: [
          // 1. Resize handles — fire `resizeAction` (requires `handle:*` affordance).
          {
            spec: {
              kind: 'drag' as const,
              target: {
                kindOf: (hit: unknown): boolean => {
                  const h = hit as { kind?: string } | null | undefined;
                  return typeof h?.kind === 'string' && h.kind.startsWith('handle:');
                },
              },
            },
            actionId: 'resize',
          },
          // 2. Rotation handle — fire `rotateAction`.
          {
            spec: {
              kind: 'drag' as const,
              target: {
                kindOf: (hit: unknown): boolean => {
                  const h = hit as { kind?: string } | null | undefined;
                  return h?.kind === 'rotate-handle';
                },
              },
            },
            actionId: 'rotate',
          },
          // 3. Body drag (selected node) — move the selection.
          { spec: { kind: 'drag' as const, target: 'selected-body' as const }, actionId: 'move' },
          // 4. Empty drag — rubber-band area-select.
          { spec: { kind: 'drag' as const, target: 'empty' as const }, actionId: 'areaSelect' },
          // 5. Click on empty (no modifiers) → clear selection (Phase 14a).
          //    Replaces the route-table `click.empty.[mods()]` entry above.
          //    Requires `classifyTarget` to be wired (SceneCanvas context).
          { spec: { kind: 'click' as const, target: 'empty' as const, mods: {} }, actionId: 'clearSelection' },
        ],
        // Suppress the old dispatcher's drag-slot when the new gesture
        // dispatcher is mounted (SceneCanvas context). When absent, the flag
        // is `false` so legacy Canvas / test harnesses keep using the old path.
        bindingsOverrideDrag: gestureDispatcherMounted,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [move, areaSelect, overlay, pickEveryFn, options.pickBest, options.debug, gestureDispatcherMounted],
  );
}
