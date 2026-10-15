/** The chrome an in-flight gesture paints beside the scene. */
import type { OngoingHandle } from './invoker';

/**
 * What a `polyline` overlay is, in a word — the narrowest thing an action can
 * say about how its run should look without naming a paint.
 *
 * The named roles are the kit's; a painter maps each to a style and falls back
 * to plain chrome for one it does not know, so a package outside core can coin
 * its own and still be drawn.
 */
export type OverlayRole =
  /** Generic in-flight chrome — the marquee/lasso paint. */
  | 'chrome'
  /** A cut the gesture would make. */
  | 'cut'
  /** An edge the gesture would author between two points. */
  | 'connector'
  /** The stretch of a path a soft-selection drag reaches. */
  | 'falloff'
  /** A line a dragged point has snapped to. */
  | 'snap'
  /** What a held constraint keeps the dragged point on. */
  | 'lock'
  | (string & {});

/**
 * What an in-flight gesture proposes to paint *beside* the scene, returned by
 * `OngoingHandle.overlay()` — a marquee rect, a lasso trail, the outline of a
 * shape being dragged out, the line a slice would cut along.
 *
 * Every variant is world geometry and nothing else — no `DrawCommand`, no
 * color, no coordinate space to choose — so a surface rendering the same
 * gesture some other way can still read it. The painter owns every style
 * decision.
 */
export type OngoingOverlay =
  | {
      kind: 'marquee';
      start: { x: number; y: number };
      current: { x: number; y: number };
      shiftHeld: boolean;
    }
  | {
      kind: 'lasso';
      vertices: ReadonlyArray<{ x: number; y: number }>;
      current: { x: number; y: number };
      shiftHeld: boolean;
    }
  | {
      /**
       * An open run of world points the gesture is proposing — a cut line, a
       * routed connector. `role` is the whole of what an action says about
       * appearance.
       */
      kind: 'polyline';
      /** At least two points. Anything shorter is dropped in resolution. */
      points: ReadonlyArray<{ x: number; y: number }>;
      /** What the run means. Omitted reads as {@link OverlayRole} `'chrome'`. */
      role?: OverlayRole;
    }
  | {
      /**
       * Live insert-drag preview. Pre-commit there is no scene node to ghost
       * via `previewIds()`/`previewPose()`, so insert paints its preview
       * through the overlay instead.
       *
       * `bounds` is the AABB of the current drag (start/current normalized).
       * `extras` is the per-kind extras the action already collected; the
       * overlay renderer narrows on `shape` and casts the field shape it
       * expects.
       */
      kind: 'insertPreview';
      /** Which preview the dispatcher's overlay draws. The kit's own shape
       *  kinds are the ones it knows how to render; a consumer-defined kind
       *  is legal and simply gets no live preview. */
      shape: string;
      bounds: { x: number; y: number; width: number; height: number };
      extras: unknown;
      /** World-space point to paint a small "anchor" dot at, marking the
       *  click point — for radial shapes (polygon/star), where no vertex
       *  sits on it, and for any shape in center mode. */
      anchorPoint?: { x: number; y: number };
    };

/** A handle's overlays as a list: empty when it has none. */
export function overlaysOf(handle: OngoingHandle): readonly OngoingOverlay[] {
  const ov = handle.overlay?.();
  if (!ov) return [];
  return isOverlayList(ov) ? ov : [ov];
}

function isOverlayList(ov: OngoingOverlay | readonly OngoingOverlay[]): ov is readonly OngoingOverlay[] {
  return Array.isArray(ov);
}
