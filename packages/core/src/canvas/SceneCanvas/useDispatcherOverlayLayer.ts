/**
 * Dispatcher overlay render layer for `<SceneCanvas>`.
 *
 * Paints the overlay shapes the drawing view's in-flight handles publish,
 * taken off the draw envelope so a panel shows its own gesture rather than
 * the surface's.
 *
 * Distinct from `usePreviewGhostLayer`, which paints displaced scene-node
 * silhouettes via `previewIds()` / `previewPose(id)`. The dispatcher
 * overlay layer is for gestures whose visual feedback isn't a moved scene
 * node — marquee rect (area-select), polyline + dashed close-line (lasso),
 * and any future overlay-only chrome an action wants to render.
 *
 * Replaces the per-tool `select-overlay` rendering for the same gestures
 * once the dispatcher path is the sole driver. Until
 * then both run side-by-side; the visuals overlap exactly so the
 * user-visible result is identical.
 */
import { useEffect, useMemo, useReducer, useRef } from 'react';
import { viewToMat3, type DrawCommand, type PathDrawCommand } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { Dispatcher } from 'interactions/dispatcher/dispatcher';
import {
  polygonFromPoints,
  rectPath,
  ellipsePath,
  linePath,
  regularPolygonPath,
  starPath,
} from 'features/paths/builder';
import { getImageBitmap } from 'features/images/imageCache';
import { insertPreviewExtent } from '../insertPreviewExtent';
import { gestureOverlaysFrom, isVisibleFrom } from '../drawEnvelope';

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

/** Alpha for content previewed inside an in-flight gesture. Matches the
 *  preview-ghost layer, so a dragged node and an uncommitted insert read as
 *  equally provisional. */
const PREVIEW_CONTENT_OPACITY = 0.85;

