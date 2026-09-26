/**
 * A minimap over a `<SceneCanvas>`, written as one `SurfaceContribution`: a
 * view through a fit camera, the pan that moves the main camera from inside
 * it, the visible-rect indicator, and a linked crosshair.
 */
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { Scene } from 'core/scene/types';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import type { PointerWorldPos } from 'features/pointer/PointerContext';
import type { CanvasExtensionApi } from '../../canvas/canvasExtension';
import type { ViewRect } from '../../canvas/CanvasView';
import type { ContributionDepReader, SurfaceContribution } from '../../canvas/surfaceContribution';
import {
  computeFitView, FALLBACK_FIT_VIEW, type IndicatorStyle, type MinimapFit,
} from '../../canvas/minimapMath';
import {
  MINIMAP_CENTER, MINIMAP_PAN, minimapCenterAction, minimapPanAction,
} from './actions';
import { createIndicatorLayer, createLinkedCursorLayer } from './layers';

/** The crosshair's color when the canvas sits under no theme. */
const FALLBACK_CURSOR_COLOR = '#4c8dff';

/** Read `--wzl-accent` off the canvas element, where the theme cascade lands. */
function accentOf(api: CanvasExtensionApi): string {
  const el = api.element;
  if (!el || typeof getComputedStyle !== 'function') return FALLBACK_CURSOR_COLOR;
  return getComputedStyle(el).getPropertyValue('--wzl-accent').trim() || FALLBACK_CURSOR_COLOR;
}

/**
 * The linked crosshair's live half: follows the pointer store, and asks the
 * surface to repaint whenever the crosshair shows, moves, or has just hidden.
 * `ownViews` are the view ids this surface paints; the crosshair shows in any
 * of them the pointer is not over.
 */
function linkedCursor(id: string, ownViews: readonly (string | null)[]) {
  let pointer: PointerWorldPos = null;
  let color = FALLBACK_CURSOR_COLOR;
  const visible = (p: PointerWorldPos): boolean =>
    p !== null && ownViews.some((v) => v !== p.viewId);
  const layer = createLinkedCursorLayer({ id, pointer: () => pointer, color: () => color });
  const attach = (api: CanvasExtensionApi, deps: ContributionDepReader): (() => void) => {
    const store = deps.get('pointer');
    if (!store) return () => {};
    color = accentOf(api);
    pointer = store.get();
    const off = store.subscribe(() => {
      const prev = pointer;
      pointer = store.get();
      if (visible(prev) || visible(pointer)) api.requestRedraw();
    });
    return () => {
      off();
      pointer = null;
      api.requestRedraw();
    };
  };
  return { layer, attach };
}

/** Options for {@link createLinkedCursorContribution}. */
export interface LinkedCursorOptions {
  /** Entry id. Default `'linked-cursor'`. */
  id?: string;
  /** Views on this surface the crosshair may paint in. Default `[null]`, the
   *  surface's own camera — the main canvas beside a detached minimap. */
  views?: readonly (string | null)[];
}

/**
 * The linked crosshair alone: this surface paints the pointer's position
 * whenever the pointer is over some other view — another surface under the
 * same `<PointerContextProvider>`, such as a detached `<MinimapCanvas>`.
 */
export function createLinkedCursorContribution(opts: LinkedCursorOptions = {}): SurfaceContribution {
  const id = opts.id ?? 'linked-cursor';
  const cursor = linkedCursor(id, opts.views ?? [null]);
  return { id, eligibility: { always: true }, overlay: cursor.layer, attach: cursor.attach };
}

/** Options for {@link createMinimapContribution}. */
export interface MinimapContributionOptions<TData = unknown, TLayer extends string = string, TPose = unknown> {
  /** View and entry id. Default `'minimap'`. */
  id?: string;
  /** Where the minimap paints, in CSS pixels from the canvas top-left. A
   *  function is re-read every frame, so it can follow the canvas's size. */
  rect: ViewRect | ((outer: View, dims: Dims) => ViewRect);
  /** What the minimap frames. Default `'scene'`, the union of leaf poses. */
  fit?: MinimapFit<TData, TLayer, TPose>;
  /** The surface layers the minimap paints. Default: all of them. */
  layers?: (surface: readonly RenderLayer<unknown>[]) => readonly RenderLayer<unknown>[];
  /** Ground painted before the minimap's layers, so the main canvas does not
   *  show through. */
  background?: string;
  /** The visible-rect indicator's stroke. */
  indicatorStyle?: IndicatorStyle;
}

const DEFAULT_BACKGROUND = 'rgba(24, 24, 28, 0.92)';

/**
 * A minimap inside a `<SceneCanvas>`, installed with one entry:
 *
 * ```tsx
 * const minimap = useMemo(() => createMinimapContribution({ rect: { x: 8, y: 8, w: 160, h: 110 } }), []);
 * <SceneCanvas ambient={[minimap]} … />
 * ```
 *
 * Press in it to center the main camera on that point, drag to keep it there.
 * It shows the main camera's visible rect, and a crosshair where the pointer is
 * over the other view. Build it once — each instance keeps the live state its
 * layers read.
 */
export function createMinimapContribution<TData = unknown, TLayer extends string = string, TPose = unknown>(
  opts: MinimapContributionOptions<TData, TLayer, TPose>,
): SurfaceContribution {
  const id = opts.id ?? 'minimap';
  const fit = (opts.fit ?? 'scene') as MinimapFit<unknown, string, unknown>;
  let deps: ContributionDepReader | null = null;

  // The fit follows the scene, so it is recomputed only when the scene's
  // version or the minimap's size changes — it is read on every frame and
  // every event.
  let cached: { scene: unknown; version: number; w: number; h: number; view: View } | null = null;
  const fitCamera = (outer: View, dims: Dims): View => {
    const scene = deps?.get('scene') as Scene<unknown, string, unknown> | undefined;
    if (!scene) return FALLBACK_FIT_VIEW;
    const r = typeof opts.rect === 'function' ? opts.rect(outer, dims) : opts.rect;
    const version = scene.getVersion();
    if (cached && cached.scene === scene && cached.version === version && cached.w === r.w && cached.h === r.h) {
      return cached.view;
    }
    const descriptor = (deps?.get('poseDescriptor') ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;
    const view = computeFitView(scene, { width: r.w, height: r.h }, fit, descriptor);
    cached = { scene, version, w: r.w, h: r.h, view };
    return view;
  };

  const cursor = linkedCursor(`${id}.cursor`, [null, id]);
  const indicator = createIndicatorLayer({
    viewId: id,
    root: () => deps?.get('rootView'),
    ...(opts.indicatorStyle ? { style: opts.indicatorStyle } : {}),
  });

  return {
    id,
    eligibility: { always: true },
    views: [{
      id,
      bounds: opts.rect,
      view: fitCamera,
      interactive: true,
      background: opts.background ?? DEFAULT_BACKGROUND,
      ...(opts.layers ? { layers: opts.layers } : {}),
    }],
    actions: [minimapCenterAction(), minimapPanAction()],
    bindings: [
      { spec: { kind: 'pointerDown' }, actionId: MINIMAP_CENTER, opts: { views: [id] } },
      { spec: { kind: 'drag' }, actionId: MINIMAP_PAN, opts: { views: [id] } },
    ],
    overlay: [indicator, cursor.layer],
    attach: (api, reader) => {
      deps = reader;
      const detachCursor = cursor.attach(api, reader);
      // The fit camera had no scene until now.
      api.requestRedraw();
      return () => {
        detachCursor();
        deps = null;
        cached = null;
      };
    },
  };
}
