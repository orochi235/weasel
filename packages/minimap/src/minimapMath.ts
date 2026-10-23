/** Pure math helpers for `<MinimapCanvas>`: no GL, DOM, or renderer. */
import { documentPose, effectivePose } from '@weasel-js/core';
import type { Scene } from '@weasel-js/core';
import type { View } from '@weasel-js/core';
import type { Bounds, ViewportDims } from '@weasel-js/core';
import { poseDescriptorForNode, type PoseDescriptor } from '@weasel-js/core';
import type { PathDrawCommand } from '@weasel-js/core';

/** Inset (CSS px) around the fit rect on each side. Matches the spec note. */
const DEFAULT_FIT_PADDING = 8;

/** Fallback view returned when there is nothing to fit (empty scene, etc.). */
export const FALLBACK_FIT_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/**
 * Fit policy for `<MinimapCanvas>` / `computeFitView`.
 *
 * - `"scene"` — union of leaf-node pose AABBs (via the pose descriptor), read
 *   from the document: a pose override moves what is painted and not the frame.
 * - `"live"` — the same union over the poses being shown, overrides included,
 *   so the frame follows a drag, a settle, or a simulation writing overrides.
 *   Refit on every override publish, which is a sweep of every leaf and
 *   rescales the whole minimap while one moves past the edge.
 * - `{ kind: "world", rect }` — caller-supplied world rect.
 * - `(scene, dims) => View` — caller derives the view directly.
 */
export type MinimapFit<TData, TLayer extends string, TPose> =
  | 'scene'
  | 'live'
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
  const hasW = rect.width > 0;
  const hasH = rect.height > 0;
  if (!hasW && !hasH) {
    return {
      x: rect.x - dims.width / 2,
      y: rect.y - dims.height / 2,
      scale: { x: 1, y: 1 },
    };
  }
  const s = Math.min(
    hasW ? availW / rect.width : Infinity,
    hasH ? availH / rect.height : Infinity,
  );
  const worldCx = rect.x + Math.max(0, rect.width) / 2;
  const worldCy = rect.y + Math.max(0, rect.height) / 2;
  return {
    x: worldCx - dims.width / (2 * s),
    y: worldCy - dims.height / (2 * s),
    scale: { x: s, y: s },
  };
}

/**
 * Compute the AABB union of all leaf-node poses in the scene, via
 * `descriptor`. Container nodes are skipped — their effective bounds come
 * from their descendant leaves, and so is a leaf whose bounds are not finite,
 * which would otherwise make the whole union non-finite. Returns `null` when
 * the scene has no leaf with bounds.
 */
function sceneLeafBounds<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  descriptor: PoseDescriptor<TPose>,
  poseOf: typeof documentPose,
): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let any = false;
  for (const node of scene.nodes.values()) {
    if (node.kind !== 'mark') continue;
    const b = poseDescriptorForNode(descriptor, node).getBounds(poseOf(scene, node));
    if (!Number.isFinite(b.x + b.y + b.width + b.height)) continue;
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
 * fit ratio wins, so the whole rect is visible. An empty scene gives
 * {@link FALLBACK_FIT_VIEW}; a function `fit` is passed through unchanged.
 *
 * A rect with one zero axis (a line) is fitted along the other. One with no
 * positive axis falls back to identity scale centered on its top-left.
 */
export function computeFitView<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  dims: ViewportDims,
  fit: MinimapFit<TData, TLayer, TPose>,
  descriptor: PoseDescriptor<TPose>,
  opts: ComputeFitViewOptions = {},
): View {
  const padding = opts.padding ?? DEFAULT_FIT_PADDING;

  if (typeof fit === 'function') {
    return fit(scene, dims);
  }
  if (fit === 'scene' || fit === 'live') {
    const rect = sceneLeafBounds(scene, descriptor, fit === 'live' ? effectivePose : documentPose);
    if (rect === null) return FALLBACK_FIT_VIEW;
    return fitRectInto(rect, dims, padding);
  }
  // { kind: 'world', rect }
  return fitRectInto(fit.rect, dims, padding);
}

/**
 * Build the visible-window indicator `DrawCommand` for the minimap: the main
 * canvas's visible world rect as a dashed-stroke `path` rect with no fill, in
 * world coordinates. Pass the `minimapView` it will be drawn through, so the
 * stroke width and dash come out in CSS px at any fit scale; without it they
 * are in world units.
 */
export function computeIndicatorCommand(
  mainView: View,
  mainViewDims: ViewportDims,
  style: IndicatorStyle = {},
  minimapView?: View,
): PathDrawCommand {
  // World-space rect, returned as-is: the caller wraps the command list in a
  // group transformed by the minimap's view, and screen coords here would get
  // that transform applied a second time.
  const x = mainView.x;
  const y = mainView.y;
  const width = mainViewDims.width / mainView.scale.x;
  const height = mainViewDims.height / mainView.scale.y;
  const px = minimapView ? 1 / Math.abs(minimapView.scale.x) : 1;
  return {
    kind: 'path',
    path: { kind: 'rect', x, y, width, height },
    stroke: {
      paint: { kind: 'solid', color: style.stroke ?? DEFAULT_INDICATOR_STROKE },
      width: (style.width ?? DEFAULT_INDICATOR_WIDTH) * px,
      dash: (style.dash ?? DEFAULT_INDICATOR_DASH).map((d) => d * px),
    },
  };
}
