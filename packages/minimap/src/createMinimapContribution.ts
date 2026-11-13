/**
 * A minimap over a `<SceneCanvas>`, written as one `SurfaceContribution`: a
 * view through a fit camera, the pan that moves the main camera from inside
 * it, the visible-rect indicator, and a linked crosshair.
 */
import type { Dims, RenderLayer } from '@weasel-js/core';
import type { View } from '@weasel-js/core';
import type { Scene } from '@weasel-js/core';
import type { PoseDescriptor } from '@weasel-js/core';
import { AUTO_POSE_DESCRIPTOR } from '@weasel-js/core';
import type { PointerWorldPos } from '@weasel-js/routing/react';
import type { CanvasExtensionApi } from '@weasel-js/core';
import type { ViewRect, ZoomClampOptions } from '@weasel-js/core';
import type { ContributionDepReader, SurfaceContribution } from '@weasel-js/core';
import {
  computeFitView, FALLBACK_FIT_VIEW, type IndicatorStyle, type MinimapFit,
} from './minimapMath';
import {
  minimapBindings, minimapCenterAction, minimapPanAction, minimapZoomAction,
} from './actions';
import { createIndicatorLayer, createLinkedCursorLayer } from './layers';
import { accentColorOf, FALLBACK_ACCENT, watchThemeOf } from '@weasel-js/core';


/**
 * The linked crosshair's live half: follows the pointer store, and asks the
 * surface to repaint whenever the crosshair shows, moves, or has just hidden.
 * `ownViews` are the view ids this surface paints; the crosshair shows in any
 * of them the pointer is not over.
 */
/** Hands `set` the theme's accent on `api`'s element now and whenever its theme changes, repainting on each change. */
function followAccent(api: CanvasExtensionApi, set: (color: string) => void): () => void {
  const read = () => set(accentColorOf(api.element));
  read();
  return watchThemeOf(() => api.element, () => {
    read();
    api.requestRedraw();
  });
}

function linkedCursor(id: string, ownViews: readonly (string | null)[]) {
  let pointer: PointerWorldPos = null;
  let color = FALLBACK_ACCENT;
  const visible = (p: PointerWorldPos): boolean =>
    p !== null && ownViews.some((v) => v !== p.viewId);
  const layer = createLinkedCursorLayer({ id, pointer: () => pointer, color: () => color, views: ownViews });
  const attach = (api: CanvasExtensionApi, deps: ContributionDepReader): (() => void) => {
    const store = deps.get('pointer');
    if (!store) return () => {};
    const stopAccent = followAccent(api, (c) => { color = c; });
    pointer = store.get();
    const off = store.subscribe(() => {
      const prev = pointer;
      pointer = store.get();
      if (visible(prev) || visible(pointer)) api.requestRedraw();
    });
    return () => {
      off();
      stopAccent();
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
 *
 * A surface carrying `createMinimapContribution` already has one, in both its
 * views; this is for a surface without.
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
  /** The wheel, and a trackpad pinch, over the minimap zoom the main camera about the world point under the
   *  cursor, as `<MinimapCanvas wheelZoom>` does. Pass the main view's zoom limits to clamp to them, or `false`
   *  to bind no wheel. Default `true`. */
  wheelZoom?: boolean | ZoomClampOptions;
}

const DEFAULT_BACKGROUND = '#18181c';

/**
 * A minimap inside a `<SceneCanvas>`, installed with one entry:
 *
 * ```tsx
 * const minimap = useMemo(() => createMinimapContribution({ rect: { x: 8, y: 8, w: 160, h: 110 } }), []);
 * <SceneCanvas ambient={[minimap]} … />
 * ```
 *
 * Press in it to center the main camera on that point, drag to keep it there,
 * and wheel to zoom the main camera about the point under the cursor. It shows the main camera's visible rect, and a crosshair where the pointer is
 * over the other view. Build it once — each instance keeps the live state its
 * layers read.
 */
export function createMinimapContribution<TData = unknown, TLayer extends string = string, TPose = unknown>(
  opts: MinimapContributionOptions<TData, TLayer, TPose>,
): SurfaceContribution {
  const id = opts.id ?? 'minimap';
  const wheel = opts.wheelZoom ?? true;
  const zoom = wheel === false ? null : { clamp: typeof wheel === 'object' ? wheel : undefined };
  const fit = (opts.fit ?? 'scene') as MinimapFit<unknown, string, unknown>;
  let deps: ContributionDepReader | null = null;

  // The fit follows the scene, so it is recomputed only when the scene's
  // version, the pose descriptor or the minimap's size changes — it is read on
  // every frame and every event.
  let cached: {
    scene: unknown; descriptor: unknown; version: number; shown: number; w: number; h: number; view: View;
  } | null = null;
  const fitCamera = (outer: View, dims: Dims): View => {
    const scene = deps?.get('scene') as Scene<unknown, string, unknown> | undefined;
    if (!scene) return FALLBACK_FIT_VIEW;
    const r = typeof opts.rect === 'function' ? opts.rect(outer, dims) : opts.rect;
    const version = scene.getVersion();
    // Only a live fit reads overrides, so only it refits when they publish.
    const shown = fit === 'live' ? scene.overrides.getGeneration() : 0;
    const descriptor = (deps?.get('poseDescriptor') ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;
    if (cached && cached.scene === scene && cached.descriptor === descriptor && cached.version === version
        && cached.shown === shown && cached.w === r.w && cached.h === r.h) {
      return cached.view;
    }
    const view = computeFitView(scene, { width: r.w, height: r.h }, fit, descriptor);
    cached = { scene, descriptor, version, shown, w: r.w, h: r.h, view };
    return view;
  };

  const cursor = linkedCursor(`${id}.cursor`, [null, id]);
  let accent = FALLBACK_ACCENT;
  const indicator = createIndicatorLayer({
    viewId: id,
    root: () => deps?.get('rootView'),
    color: () => accent,
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
    actions: [minimapCenterAction(), minimapPanAction(), ...(zoom ? [minimapZoomAction(zoom.clamp)] : [])],
    bindings: minimapBindings(id, zoom !== null, [id]),
    overlay: [indicator, cursor.layer],
    attach: (api, reader) => {
      deps = reader;
      const stopAccent = followAccent(api, (c) => { accent = c; });
      const detachCursor = cursor.attach(api, reader);
      // The fit camera had no scene until now.
      api.requestRedraw();
      return () => {
        detachCursor();
        stopAccent();
        deps = null;
        cached = null;
      };
    },
  };
}
