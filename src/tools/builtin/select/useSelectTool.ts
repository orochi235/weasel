import { useMemo, useRef, createElement } from 'react';
import { SelectIcon } from '../../../icons';
import { pathContainsPoint } from 'features/paths/pathHitTest';
import type { Path } from 'features/paths/types';
import { findShapeSilhouette } from 'canvas/NodeShape';
import type { Node } from 'core/scene/types';
import type { MoveAdapter } from 'core/adapters/types';
import type { AreaSelectAdapter } from 'core/adapters/types';
import type { NodeId } from 'core/scene/types';
import { defineTool, mods, begin, claim, none, forwardActionTo } from '../../routing';
import type { ActionFn } from '../../routing';
import type { Tool } from '../../types';
import type { DebugSink } from '../../../debug/types';
import type { DrawCommand } from '../../../renderer';
import { pickTopMostHit } from '../pickTopMostHit';
import { MULTI_RESIZE_TARGET_ID, type Bounds } from '../shared/selectionTarget';
export type { Bounds };
export { MULTI_RESIZE_TARGET_ID };

/** Pre-14e Task 3 style hooks for the area-select marquee. The dispatcher
 *  overlay layer (`useDispatcherOverlayLayer`) now owns marquee paint; this
 *  type is retained on the option surface for source-compat with callers
 *  threading it through. */
export interface AreaSelectOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

/** Pre-14e Task 3 style hook for the move ghost. The preview-ghost layer
 *  renders moved silhouettes via `drawOne` now. Retained for source-compat. */
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
   *  click should act on. */
  pickBest?: (
    worldX: number,
    worldY: number,
    alt: boolean,
    selection: readonly string[],
  ) => string | null;
  /** Return the world-space bounds of `id`, or null if not found. */
  boundsOf?: (id: string) => Bounds | null;
  /** Project a pose to its AABB. Default: identity. */
  poseBounds?: (pose: TPose) => Bounds;
  /** Legacy `useMove` options. Ignored after Phase 14e Task 3 — `moveAction`
   *  is configured at the action-registration level now. */
  move?: unknown;
  /** Legacy `useAreaSelect` options. Ignored after Phase 14e Task 3 —
   *  `areaSelectAction` configuration moved to the action registration. */
  areaSelect?: unknown;
  /** Optional debug sink. Reserved for future overlay/affordance hitbox
   *  recording. */
  debug?: DebugSink;
  /** Style for the area-select marquee. Pre-14e wired the legacy overlay;
   *  after T3 it's consumed by the dispatcher overlay layer via
   *  `useDispatcherOverlayLayer`'s `style` arg (not by this tool). Retained
   *  for option-surface compat. */
  areaSelectOverlayStyle?: AreaSelectOverlayStyle;
  /** Style for the move ghost. Pre-14e wired the legacy overlay's alpha;
   *  preview-ghost layer alpha now lives in `usePreviewGhostLayer`. */
  moveOverlayStyle?: MoveOverlayStyle;
  /** Consumer's draw function for ghost objects. Pre-14e the select tool
   *  invoked this from its own overlay; the preview-ghost layer now calls
   *  the scene slot's `drawOne` directly, so this option is no longer in
   *  the runtime path. */
  drawGhost?: (
    obj: TNode | null,
    pose: TPose,
    view: { x: number; y: number; scale: { x: number; y: number } },
  ) => DrawCommand[];
  /** Object lookup paired with `drawGhost`. Pre-14e runtime hook; vestigial. */
  getNode?: (id: string) => TNode | null;
  /** Returns the live selection ids. */
  getSelection?: () => readonly string[];
  /** Reparent-on-drop behavior for drag-to-move. `'off'` (default)
   *  preserves translate-only commits. `'top'` lands the moved nodes at
   *  the top of the container under the drop point. `'above'` lands them
   *  immediately above the hit sibling in z-order (falls back to `'top'`
   *  semantics when the hit is itself a container). Requires the
   *  `nodeAtPoint` dep to be registered (sourced by `<SceneCanvas>`). */
  reparentOnDrop?: 'off' | 'top' | 'above';
  /** Optional double-tap hook. */
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

/** Active-slot Tool. After Phase 14e Task 3:
 *  - pointerDown classifier still runs the tool's own pickBest/pickEvery
 *    so click semantics (selection replace, extend, deferred collapse) are
 *    preserved across the same code path.
 *  - drag is owned exclusively by the dispatcher via `Tool.bindings`
 *    (selected-body → moveAction, rotate-handle → rotateAction, handle:* →
 *    resizeAction, empty → areaSelectAction, click on empty → clearSelection).
 *  - Move ghosts render via the preview-ghost layer (driven by moveAction's
 *    `previewIds`/`previewPose`); the marquee renders via the dispatcher
 *    overlay layer (driven by areaSelectAction's `overlay()`).
 */
