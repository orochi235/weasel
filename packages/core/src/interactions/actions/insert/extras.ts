import type { DragSample } from '@weasel-js/routing';
import type { InsertExtras } from '../depSchema';

/** Build a typed `InsertExtras` from the static params + gesture context.
 *  Kit-built-in kinds (line / polygon / star / pencil) read kind-specific
 *  fields; unknown kinds pass the raw params through as `{ kind, ... }`. */
export function buildExtras(
  params: Record<string, unknown> | undefined,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  points: ReadonlyArray<DragSample> | null,
): InsertExtras {
  const kind = ((params?.['kind'] as string | undefined) ?? 'rect');
  switch (kind) {
    case 'rect':
    case 'ellipse':
      return { kind } as InsertExtras;
    case 'line':
      // Use the live drag endpoints (not AABB) so the line preserves the
      // user's drag direction — drag from bottom-left to top-right makes a
      // line that slopes up, not the bounds diagonal.
      return { kind: 'line', a: { x: startX, y: startY }, b: { x: currentX, y: currentY } };
    case 'polygon': {
      const sides = Number(params?.['sides'] ?? 6);
      // When the tool omits rotation, point the first vertex along the
      // drag vector so dragging in a direction orients the shape that
      // way. Sub-pixel drags (no direction yet) fall back to 0.
      const dragAngle = (currentX === startX && currentY === startY)
        ? 0
        : Math.atan2(currentY - startY, currentX - startX);
      const rotation = params?.['rotation'] !== undefined
        ? Number(params['rotation'])
        : dragAngle;
      const extras: InsertExtras = { kind: 'polygon', sides, rotation };
      // Drag-from-center: tool's Alt binding passes `originMode:'center'`.
      // Compute polygon center + radius from the drag vector so the shape
      // anchors on the click point. Without this, the dep falls back to
      // inscribing in the AABB (drag-from-corner default).
      if (params?.['originMode'] === 'center') {
        const dx = currentX - startX;
        const dy = currentY - startY;
        (extras as { center?: unknown }).center = { x: startX, y: startY };
        (extras as { radius?: unknown }).radius = Math.hypot(dx, dy);
      } else {
        if (params?.['center'] !== undefined) (extras as { center?: unknown }).center = params['center'];
        if (params?.['radius'] !== undefined) (extras as { radius?: unknown }).radius = params['radius'];
      }
      return extras;
    }
    case 'star': {
      const pts = Number(params?.['points'] ?? 5);
      const ir = Number(params?.['innerRadiusRatio'] ?? 0.5);
      const dragAngle = (currentX === startX && currentY === startY)
        ? 0
        : Math.atan2(currentY - startY, currentX - startX);
      const rotation = params?.['rotation'] !== undefined
        ? Number(params['rotation'])
        : dragAngle;
      const extras: InsertExtras = { kind: 'star', points: pts, innerRadiusRatio: ir, rotation };
      if (params?.['originMode'] === 'center') {
        const dx = currentX - startX;
        const dy = currentY - startY;
        (extras as { center?: unknown }).center = { x: startX, y: startY };
        (extras as { outerRadius?: unknown }).outerRadius = Math.hypot(dx, dy);
      } else {
        if (params?.['center'] !== undefined) (extras as { center?: unknown }).center = params['center'];
        if (params?.['outerRadius'] !== undefined) (extras as { outerRadius?: unknown }).outerRadius = params['outerRadius'];
      }
      return extras;
    }
    case 'pencil':
      // Prefer tool-supplied samples (param) when present — pencil tools may
      // capture richer per-sample data (pressure/tilt). Fall back to the
      // dispatcher's accumulated pointer trail.
      return {
        kind: 'pencil',
        samples: (params?.['samples'] as ReadonlyArray<DragSample> | undefined)
          ?? points
          ?? [],
      };
    default:
      // Consumer-defined kind: pass everything through so a custom insert
      // dep can read its own fields.
      return { ...(params ?? {}), kind } as InsertExtras;
  }
}

/** Add a user-driven rotation offset onto kinds that carry rotation. Rect
 *  / ellipse / line / pencil don't expose a rotation field on their
 *  extras today, so they ignore the offset. */
export function applyUserRotation(extras: InsertExtras, userRotation: number): void {
  if (userRotation === 0) return;
  if (extras.kind === 'star' || extras.kind === 'polygon') {
    (extras as { rotation: number }).rotation += userRotation;
  }
}
