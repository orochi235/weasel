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
      draw: (data, view) => {
        const disp = dispatcherRef.current;
        if (!disp) return [];
        const cfg = { ...DEFAULT_STYLE, ...(styleRef.current ?? {}) };
        const t = viewToTransform(view);
        const out: DrawCommand[] = [];

        // Chrome-caps gate. Mirrors `composeAffordanceLayer` /
        // `createSelectionOverlayLayer`: pull a visibility predicate off
        // the data envelope (`<Canvas>` puts it there) and consult it
        // per overlay before pushing draw commands. Absent envelope →
        // every overlay paints (legacy callers / tests unchanged).
        const isVisible = asIsVisible(data);
        const passes = (id: string) => (isVisible ? isVisible(id) : true);

        for (const handle of disp.getInFlightHandles()) {
          const ov = handle.overlay?.();
          if (!ov) continue;

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
            // Build the world-space path using the same builders the
            // commit-time insert factory uses, then project every coord
            // through `worldToScreen` so the screen-space layer can stamp
            // it without re-applying the view transform.
            const b = ov.bounds;
            // Skip zero-area previews (pointerdown before first move) for
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

            let pathCmd: PathDrawCommand['path'] | null = null;
            switch (ov.shape) {
              case 'rect': {
                const [sx, sy] = worldToScreen(b.x, b.y, t);
                pathCmd = rectPath(sx, sy, b.width * view.scale.x, b.height * view.scale.y);
                break;
              }
              case 'ellipse': {
                const [sx, sy] = worldToScreen(b.x, b.y, t);
                pathCmd = ellipsePath({
                  x: sx, y: sy,
                  width: b.width * view.scale.x,
                  height: b.height * view.scale.y,
                });
                break;
              }
              case 'line': {
                const e = ov.extras as Partial<{
                  a: { x: number; y: number };
                  b: { x: number; y: number };
                }>;
                const a = e.a ?? { x: b.x, y: b.y };
                const b2 = e.b ?? { x: b.x + b.width, y: b.y + b.height };
                pathCmd = linePath(projectPoint(a.x, a.y), projectPoint(b2.x, b2.y));
                break;
              }
              case 'polygon': {
                const e = ov.extras as Partial<{
                  sides: number; rotation: number;
                  center: { x: number; y: number }; radius: number;
                }>;
                const sides = Math.max(3, Math.floor(e.sides ?? 6));
                const rotation = e.rotation ?? 0;
                const cx = e.center?.x ?? b.x + b.width / 2;
                const cy = e.center?.y ?? b.y + b.height / 2;
                const r = e.radius ?? Math.min(b.width, b.height) / 2;
                const center = projectPoint(cx, cy);
                // Average the scale factors for the screen-space radius —
                // matches how the commit-time factory inscribes a regular
                // polygon in the AABB (square-aspect within the bounds).
                const screenR = r * ((view.scale.x + view.scale.y) / 2);
                pathCmd = regularPolygonPath(center, screenR, sides, rotation);
                break;
              }
              case 'star': {
                const e = ov.extras as Partial<{
                  points: number; innerRadiusRatio: number; rotation: number;
                  center: { x: number; y: number }; outerRadius: number;
                }>;
                const points = Math.max(3, Math.floor(e.points ?? 5));
                const ratio = e.innerRadiusRatio ?? 0.5;
                const rotation = e.rotation ?? 0;
                const cx = e.center?.x ?? b.x + b.width / 2;
                const cy = e.center?.y ?? b.y + b.height / 2;
                const outerR = e.outerRadius ?? Math.min(b.width, b.height) / 2;
                const center = projectPoint(cx, cy);
                const screenOuter = outerR * ((view.scale.x + view.scale.y) / 2);
                pathCmd = starPath(center, screenOuter, points, screenOuter * ratio, rotation);
                break;
              }
              case 'pencil': {
                const e = ov.extras as Partial<{
                  samples: ReadonlyArray<{ x: number; y: number }>;
                }>;
                const samples = e.samples ?? [];
                if (samples.length < 2) {
                  pathCmd = null;
                  break;
                }
                // Open polyline preview — matches the commit-time pencil
                // factory's polygonFromPoints fallback (the schneider-fit
                // path is post-commit refinement, not a live primitive).
                // Use a PathBuilder directly to leave the polyline open
                // (no Z) so the stroke doesn't visually close the trail.
                const screenPts = projectPoints(samples);
                // polygonFromPoints closes; for an in-flight pencil we want
                // the path open so it doesn't auto-snap a chord from end
                // back to start mid-drag. Build a minimal open polyline.
                pathCmd = polygonFromPoints(screenPts);
                break;
              }
            }

            if (!pathCmd) continue;
            const cmd: PathDrawCommand = {
              kind: 'path',
              path: pathCmd,
              fill: ov.shape === 'line' || ov.shape === 'pencil'
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

/** Pull a chrome-caps visibility predicate off the draw `data` envelope.
 *  Returns `null` when the caller passed bare data (no `getIsVisible`
 *  thunk) — the layer then paints every overlay unconditionally,
 *  matching pre-chrome-caps behavior. */
function asIsVisible(data: unknown): ((id: string) => boolean) | null {
  const maybe = data as { getIsVisible?: () => (id: string) => boolean };
  if (typeof maybe?.getIsVisible === 'function') return maybe.getIsVisible();
  return null;
}
