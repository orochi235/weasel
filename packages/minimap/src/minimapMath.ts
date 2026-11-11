/** Pure math helpers for `<MinimapCanvas>`: no GL, DOM, or renderer. */
import {
  composeWorldPose, documentPose, effectivePose, fitViewToBounds, sceneContentBounds, scenePoseAdapter, unionAABB,
  viewportWorldRect,
} from '@weasel-js/core';
import type { NodeId, PoseAdapter, Scene } from '@weasel-js/core';
import type { View } from '@weasel-js/core';
import type { Bounds, ViewportDims } from '@weasel-js/core';
import { FALLBACK_ACCENT, poseDescriptorForNode, type PoseDescriptor } from '@weasel-js/core';
import type { PathDrawCommand } from '@weasel-js/core';

/** Inset (CSS px) around the fit rect on each side. Matches the spec note. */
const DEFAULT_FIT_PADDING = 8;

/** Fallback view returned when there is nothing to fit (empty scene, etc.). */
export const FALLBACK_FIT_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/**
 * Fit policy for `<MinimapCanvas>` / `computeFitView`.
 *
 * - `"scene"` — union of the shown leaf-node pose AABBs (via the pose
 *   descriptor) and every copy a group draws of them, read from the document:
 *   a pose override moves what is painted and not the frame.
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
  /** Stroke color (any CSS color). Defaults to the theme's `--wzl-accent`, the color of the minimap's crosshair. */
  stroke?: string;
  /** Stroke width in CSS px. Defaults to `1`. */
  width?: number;
  /** Dash pattern in CSS px. Defaults to `[2, 3]`. */
  dash?: number[];
}

const DEFAULT_INDICATOR_WIDTH = 1;
const DEFAULT_INDICATOR_DASH: readonly number[] = [2, 3];

/** Internal: fit a world rect uniformly into dims with padding, at whatever
 *  scale that takes, up to the largest double for a rect too small to have one. A rect with nothing to fit, or a minimap not yet measured,
 *  gets identity scale centered on the rect's top-left. */
function fitRectInto(rect: Bounds, dims: ViewportDims, padding: number): View {
  if (dims.width > 0 && dims.height > 0) {
    const fitted = fitViewToBounds(rect, dims, FALLBACK_FIT_VIEW, { padding, minScale: 0, maxScale: Number.MAX_VALUE });
    if (fitted) return fitted;
  }
  return {
    x: rect.x - dims.width / 2,
    y: rect.y - dims.height / 2,
    scale: { x: 1, y: 1 },
  };
}

/**
 * The world box a scene's content covers, as `sceneContentBounds` frames it
 * for zoom to fit: every shown node, and every copy a group draws of it. A
 * node is boxed by the union of the marks under it, each its pose folded up
 * its containers' frames and read through `descriptor`; containers add no box
 * of their own, and a mark whose bounds are not finite is skipped, which would
 * otherwise make the whole union non-finite. `null` when nothing has bounds.
 */
function sceneLeafBounds<TData, TLayer extends string, TPose>(
  scene: Scene<TData, TLayer, TPose>,
  descriptor: PoseDescriptor<TPose>,
  poseOf: typeof documentPose,
): Bounds | null {
  const frames = {
    ...(scenePoseAdapter(scene as Scene<unknown, string, unknown>) as PoseAdapter<TPose>),
    getPose: (id: string) => poseOf(scene, scene.get(id as NodeId)!),
  };
  const compose = scene.composition.compose.bind(scene.composition);
  const worldPose = (id: NodeId): TPose => composeWorldPose(frames, id, compose);
  const boxOf = (id: NodeId): Bounds | null => {
    const node = scene.get(id);
    if (!node) return null;
    const parts: (Bounds | null)[] = scene.childrenOf(id).map(boxOf);
    if (node.kind === 'mark') {
      const b = poseDescriptorForNode(descriptor, node).getBounds(worldPose(id));
      if ([b.x, b.y, b.width, b.height].every(Number.isFinite)) parts.push(b);
    }
    return unionAABB(parts);
  };
  return sceneContentBounds(scene, boxOf, (node) => worldPose(node.id));
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
 * positive axis, or a side that is not finite, falls back to identity scale
 * centered on its top-left.
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
 * are in world units. `themeStroke` is the stroke when `style` names none: the
 * theme's accent as read off the minimap's element (`accentColorOf`).
 */
export function computeIndicatorCommand(
  mainView: View,
  mainViewDims: ViewportDims,
  style: IndicatorStyle = {},
  minimapView?: View,
  themeStroke: string = FALLBACK_ACCENT,
): PathDrawCommand {
  // World-space rect, returned as-is: the caller wraps the command list in a
  // group transformed by the minimap's view, and screen coords here would get
  // that transform applied a second time.
  const { x, y, width, height } = viewportWorldRect(mainView, mainViewDims);
  const px = minimapView ? 1 / Math.abs(minimapView.scale.x) : 1;
  return {
    kind: 'path',
    path: { kind: 'rect', x, y, width, height },
    stroke: {
      paint: { kind: 'solid', color: style.stroke ?? themeStroke },
      width: (style.width ?? DEFAULT_INDICATOR_WIDTH) * px,
      dash: (style.dash ?? DEFAULT_INDICATOR_DASH).map((d) => d * px),
    },
  };
}
