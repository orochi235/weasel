/**
 * Pure math helpers for `<MinimapCanvas>`.
 *
 * `computeFitView` derives a `View` that fits a chosen world rect into a
 * minimap canvas of given pixel dims. `computeIndicatorCommand` builds the
 * dashed "visible window" rect — the main canvas's screen window projected
 * into the minimap's own screen coordinates.
 *
 * Neither helper touches GL, the DOM, or the renderer; they're pure
 * functions, unit-testable with `expect`.
 *
 * See `docs/superpowers/specs/2026-05-31-detached-minimap-design.md`.
 */
import type { Scene } from '../core/scene';
import type { View } from '../core/viewport/view';
import type { Bounds, ViewportDims } from '../core/viewport/fitViewToBounds';
import type { PathDrawCommand } from '../renderer/DrawCommand';

/** Inset (CSS px) around the fit rect on each side. Matches the spec note. */
const DEFAULT_FIT_PADDING = 8;

/**
 * Fallback view returned when there is nothing to fit (empty scene, etc.).
 * Identity view at the origin — produces a 1:1 mapping centered on (0, 0).
 */
export const FALLBACK_FIT_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/**
 * Fit policy for `<MinimapCanvas>` / `computeFitView`.
 *
 * - `"scene"` — union of leaf-node pose AABBs (via `poseBounds`).
 * - `{ kind: "world", rect }` — caller-supplied world rect.
 * - `(scene, dims) => View` — caller derives the view directly.
 */
export type MinimapFit<TData, TLayer extends string, TPose> =
  | 'scene'
  | { kind: 'world'; rect: Bounds }
  | ((scene: Scene<TData, TLayer, TPose>, dims: ViewportDims) => View);

/** Style for the visible-window indicator rect drawn over the minimap. */
export interface IndicatorStyle {
  /** Stroke color (any CSS color). Defaults to `'#ffffff'`. */
  stroke?: string;
  /** Stroke width in CSS px. Defaults to `1`. */
  width?: number;
  /** Dash pattern in CSS px. Defaults to `[2, 3]`. */
  dash?: number[];
}

const DEFAULT_INDICATOR_STROKE = '#ffffff';
const DEFAULT_INDICATOR_WIDTH = 1;
const DEFAULT_INDICATOR_DASH: readonly number[] = [2, 3];

/** Internal: fit a world rect uniformly into dims with padding. */
function fitRectInto(rect: Bounds, dims: ViewportDims, padding: number): View {
  const availW = Math.max(1, dims.width - padding * 2);
  const availH = Math.max(1, dims.height - padding * 2);
  // Degenerate rect (zero / negative area): fall back to identity at the
  // rect's top-left so we at least center *something* sensible.
  if (rect.width <= 0 || rect.height <= 0) {
    return {
      x: rect.x - dims.width / 2,
      y: rect.y - dims.height / 2,
      scale: { x: 1, y: 1 },
    };
  }
  const sx = availW / rect.width;
  const sy = availH / rect.height;
  const s = Math.min(sx, sy);
  const worldCx = rect.x + rect.width / 2;
  const worldCy = rect.y + rect.height / 2;
  return {
    x: worldCx - dims.width / (2 * s),
    y: worldCy - dims.height / (2 * s),
    scale: { x: s, y: s },
  };
}

/**
 * Compute the AABB union of all leaf-node poses in the scene, via
 * `poseBounds`. Container nodes are skipped — their effective bounds come
 * from their descendant leaves. Returns `null` when the scene has no
 * leaves.
 */
function sceneLeafBounds<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  poseBounds: (pose: TPose) => Bounds,
): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const node of scene.nodes.values()) {
    if (node.kind !== 'leaf') continue;
    const b = poseBounds(node.pose);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    const right = b.x + b.width;
    const bottom = b.y + b.height;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
    any = true;
  }
  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Options for {@link computeFitView}. */
export interface ComputeFitViewOptions {
  /** Inset (CSS px) around the fit rect on each side. Defaults to `8`. */
  padding?: number;
}

/**
 * Derive a `View` that fits the chosen world rect into a minimap of
 * `dims.width × dims.height` CSS px. Uniform scale on both axes; the rect
 * is centered with `padding` (default 8) on each side. The smaller-axis
 * fit ratio wins, so the whole rect is visible.
 *
 * - `fit === "scene"`: union AABB of leaf-node poses via `poseBounds`.
 *   Empty scene → {@link FALLBACK_FIT_VIEW}.
 * - `fit` is `{ kind: "world", rect }`: fit `rect`. A degenerate rect
 *   (zero or negative area) falls back to identity scale centered on the
 *   rect's top-left — we don't divide by zero.
 * - `fit` is a function: called with `(scene, dims)`; its return is
 *   passed through unchanged.
 */
export function computeFitView<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  dims: ViewportDims,
  fit: MinimapFit<TData, TLayer, TPose>,
  poseBounds: (pose: TPose) => Bounds,
  opts: ComputeFitViewOptions = {},
): View {
  const padding = opts.padding ?? DEFAULT_FIT_PADDING;

  if (typeof fit === 'function') {
    return fit(scene, dims);
  }
  if (fit === 'scene') {
    const rect = sceneLeafBounds(scene, poseBounds);
    if (rect === null) return FALLBACK_FIT_VIEW;
    return fitRectInto(rect, dims, padding);
  }
  // { kind: 'world', rect }
  return fitRectInto(fit.rect, dims, padding);
}

/**
 * Build the visible-window indicator `DrawCommand` for the minimap.
 *
 * The main canvas's visible world rect is:
 * ```
 * worldX = mainView.x
 * worldY = mainView.y
 * worldW = mainViewDims.width  / mainView.scale.x
 * worldH = mainViewDims.height / mainView.scale.y
 * ```
 * That world rect is then transformed into the minimap's screen
 * coordinates through `minimapView`.
 *
 * The returned command is a dashed-stroke `path` rect with no fill —
 * matching the `ViewportLayerDemo` indicator math.
 */
export function computeIndicatorCommand(
  mainView: View,
  mainViewDims: ViewportDims,
  minimapView: View,
  style: IndicatorStyle = {},
): PathDrawCommand {
  const worldX = mainView.x;
  const worldY = mainView.y;
  const worldW = mainViewDims.width / mainView.scale.x;
  const worldH = mainViewDims.height / mainView.scale.y;
  const sx = (worldX - minimapView.x) * minimapView.scale.x;
  const sy = (worldY - minimapView.y) * minimapView.scale.y;
  const sw = worldW * minimapView.scale.x;
  const sh = worldH * minimapView.scale.y;
  return {
    kind: 'path',
    path: { kind: 'rect', x: sx, y: sy, width: sw, height: sh },
    stroke: {
      paint: { fill: 'solid', color: style.stroke ?? DEFAULT_INDICATOR_STROKE },
      width: style.width ?? DEFAULT_INDICATOR_WIDTH,
      dash: style.dash ?? [...DEFAULT_INDICATOR_DASH],
    },
  };
}
