/**
 * Reading a layer's draw envelope.
 *
 * Every `RenderLayer.draw` receives the drawing view's {@link CanvasHelpers} as
 * its `data` argument, and `<CanvasView>` overlays its own half before handing
 * the stack to a second camera. A layer that answers from a construction
 * closure instead therefore answers for view zero in every view — so these
 * lookups exist to make the envelope the easy source.
 *
 * A layer drawn by a bare consumer may get plain data instead, which is why
 * each reader has an "unwired" answer rather than throwing.
 */
import type { ChromeState } from 'core/selection/chromeState';
import type { OngoingOverlay } from 'interactions/actions/invoker';
import type { GesturePreviewSource } from './gestureBounds';
import type { CanvasViewHelpers } from './useViewHelpers';

type PartialEnvelope = Partial<CanvasViewHelpers<unknown>>;

function thunk<K extends keyof CanvasViewHelpers<unknown>>(
  data: unknown,
  key: K,
): CanvasViewHelpers<unknown>[K] | undefined {
  const maybe = data as PartialEnvelope | null | undefined;
  return typeof maybe?.[key] === 'function' ? maybe[key] : undefined;
}

/** This view's chrome state, or `null` when the caller passed plain data. */
export function chromeStateFrom(data: unknown): ChromeState | null {
  return thunk(data, 'getChromeState')?.() ?? null;
}

/** This view's chrome-caps predicate, or `null` when the caller passed plain
 *  data — the layer then paints unconditionally. */
export function isVisibleFrom(data: unknown): ((id: string) => boolean) | null {
  return thunk(data, 'getIsVisible')?.() ?? null;
}

/** This view's in-flight preview surfaces, in resolution order. Empty when
 *  nothing is in flight and when the caller passed plain data. */
export function previewSourcesFrom(data: unknown): readonly GesturePreviewSource[] {
  return thunk(data, 'getPreviewSources')?.() ?? EMPTY_SOURCES;
}

/** The overlay shapes this view's in-flight handles publish. */
export function gestureOverlaysFrom(data: unknown): readonly OngoingOverlay[] {
  return thunk(data, 'getGestureOverlays')?.() ?? EMPTY_OVERLAYS;
}

/** First non-null `previewPose(id)` across `sources`, or `null`. */
export function previewPoseIn(
  sources: readonly GesturePreviewSource[],
  id: string,
): unknown {
  for (const s of sources) {
    const p = s.previewPose?.(id);
    if (p != null) return p;
  }
  return null;
}

/** First non-null `previewData(id)` across `sources`, or `null`. */
export function previewDataIn(
  sources: readonly GesturePreviewSource[],
  id: string,
): unknown {
  for (const s of sources) {
    const d = s.previewData?.(id);
    if (d != null) return d;
  }
  return null;
}

const EMPTY_SOURCES: readonly GesturePreviewSource[] = [];
const EMPTY_OVERLAYS: readonly OngoingOverlay[] = [];