export function useSelectTool<TNode extends { id: string }, TPose>(
  adapter: SelectAdapter<TNode, TPose>,
  options: UseSelectToolOptions<TNode, TPose>,
): Tool<SelectScratch> {
  // Latest-callback ref for `onDoubleTap` so the memoized tool body picks up
  // re-renders without rebuilding the Tool record.
  const onDoubleTapRef = useRef(options.onDoubleTap);
  onDoubleTapRef.current = options.onDoubleTap;

  // pickEvery / boundsOf defaults — for any rect-pose adapter the kit can
  // derive both from `adapter.getNodes()` + `adapter.getPose(id)` +
  // poseBounds (identity by default).
  const poseBoundsFn = options.poseBounds ?? ((p: TPose) => p as unknown as Bounds);
  const pickEveryFn = options.pickEvery ?? ((worldX: number, worldY: number): string[] => {
    const hier = adapter as unknown as {
      getNode?: (id: string) => unknown;
      getChildren?: (parentId: string | null) => readonly string[];
    };

    if (typeof hier.getChildren !== 'function' || typeof hier.getNode !== 'function') {
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

  // pointerDown classifier — declarative route table that classifies the
  // upcoming gesture into scratch (move vs. area) so click handlers can
  // distinguish deferred-collapse from deferred-clear cases.
  const pointerDownBody: ActionFn<SelectScratch> = (ctx) => {
    const sel = ctx.selection.current;
    const top = options.pickBest
      ? options.pickBest(ctx.worldX, ctx.worldY, ctx.modifiers.alt, sel)
      : (() => {
          const ids = pickEveryFn(ctx.worldX, ctx.worldY);
          if (ids.length === 0) return null;
          return pickTopMostHit(ids, adapter) ?? ids[0];
        })();
    if (top !== null) {
      const preClick = sel;
      const hitAlreadySelected = preClick.includes(top as NodeId);
      const isExtend = ctx.modifiers.shift || ctx.modifiers.meta;
      const deferClick = hitAlreadySelected && preClick.length > 1 && !isExtend;
      if (!deferClick) ctx.selection.applyClick(top as NodeId, ctx.modifiers);
      const moveIds: string[] = hitAlreadySelected && preClick.length > 0 ? [...preClick] : [top];
      const moveScratch: SelectScratch = {
        kind: 'move',
        ids: moveIds,
        deferredClickId: deferClick ? top : null,
      };
      return begin<SelectScratch>({ scratch: moveScratch });
    }
    const areaScratch: SelectScratch = { kind: 'area' };
    return begin<SelectScratch>({ scratch: areaScratch });
  };

  // dblTap forwards to the consumer's onDoubleTap escape-hatch via the
  // shared `forwardActionTo` routing util.
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

  // Click action handlers. Run on sub-threshold release after the
  // pointerDown classifier has populated scratch + selection.
  const collapseDeferredClick: ActionFn<SelectScratch> = (ctx) => {
    if (ctx.scratch.kind === 'move' && ctx.scratch.deferredClickId !== null) {
      ctx.selection.applyClick(ctx.scratch.deferredClickId as NodeId, ctx.modifiers);
      return claim();
    }
    return none();
  };

  return useMemo(
    () => {
      const base = defineTool<SelectScratch>({
        id: 'select',
        capabilities: ['selection'],
        hookName: 'useSelectTool',
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
          // pointerDown: body-hit / empty classifier. Runs the tool's own
          // `pickBest` / `pickEveryFn` regardless of `ctx.target.kind` to
          // preserve the pre-routing semantic.
          pointerDown: {
            '*': pointerDownBody,
          },
          // Click route table — modifier sub-tables handle the empty-target
          // modifier variants; the `clearSelection` binding (in
          // `Tool.bindings` below) handles the plain (no-modifier) case.
          click: {
            '*': collapseDeferredClick,
            empty: {
              [mods('shift')]:   () => none(),
              [mods('mod')]:     () => none(),
              [mods('mod', 'shift')]: () => none(),
            },
          },
          dblTap: {
            '*': forwardDblTap,
          },
        },
      });

      return {
        ...base,
        initScratch: () => ({ kind: 'idle' as const }),
        // Declarative drag bindings for the gesture dispatcher.
        // Binding priority (first match wins):
        //   1. Handle drags (resize) — guard on AffordanceHit kind.
        //   2. Rotate-handle drag — single-selection rotation.
        //   3. Body drag (selected) — move the selection.
        //   4. Empty drag — marquee area-select.
        //   5. Click on empty (no modifiers) → clear selection.
        bindings: [
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
            spec: {
              kind: 'drag' as const,
              target: {
                kindOf: (afford: unknown, body?: string): boolean => {
                  if (body !== 'selected-body') return false;
                  if (
                    typeof afford === 'object' && afford !== null &&
                    typeof (afford as { kind?: unknown }).kind === 'string' &&
                    /^(anchor|controlIn|controlOut):/.test((afford as { kind: string }).kind)
                  ) return false;
                  return true;
                },
              },
            },
            actionId: 'move',
            ...(options.reparentOnDrop && options.reparentOnDrop !== 'off'
              ? { opts: { params: { reparentOnDrop: options.reparentOnDrop } } }
              : {}),
          },
          { spec: { kind: 'drag' as const, target: 'empty' as const }, actionId: 'areaSelect' },
          { spec: { kind: 'click' as const, target: 'empty' as const, mods: {} }, actionId: 'clearSelection' },
        ],
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickEveryFn, options.pickBest, options.debug, options.reparentOnDrop],
  );
}
