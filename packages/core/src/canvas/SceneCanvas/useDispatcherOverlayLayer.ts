/**
 * Dispatcher overlay render layer for `<SceneCanvas>`.
 *
 * Paints the overlay shapes the drawing view's in-flight handles publish,
 * taken off the draw envelope so a panel shows its own gesture rather than
 * the surface's. `resolveOverlays` does the reading; everything here is
 * painting.
 *
 * Distinct from `usePreviewGhostLayer`, which paints displaced scene-node
 * silhouettes. This layer is for gestures whose visual feedback isn't a moved
 * scene node — a marquee rect, a lasso polyline, an insert preview, a brush.
 */
import { useEffect, useMemo, useReducer } from 'react';
import { useLatest } from '@weasel-js/react';
import type { DrawCommand, PathDrawCommand } from '@weasel-js/renderer';
import type { CommandStroke } from '@weasel-js/paint';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { Dispatcher } from '@weasel-js/routing';
import { polygonFromPoints, polylineFromPoints } from '@weasel-js/geom';
import { resolveOverlays } from 'interactions/actions/resolveOverlays';
import { gestureOverlaysFrom, isVisibleFrom } from '../drawEnvelope';
import { insertPreviewCommands } from './insertPreviewCommands';
import { OVERLAY_ROLE_STROKES } from '../overlayRoleStrokes';
import { brushOverlayCommands } from './brushOverlay';

/** Style knobs for the dispatcher-overlay layer's marquee + lasso paints. */
export interface DispatcherOverlayStyle {
  fill?: string;
  stroke?: string;
  dash?: number[];
  lineWidth?: number;
  /** Stroke per `polyline` overlay role, merged over the kit's. A role with
   *  no entry here and none of the kit's paints as plain chrome — the
   *  `stroke` / `lineWidth` / `dash` above. */
  roles?: Readonly<Record<string, CommandStroke>>;
}

const DEFAULT_STYLE: Required<Omit<DispatcherOverlayStyle, 'roles'>> = {
  fill: 'rgba(164, 139, 212, 0.18)',
  stroke: '#a48bd4',
  dash: [3, 3],
  lineWidth: 1,
};



function onScreen(
  points: ReadonlyArray<{ x: number; y: number }>,
  t: ReturnType<typeof viewToTransform>,
): { x: number; y: number }[] {
  return points.map((p) => {
    const [sx, sy] = worldToScreen(p.x, p.y, t);
    return { x: sx, y: sy };
  });
}

export function useDispatcherOverlayLayer(args: {
  /** The surface's dispatcher, subscribed to only so a pump repaints. What
   *  gets painted is the drawing view's own `getGestureOverlays()`. */
  dispatcher: Dispatcher | null | undefined;
  style?: DispatcherOverlayStyle;
}): RenderLayer<unknown> {
  const { dispatcher, style } = args;

  const styleRef = useLatest(style);

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
      draw: (data, view) => {
        const cfg = { ...DEFAULT_STYLE, ...(styleRef.current ?? {}) };
        // Merged rather than replaced: naming one role must not delete the
        // kit's others.
        const roles = { ...OVERLAY_ROLE_STROKES, ...(styleRef.current?.roles ?? {}) };
        const t = viewToTransform(view);
        const out: DrawCommand[] = [];

        // Chrome-caps gate. Absent envelope → every overlay paints. This stays
        // on the painting side: the predicate is a property of the view's
        // envelope, and two views of one surface may answer differently for
        // the same in-flight gesture.
        const isVisible = isVisibleFrom(data);
        const passes = (id: string) => (isVisible ? isVisible(id) : true);

        for (const ov of resolveOverlays(gestureOverlaysFrom(data))) {
          if (!passes(ov.visibilityId)) continue;

          if (ov.kind === 'marquee') {
            const b = ov.bounds;
            const [sx, sy] = worldToScreen(b.x, b.y, t);
            const sw = b.width * view.scale.x;
            const sh = b.height * view.scale.y;
            const cmd: PathDrawCommand = {
              kind: 'path',
              path: { kind: 'rect', x: sx, y: sy, width: sw, height: sh },
              fill: { paint: { color: cfg.fill } },
              stroke: { paint: { color: cfg.stroke }, width: cfg.lineWidth, dash: cfg.dash },
            };
            out.push(cmd);
            continue;
          }

          if (ov.kind === 'insertPreview') {
            for (const cmd of insertPreviewCommands(ov, view, cfg)) out.push(cmd);
            continue;
          }

          if (ov.kind === 'lasso') {
            // `polygonFromPoints` closes the path, which draws the dashed
            // close-line back to the first vertex.
            const screenPts: { x: number; y: number }[] = [];
            for (const v of ov.vertices) {
              const [sx, sy] = worldToScreen(v.x, v.y, t);
              screenPts.push({ x: sx, y: sy });
            }
            const cmd: PathDrawCommand = {
              kind: 'path',
              path: polygonFromPoints(screenPts),
              fill: { paint: { color: cfg.fill } },
              stroke: { paint: { color: cfg.stroke }, width: cfg.lineWidth, dash: cfg.dash },
            };
            out.push(cmd);
            continue;
          }

          if (ov.kind === 'polyline') {
            const stroke =
              roles[ov.role] ??
              { paint: { color: cfg.stroke }, width: cfg.lineWidth, dash: cfg.dash };
            out.push({ kind: 'path', path: polylineFromPoints(onScreen(ov.points, t)), stroke });
            continue;
          }

          if (ov.kind === 'brush') {
            out.push(...brushOverlayCommands(onScreen(ov.points, t), ov.radiusPx, cfg));
            continue;
          }
        }

        if (out.length === 0) return [];
        return out;
      },
    }),
    [styleRef],
  );
}
