/**
 * What an in-flight gesture is proposing to paint *beside* the scene, resolved
 * to geometry.
 *
 * The sibling of `resolvePreviews`: that one answers for the ghosts of scene
 * nodes a gesture is displacing, this one for the chrome a gesture draws that
 * is no node at all — a marquee rect, a lasso trail, the outline of a shape
 * being dragged out. `<SceneCanvas>`'s `useDispatcherOverlayLayer` used to be
 * the only thing that knew how to read an `OngoingOverlay`, and it read one
 * straight into `DrawCommand`s, so a consumer with its own renderer got
 * nothing. None of the normalizing is about drawing.
 *
 * What stays out, as in `resolvePreviews`: no view, no screen projection, no
 * `DrawCommand`, no style, no React, no dispatcher. World coordinates only.
 */

import type { InsertPreviewGeometry } from '../../canvas/insertPreviewExtent';
import { insertPreviewExtent } from '../../canvas/insertPreviewExtent';
import type { Bounds } from '../../core/viewport/fitViewToBounds';
import type { KitInsertShape } from '../../core/shapeKinds';
import type { DrawCommand } from '../../renderer';
import type { OngoingOverlay } from './invoker';

type Point = { x: number; y: number };

/**
 * The chrome-caps id a surface consults before painting each variant. The
 * gating itself is the painter's — two views of one surface may disagree about
 * whether to show an in-flight marquee — but the id is not something a caller
 * should have to guess.
 */
export type OverlayVisibilityId =
  | 'action.marquee'
  | 'action.lasso'
  | 'action.insert-preview'
  | 'action.commands';

/**
 * One in-flight overlay, in world coordinates.
 *
 * Every degenerate overlay is already gone: a marquee of zero size, a lasso
 * under two vertices, a zero-area insert of anything but a pencil, a pencil
 * under two samples, an empty command list. Whatever is in this list is worth
 * painting.
 */
export type ResolvedOverlay =
  | {
      kind: 'marquee';
      visibilityId: 'action.marquee';
      /** The drag normalized: `start`/`current` in either order, one AABB. */
      bounds: Bounds;
      /** Additive intent. Core's 2D layer paints the same rect either way. */
      shiftHeld: boolean;
    }
  | {
      kind: 'lasso';
      visibilityId: 'action.lasso';
      /** The trail so far, at least two long. The region it encloses is the
       *  trail closed back to its first vertex. */
      vertices: ReadonlyArray<Point>;
      /** Live pointer position — the trail's last vertex until it advances. */
      current: Point;
      shiftHeld: boolean;
    }
  | {
      kind: 'insertPreview';
      visibilityId: 'action.insert-preview';
      shape: KitInsertShape;
      /** Extent of `geometry`, which for a radial or freehand shape is not the
       *  drag rect. See `insertPreviewExtent`. */
      bounds: Bounds;
      geometry: InsertPreviewGeometry;
      /** The drag's anchor — a growth axis to mark. Absent for a pencil, which
       *  has none. */
      anchorPoint?: Point;
      /** The action's per-shape payload, verbatim. Carries what geometry
       *  cannot: an image insert's `src`, say. */
      extras: unknown;
    }
  | {
      /**
       * The one variant that does not resolve. `slice` and `@weasel-js/diagram`'s
       * connect both bake a `PathDrawCommand` inside the action, so the geometry
       * is destroyed at the source and no resolver can recover it — this is not
       * an oversight to be fixed here. A renderer that is not core's must skip
       * this variant; `opaque` is the flag to skip on.
       */
      kind: 'commands';
      visibilityId: 'action.commands';
      opaque: true;
      commands: readonly DrawCommand[];
      /** Never defaulted away: `'world'` when the action said nothing. */
      space: 'world' | 'screen';
    };

/** The overlays worth painting, in the order the handles published them. */
export function resolveOverlays(overlays: Iterable<OngoingOverlay>): ResolvedOverlay[] {
  const out: ResolvedOverlay[] = [];
  for (const ov of overlays) {
    switch (ov.kind) {
      case 'marquee': {
        const x = Math.min(ov.start.x, ov.current.x);
        const y = Math.min(ov.start.y, ov.current.y);
        const width = Math.abs(ov.current.x - ov.start.x);
        const height = Math.abs(ov.current.y - ov.start.y);
        if (width === 0 && height === 0) break;
        out.push({
          kind: 'marquee',
          visibilityId: 'action.marquee',
          bounds: { x, y, width, height },
          shiftHeld: ov.shiftHeld,
        });
        break;
      }
      case 'lasso': {
        if (ov.vertices.length < 2) break;
        out.push({
          kind: 'lasso',
          visibilityId: 'action.lasso',
          vertices: ov.vertices,
          current: ov.current,
          shiftHeld: ov.shiftHeld,
        });
        break;
      }
      case 'insertPreview': {
        const { bounds, geometry } = insertPreviewExtent(ov);
        // A pencil can be meaningful at zero AABB — a closed loop, a
        // sub-threshold gesture — where every other shape cannot.
        if (bounds.width === 0 && bounds.height === 0 && ov.shape !== 'pencil') break;
        if (geometry.kind === 'pencil' && geometry.samples.length < 2) break;
        out.push({
          kind: 'insertPreview',
          visibilityId: 'action.insert-preview',
          shape: ov.shape,
          bounds,
          geometry,
          extras: ov.extras,
          ...(ov.anchorPoint && ov.shape !== 'pencil' ? { anchorPoint: ov.anchorPoint } : {}),
        });
        break;
      }
      case 'commands': {
        if (ov.commands.length === 0) break;
        out.push({
          kind: 'commands',
          visibilityId: 'action.commands',
          opaque: true,
          commands: ov.commands,
          space: ov.space ?? 'world',
        });
        break;
      }
    }
  }
  return out;
}
