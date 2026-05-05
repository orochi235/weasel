import { useMemo, useRef } from 'react';
import { useMove, type UseMoveOptions } from '../../interactions/gestures/move/move';
import { useResize, type UseResizeOptions } from '../../interactions/gestures/resize/resize';
import { useRotate, type UseRotateOptions } from '../../interactions/gestures/rotate/rotate';
import { useAreaSelect, type UseAreaSelectOptions } from '../../interactions/gestures/area-select/areaSelect';
import { selectFromMarquee } from '../../interactions/gestures/area-select/behaviors/selectFromMarquee';
import { cornerResizeHandles, hitCornerHandle } from '../../interactions/gestures/resize/cornerHandles';
import { rotationHandle, hitRotationHandle } from '../../interactions/gestures/rotate/handle';
import type { MoveAdapter } from '../../core/adapters/types';
import type { ResizeAdapter } from '../../core/adapters/types';
import type { RotateAdapter } from '../../core/adapters/types';
import type { AreaSelectAdapter } from '../../core/adapters/types';
import type { ResizeAnchor } from '../../interactions/gestures/types';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';
import type { DebugSink } from '../../debug/types';
import type { RenderLayer } from '../../core/layers/render';
import { viewToTransform } from '../../features/viewport/view';
import { worldToScreen } from '../../features/viewport/viewTransform';
import { pickTopMostHit } from './pickTopMostHit';

/** World-space bounding rect for hit-testing handles. Uses `width`/`height` to
 *  match `cornerResizeHandles` and `rotationHandle` expectations. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AreaSelectOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

export interface MoveOverlayStyle {
  ghostAlpha?: number;
}

export interface ResizeOverlayStyle {
  ghostAlpha?: number;
}

export interface RotateOverlayStyle {
  ghostAlpha?: number;
}

export interface UseSelectToolOptions<TObject extends { id: string }, TPose> {
  /** Return ids of all objects whose painted body covers (worldX, worldY).
   *  Order doesn't matter — the tool collapses parent/child overlap via
   *  `pickTopMostHit`. */
  pickEvery: (worldX: number, worldY: number) => string[];
  /** Optional alt-aware selection-update hit returning the single id the
   *  click should act on. When set, `pointer.onDown` routes the body-hit
   *  branch through this instead of `pickTopMostHit(pickEvery(...))` — used by
   *  nested-group consumers to resolve clicks to the outermost ancestor by
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
  /** Return the world-space bounds of `id`, or null if not found. */
  boundsOf: (id: string) => Bounds | null;
  /** Square hit-radius for corner resize handles. Default: 8. */
  handleHitRadius?: number;
  /** Distance from top edge of bounds to rotation handle center. Default: 24. */
  rotationHandleDistance?: number;
  move?: UseMoveOptions<TPose>;
  resize?: UseResizeOptions<TPose>;
  rotate?: UseRotateOptions<TPose>;
  areaSelect?: UseAreaSelectOptions;
  /** Optional debug sink. When supplied, records corner-handle and
   *  rotation-handle hitboxes at the same sites as the hit checks (so the
   *  overlay shows what the select tool actually evaluates). Tree-shakes
   *  via optional-chain when omitted. */
  debug?: DebugSink;
  /** Style for the area-select marquee. */
  areaSelectOverlayStyle?: AreaSelectOverlayStyle;
  /** Style for the move ghost (currently just `ghostAlpha`). */
  moveOverlayStyle?: MoveOverlayStyle;
  /** Style for the resize ghost. Falls back to `moveOverlayStyle.ghostAlpha`
   *  if unset, then to a default of 0.85. */
  resizeOverlayStyle?: ResizeOverlayStyle;
  /** Style for the rotate ghost. Same fallback chain as `resizeOverlayStyle`. */
  rotateOverlayStyle?: RotateOverlayStyle;
  /** Consumer's draw function for ghost objects (move/resize/rotate in-flight).
   *  Same signature as the scene slot's `drawOne`. If omitted, ghosts are not
   *  rendered (only the marquee draws). Optional only because some demos
   *  (e.g. NestedGroupsDemo) compose ghosts via custom layers. */
  drawGhost?: (
    ctx: CanvasRenderingContext2D,
    obj: TObject | null,
    pose: TPose,
    view: { x: number; y: number; scale: number },
  ) => void;
  /** Object lookup for the ghost render, paired with `drawGhost`. Optional. */
  getObject?: (id: string) => TObject | null;
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

/** Intersection of all four sub-controller adapter interfaces.
 *  The narrow adapters share compatible `getObject`/`getPose`/`setPose`/`applyBatch`
 *  shapes; `AreaSelectAdapter` adds `hitTestArea`/`applyOps`/`setSelection`/`getSelection`.
 *  No conflicting overloads — intersection is safe. */
