/**
 * Dispatcher overlay render layer for `<SceneCanvas>` — Phase 14e.2.5.
 *
 * Walks the dispatcher's in-flight `OngoingHandle`s, calls each handle's
 * optional `overlay()` method, and paints the returned shape as chrome.
 *
 * Distinct from `usePreviewGhostLayer`, which paints displaced scene-node
 * silhouettes via `previewIds()` / `previewPose(id)`. The dispatcher
 * overlay layer is for gestures whose visual feedback isn't a moved scene
 * node — marquee rect (area-select), polyline + dashed close-line (lasso),
 * and any future overlay-only chrome an action wants to render.
 *
 * Replaces the per-tool `select-overlay` rendering for the same gestures
 * once the dispatcher path is the sole driver (Phase 14e Task 3). Until
 * then both run side-by-side; the visuals overlap exactly so the
 * user-visible result is identical.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import type { DrawCommand, PathDrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import { polygonFromPoints } from 'features/paths/builder';

/** Style knobs for the dispatcher-overlay layer's marquee + lasso paints.
 *  Defaults match the legacy `useSelectTool` `areaSelectOverlayStyle`
 *  defaults so the visual swap is invisible to users. */
export interface DispatcherOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
}

const DEFAULT_STYLE: Required<DispatcherOverlayStyle> = {
  fill: 'rgba(164, 139, 212, 0.18)',
  stroke: '#a48bd4',
  dash: [3, 3],
  lineWidth: 1,
};

export function useDispatcherOverlayLayer(args: {
  dispatcher: Dispatcher | null | undefined;
  style?: DispatcherOverlayStyle;
}): RenderLayer<unknown> {
  const { dispatcher, style } = args;

  const dispatcherRef = useRef(dispatcher);
  dispatcherRef.current = dispatcher;
  const styleRef = useRef(style);
  styleRef.current = style;

  // Re-render on every dispatcher pump so live overlay (marquee, lasso
  // polyline) tracks pointermove instead of freezing on the first frame.
  const [, forceRerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!dispatcher) return;
    return dispatcher.subscribe(forceRerender);
  }, [dispatcher]);

  return useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'dispatcher-overlay',
      label: 'Dispatcher overlay',
      space: 'screen',
      draw: (_data, view) => {
        const disp = dispatcherRef.current;
        if (!disp) return [];
        const cfg = { ...DEFAULT_STYLE, ...(styleRef.current ?? {}) };
        const t = viewToTransform(view);
        const out: DrawCommand[] = [];

        for (const handle of disp.getInFlightHandles()) {
          const ov = handle.overlay?.();
          if (!ov) continue;

          if (ov.kind === 'marquee') {
            // Normalize start/current → AABB, project to screen coords.
            const wx = Math.min(ov.start.x, ov.current.x);
            const wy = Math.min(ov.start.y, ov.current.y);
            const ww = Math.abs(ov.current.x - ov.start.x);
            const wh = Math.abs(ov.current.y - ov.start.y);
            const [sx, sy] = worldToScreen(wx, wy, t);
            const sw = ww * view.scale.x;
            const sh = wh * view.scale.y;
            // Skip zero-size marquees (pointerdown before first move) —
            // matches legacy `useDragRect` overlay-emits-zero-size but the
            // GL renderer would still issue a degenerate path call.
            if (sw === 0 && sh === 0) continue;
            const cmd: PathDrawCommand = {
              kind: 'path',
              path: { kind: 'rect', x: sx, y: sy, width: sw, height: sh },
              fill: { color: cfg.fill },
              stroke: { paint: { color: cfg.stroke }, width: cfg.lineWidth, dash: cfg.dash },
            };
            out.push(cmd);
            continue;
          }

          if (ov.kind === 'lasso') {
            // Project every vertex to screen coords; build a single polygon
            // path. The polygon already closes (polygonFromPoints adds Z),
            // which renders as the dashed "close-line" implicit in the
            // legacy hook's visual. Fill paints the would-be selection
            // region; stroke paints the polyline + close-line.
            if (ov.vertices.length < 2) continue;
            const screenPts: { x: number; y: number }[] = [];
            for (const v of ov.vertices) {
              const [sx, sy] = worldToScreen(v.x, v.y, t);
              screenPts.push({ x: sx, y: sy });
            }
            const cmd: PathDrawCommand = {
              kind: 'path',
              path: polygonFromPoints(screenPts),
              fill: { color: cfg.fill },
              stroke: { paint: { color: cfg.stroke }, width: cfg.lineWidth, dash: cfg.dash },
            };
            out.push(cmd);
            continue;
          }
        }

        if (out.length === 0) return [];
        // Screen-space layer: emit commands directly. The worldToScreen
        // projection above has already mapped every coord into CSS pixels.
        return out;
      },
    }),
    [],
  );
}