export function useDispatcherOverlayLayer(args: {
  /** The surface's dispatcher, subscribed to only so a pump repaints. What
   *  gets painted is the drawing view's own `getGestureOverlays()`. */
  dispatcher: Dispatcher | null | undefined;
  style?: DispatcherOverlayStyle;
}): RenderLayer<unknown> {
  const { dispatcher, style } = args;

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
      draw: (data, view) => {
        const cfg = { ...DEFAULT_STYLE, ...(styleRef.current ?? {}) };
        const t = viewToTransform(view);
        const out: DrawCommand[] = [];

        // Chrome-caps gate. Mirrors `composeAffordanceLayer` /
        // `createSelectionOverlayLayer`: pull a visibility predicate off
        // the data envelope and consult it per overlay before pushing draw
        // commands. Absent envelope → every overlay paints.
        const isVisible = isVisibleFrom(data);
        const passes = (id: string) => (isVisible ? isVisible(id) : true);

        for (const ov of gestureOverlaysFrom(data)) {
          if (ov.kind === 'marquee') {
            if (!passes('action.marquee')) continue;
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

          if (ov.kind === 'insertPreview') {
            if (!passes('action.insert-preview')) continue;
            // Size the preview through `insertPreviewExtent` — the same
            // resolution the commit factory and the gesture-bounds reporter
            // use, so all three agree on the nascent shape's extent.
            const extent = insertPreviewExtent(ov);
            const b = extent.bounds;
            // Skip zero-area previews (pointerdown before the first move) for
            // non-pencil shapes; pencil can be meaningful even at near-zero
            // AABB (closed-loop / sub-threshold gestures — see insertAction).
            if (b.width === 0 && b.height === 0 && ov.shape !== 'pencil') continue;

            const projectPoint = (wx: number, wy: number): { x: number; y: number } => {
              const [sx, sy] = worldToScreen(wx, wy, t);
              return { x: sx, y: sy };
            };
            const projectPoints = (
              pts: ReadonlyArray<{ x: number; y: number }>,
            ): { x: number; y: number }[] => pts.map((p) => projectPoint(p.x, p.y));
            // Radial shapes inscribe in a square, so a single screen-space
            // radius needs one scale factor; average the axes.
            const radialScale = (view.scale.x + view.scale.y) / 2;

            let pathCmd: PathDrawCommand['path'] | null = null;
            const geom = extent.geometry;
            switch (geom.kind) {
              case 'box': {
                const [sx, sy] = worldToScreen(b.x, b.y, t);
                const sw = b.width * view.scale.x;
                const sh = b.height * view.scale.y;
                if (ov.shape === 'image') {
                  const e = ov.extras as Partial<{ src: string; preview: string }>;
                  // The bitmap when it has decoded, the bare outline until then
                  // (or when the tool opted out) — the outline is drawn either
                  // way, so the drag always has an edge to read.
                  const bmp = e.preview === 'outline' || !e.src
                    ? undefined
                    : getImageBitmap(e.src);
                  if (bmp) {
                    out.push({
                      kind: 'image',
                      image: bmp,
                      x: sx, y: sy, w: sw, h: sh,
                      opacity: PREVIEW_CONTENT_OPACITY,
                    });
                  }
                }
                pathCmd = ov.shape === 'ellipse'
                  ? ellipsePath({ x: sx, y: sy, width: sw, height: sh })
                  : rectPath(sx, sy, sw, sh);
                break;
              }
              case 'line':
                pathCmd = linePath(projectPoint(geom.a.x, geom.a.y), projectPoint(geom.b.x, geom.b.y));
                break;
              case 'polygon':
                pathCmd = regularPolygonPath(
                  projectPoint(geom.center.x, geom.center.y),
                  geom.radius * radialScale,
                  geom.sides,
                  geom.rotation,
                );
                break;
              case 'star':
                pathCmd = starPath(
                  projectPoint(geom.center.x, geom.center.y),
                  geom.outerRadius * radialScale,
                  geom.points,
                  geom.innerRadius * radialScale,
                  geom.rotation,
                );
                break;
              case 'pencil': {
                // Open polyline preview — matches the commit-time pencil
                // factory's polygonFromPoints fallback (the schneider-fit
                // path is post-commit refinement, not a live primitive).
                if (geom.samples.length < 2) break;
                pathCmd = polygonFromPoints(projectPoints(geom.samples));
                break;
              }
            }

            if (!pathCmd) continue;
            const cmd: PathDrawCommand = {
              kind: 'path',
              path: pathCmd,
              fill: ov.shape === 'line' || ov.shape === 'pencil' || ov.shape === 'image'
                ? undefined
                : { color: cfg.fill },
              stroke: { paint: { color: cfg.stroke }, width: cfg.lineWidth, dash: cfg.dash },
            };
            out.push(cmd);
            // Anchor dot at the drag's click point. Sells the anchoring
            // visually for radial shapes (polygon/star — no vertex sits
            // at the AABB corner) and for center mode (dot marks the
            // growth axis). 4 CSS-px radius, same stroke color as the
            // ghost so it reads as part of the chrome.
            if (ov.anchorPoint) {
              const anchorScreen = projectPoint(ov.anchorPoint.x, ov.anchorPoint.y);
              out.push({
                kind: 'path',
                path: ellipsePath({
                  x: anchorScreen.x - 4,
                  y: anchorScreen.y - 4,
                  width: 8,
                  height: 8,
                }),
                fill: { color: cfg.stroke },
              });
            }
            continue;
          }

          if (ov.kind === 'lasso') {
            if (!passes('action.lasso')) continue;
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

          if (ov.kind === 'commands') {
            if (!passes('action.commands')) continue;
            // Generic escape hatch — actions emit arbitrary DrawCommands.
            // World-space (default) wraps in viewToMat3 so the commands
            // track the camera; screen-space goes through untouched.
            if (ov.commands.length === 0) continue;
            const space = ov.space ?? 'world';
            if (space === 'world') {
              out.push({ kind: 'group', transform: viewToMat3(view), children: [...ov.commands] });
            } else {
              for (const cmd of ov.commands) out.push(cmd);
            }
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