type SelectAdapter<TObject extends { id: string }, TPose> =
  MoveAdapter<TObject, TPose>
  & ResizeAdapter<TObject, TPose>
  & RotateAdapter<TObject, TPose>
  & AreaSelectAdapter;

export type SelectScratch =
  | { kind: 'idle' }
  | { kind: 'move'; ids: string[] }
  | { kind: 'resize'; targetId: string; anchor: ResizeAnchor }
  | { kind: 'rotate'; targetId: string }
  | { kind: 'area' };

/** Active-slot Tool wrapping `useMove`/`useResize`/`useRotate`/`useAreaSelect`.
 *
 *  Hit-test priority on pointer-down (single selection only for handles):
 *  1. Rotation handle
 *  2. Corner resize handles
 *  3. Body hit → move + immediate selection
 *  4. Empty → area-select marquee
 *
 *  `scratch` routes `drag.*` to the matching controller. */
export function useSelectTool<TObject extends { id: string }, TPose>(
  adapter: SelectAdapter<TObject, TPose>,
  options: UseSelectToolOptions<TObject, TPose>,
): Tool<SelectScratch> {
  const move = useMove<TObject, TPose>(adapter, options.move ?? {});
  const resize = useResize<TObject, TPose>(adapter, options.resize ?? {});
  const rotate = useRotate<TObject, TPose>(adapter, options.rotate ?? {});
  // Default to selectFromMarquee so plain `useSelectTool(adapter, {...})` —
  // with no explicit areaSelect.behaviors — actually updates the selection
  // when the user drags an empty-space marquee. Consumers that pass their own
  // `areaSelect.behaviors` opt out (override wins).
  const areaSelectOptions = useMemo<UseAreaSelectOptions>(() => {
    const provided = options.areaSelect;
    if (provided?.behaviors) return provided;
    return { ...(provided ?? {}), behaviors: [selectFromMarquee()] };
  }, [options.areaSelect]);
  const areaSelect = useAreaSelect(adapter, areaSelectOptions);

  const handleHitRadius = options.handleHitRadius ?? 8;
  const rotationHandleDistance = options.rotationHandleDistance ?? 24;
  const debug = options.debug;

  // Latest-callback ref for `onDoubleTap` so the memoized tool body picks up
  // re-renders without rebuilding the Tool record. Same pattern as `styleRefs`.
  const onDoubleTapRef = useRef(options.onDoubleTap);
  onDoubleTapRef.current = options.onDoubleTap;
  const pickEveryRef = useRef(options.pickEvery);
  pickEveryRef.current = options.pickEvery;

  // Refs let the overlay closure pull the latest style/callbacks without
  // rebuilding the Tool record on every render.
  const styleRefs = useRef({
    areaSelectOverlayStyle: options.areaSelectOverlayStyle,
    moveOverlayStyle: options.moveOverlayStyle,
    resizeOverlayStyle: options.resizeOverlayStyle,
    rotateOverlayStyle: options.rotateOverlayStyle,
    drawGhost: options.drawGhost,
    getObject: options.getObject,
  });
  styleRefs.current = {
    areaSelectOverlayStyle: options.areaSelectOverlayStyle,
    moveOverlayStyle: options.moveOverlayStyle,
    resizeOverlayStyle: options.resizeOverlayStyle,
    rotateOverlayStyle: options.rotateOverlayStyle,
    drawGhost: options.drawGhost,
    getObject: options.getObject,
  };

  // The layer is `space: 'screen'` — `runLayers` does not pre-apply the world
  // transform. The marquee branch already lives in screen coords (via
  // `worldToScreen`). Ghost branches reapply the world transform manually so
  // the consumer's `drawGhost` (same signature as scene `drawOne`) sees the
  // expected world-space ctx. Mixing the two paths in one layer keeps the
  // select tool's overlay output as a single `RenderLayer`.
  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'select-overlay',
      label: 'Select overlay',
      space: 'screen',
      draw: (ctx, _data, view) => {
        const refs = styleRefs.current;

        // 1. Area-select marquee.
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
          const sw = w * view.scale;
          const sh = h * view.scale;
          ctx.save();
          ctx.fillStyle = fill;
          ctx.fillRect(sx, sy, sw, sh);
          ctx.strokeStyle = stroke;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash(dash);
          ctx.strokeRect(sx, sy, sw, sh);
          ctx.setLineDash([]);
          ctx.restore();
          return;
        }

        const drawGhost = refs.drawGhost;
        const getObject = refs.getObject;
        if (!drawGhost || !getObject) return;

        const moveAlpha = refs.moveOverlayStyle?.ghostAlpha ?? 0.85;
        const resizeAlpha = refs.resizeOverlayStyle?.ghostAlpha ?? moveAlpha;
        const rotateAlpha = refs.rotateOverlayStyle?.ghostAlpha ?? moveAlpha;

        // Apply world transform once for any ghost branch — matches the
        // `space: 'world'` composition that `runLayers` would do.
        const applyWorld = () => {
          if (view.scale !== 1) ctx.scale(view.scale, view.scale);
          if (view.x !== 0 || view.y !== 0) ctx.translate(-view.x, -view.y);
        };

        // 2. Move ghost — walk the overlay's poses.
        const mOv = move.overlay;
        if (mOv) {
          ctx.save();
          ctx.globalAlpha = moveAlpha;
          applyWorld();
          for (const [id, pose] of mOv.poses) {
            drawGhost(ctx, getObject(id), pose, view);
          }
          ctx.restore();
          return;
        }

        // 3. Resize ghost — single object at currentPose.
        const rOv = resize.overlay;
        if (rOv) {
          ctx.save();
          ctx.globalAlpha = resizeAlpha;
          applyWorld();
          drawGhost(ctx, getObject(rOv.id), rOv.currentPose, view);
          ctx.restore();
          return;
        }

        // 4. Rotate ghost — single object at currentPose.
        const rotOv = rotate.overlay;
        if (rotOv) {
          ctx.save();
          ctx.globalAlpha = rotateAlpha;
          applyWorld();
          drawGhost(ctx, getObject(rotOv.id), rotOv.currentPose, view);
          ctx.restore();
          return;
        }
      },
    }),
    [move, resize, rotate, areaSelect],
  );

  // peekPose: aggregate in-flight overlay poses across move/resize/rotate so
  // Canvas.helpersRef.getEffectivePose can stay overlay-aware without reaching
  // into hook internals. Mirrors the fall-through order in Canvas.tsx's
  // effectivePoseOf — move first (covers multi-id drags), then resize
  // (incl. leaf poses), then rotate.
  const peekPose = (id: string): TPose | null => {
    const mOv = move.overlay;
    if (mOv) {
      const p = mOv.poses.get(id);
      if (p !== undefined) return p as TPose;
    }
    const rOv = resize.overlay;
    if (rOv) {
      if (rOv.id === id) return rOv.currentPose as TPose;
      const leaf = rOv.leafPoses?.get(id);
      if (leaf !== undefined) return leaf as TPose;
    }
    const rotOv = rotate.overlay;
    if (rotOv && rotOv.id === id) return rotOv.currentPose as TPose;
    return null;
  };

  // peekHide: surface move's hideIds (dragged + cascade descendants) so the
  // standard scene slot suppresses their committed render during a cascade
  // drag. Resize/rotate don't hide ids — the dragged target's overlay pose
  // simply replaces its committed pose via peekPose.
  const peekHide = (): Iterable<string> | null => move.overlay?.hideIds ?? null;

  return useMemo(
    () =>
      defineTool<SelectScratch>({
        id: 'select',
        keybinding: 'V',
        cursor: 'default',
        overlay,
        peekPose,
        peekHide,
        initScratch: () => ({ kind: 'idle' }),

        pointer: {
          onDown: (_e, ctx) => {
            const sel = ctx.selection.current;
            // handleHitRadius is screen-px; convert to world by dividing by
            // current view scale so the hit area matches the rendered handle
            // size under zoom.
            const radiusWorld = handleHitRadius / ctx.view.scale;

            // 1. Rotation handle (single selection only)
            if (sel.length === 1) {
              const b = options.boundsOf(sel[0]);
              if (b) {
                const handle = rotationHandle(b, rotationHandleDistance);
                (ctx.debug ?? debug)?.recordHitbox(sel[0], 'rotation', {
                  kind: 'circle', cx: handle.cx, cy: handle.cy, r: radiusWorld,
                });
                if (hitRotationHandle(handle, ctx.worldX, ctx.worldY, radiusWorld)) {
                  ctx.scratch = { kind: 'rotate', targetId: sel[0] };
                  return 'claim';
                }
              }
            }

            // 2. Corner resize handles (single selection only)
            if (sel.length === 1) {
              const b = options.boundsOf(sel[0]);
              if (b) {
                for (const h of cornerResizeHandles(b)) {
                  (ctx.debug ?? debug)?.recordHitbox(sel[0], 'handle', {
                    kind: 'circle', cx: h.cx, cy: h.cy, r: radiusWorld,
                  });
                  if (hitCornerHandle(h, ctx.worldX, ctx.worldY, radiusWorld)) {
                    ctx.scratch = { kind: 'resize', targetId: sel[0], anchor: h.anchor };
                    return 'claim';
                  }
                }
              }
            }

            // 3. Body hit → move (+ select)
            const top = options.pickBest
              ? options.pickBest(ctx.worldX, ctx.worldY, ctx.modifiers.alt, sel)
              : (() => {
                  const ids = options.pickEvery(ctx.worldX, ctx.worldY);
                  if (ids.length === 0) return null;
                  // pickTopMostHit collapses parent/child overlap (container's
                  // bounds also cover the child) and falls back to "last id" for
                  // pure sibling hits — matches the bottom-first iteration order
                  // most demos produce. Demos that already z-sort with topmost
                  // first should return a single-id array; this helper is a
                  // no-op in that case.
                  return pickTopMostHit(ids, adapter) ?? ids[0];
                })();
            if (top !== null) {
              // Capture pre-click selection so we can decide whether the drag
              // moves the existing set or just the freshly-clicked object.
              // `ctx.selection.current` is the React snapshot from the
              // dispatcher's render — it does not reflect mutations made by
              // applyClick during this same callback.
              const preClick = sel;
              const hitAlreadySelected = preClick.includes(top);
              ctx.selection.applyClick(top, ctx.modifiers);
              // If the user clicked something already selected, drag the whole
              // selection. Otherwise the click switches selection and the drag
              // moves only the clicked object — matches Figma/Sketch behavior
              // ("dragging an unselected object shouldn't move the old one").
              const moveIds = hitAlreadySelected && preClick.length > 0 ? preClick : [top];
              ctx.scratch = { kind: 'move', ids: moveIds };
              return 'claim';
            }

            // 4. Empty → defer clear to onClick (sub-threshold release).
            //    Clearing on down feels twitchy: an accidental tap on empty
            //    space wipes selection mid-thought. The marquee path
            //    (drag.onStart → areaSelect) overwrites selection on its
            //    own end; the click path (no drag) handles clear in
            //    pointer.onClick below. Shift/meta are extend modifiers and
            //    never clear.
            ctx.scratch = { kind: 'area' };
            return 'claim';
          },

          onClick: (_e, ctx) => {
            // Sub-threshold release: only the empty-hit (`area`) path needs
            // commit-time work. Body/handle clicks already mutated selection
            // in onDown via applyClick, so a sub-threshold release on them
            // is a no-op here.
            if (ctx.scratch.kind === 'area' && !ctx.modifiers.shift && !ctx.modifiers.meta) {
              ctx.selection.clear();
            }
            return 'claim';
          },
        },

        dblTap: {
          onTap: (e, ctx) => {
            const cb = onDoubleTapRef.current;
            if (!cb) return 'pass';
            const ids = pickEveryRef.current(ctx.worldX, ctx.worldY);
            cb({ worldX: ctx.worldX, worldY: ctx.worldY, ids, event: e });
            return 'claim';
          },
        },

        drag: {
          onStart: (e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move':
                move.start({ ids: s.ids, worldX: ctx.worldX, worldY: ctx.worldY, clientX: e.clientX, clientY: e.clientY });
                return 'claim';
              case 'resize':
                resize.start(s.targetId, s.anchor, ctx.worldX, ctx.worldY);
                return 'claim';
              case 'rotate':
                rotate.start({ id: s.targetId, worldX: ctx.worldX, worldY: ctx.worldY });
                return 'claim';
              case 'area':
                areaSelect.start(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              default:
                return 'pass';
            }
          },

          onMove: (e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move':
                move.move({ worldX: ctx.worldX, worldY: ctx.worldY, clientX: e.clientX, clientY: e.clientY, modifiers: ctx.modifiers });
                return 'claim';
              case 'resize':
                resize.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              case 'rotate':
                rotate.move({ worldX: ctx.worldX, worldY: ctx.worldY, modifiers: ctx.modifiers });
                return 'claim';
              case 'area':
                areaSelect.move(ctx.worldX, ctx.worldY, ctx.modifiers);
                return 'claim';
              default:
                return 'pass';
            }
          },

          onEnd: (_e, ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move': move.end(); return 'claim';
              case 'resize': resize.end(); return 'claim';
              case 'rotate': rotate.end(); return 'claim';
              case 'area': areaSelect.end(); return 'claim';
              default: return 'pass';
            }
          },

          onCancel: (ctx) => {
            const s = ctx.scratch;
            switch (s.kind) {
              case 'move': move.cancel(); break;
              case 'resize': resize.cancel(); break;
              case 'rotate': rotate.cancel(); break;
              case 'area': areaSelect.cancel(); break;
            }
          },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [move, resize, rotate, areaSelect, overlay, options.pickEvery, options.pickBest, options.boundsOf, handleHitRadius, rotationHandleDistance, debug],
  );
}
