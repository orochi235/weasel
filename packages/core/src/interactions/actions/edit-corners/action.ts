/**
 * Corner shape in path edit: drag a corner's widget to set its radius.
 *
 * A drag measures how far the pointer moves along the corner's bisector and
 * turns that into a cut along the edges, clamped to the room the neighboring
 * corners leave. Pressing the widget of a selected anchor gives every
 * selected corner the same radius. The release commits one undo step.
 */
import type { Action, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { isCornerWidget } from '@weasel-js/routing';
import {
  cornerFrames,
  cornerRadiusOf,
  cornerSpecAt,
  withCorner,
  type CornerFrame,
  type CornerStyle,
  type PolygonPath,
} from '@weasel-js/geom';
import type { EditAnchorsDep } from '../depSchema';
import { pathEditPreview } from '../edit-anchors/preview';
import { editingLayer, inPlane } from '../planeInput';

/** The style a corner with no spec yet takes. */
export const DEFAULT_CORNER_STYLE: CornerStyle = 'round';

/** Flat anchor index of a `corner:N` affordance kind, or null. */
function cornerIndexOf(kind: string): number | null {
  const m = kind.match(/^corner:(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

export function editedPath(dep: EditAnchorsDep): PolygonPath | null {
  const p = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  return p && p.kind === 'polygon' ? p : null;
}

interface CornerTarget {
  frame: CornerFrame;
  style: CornerStyle;
}

/** `path` with `radius` on every target, each clamped to the room it has. */
function withRadius(path: PolygonPath, targets: readonly CornerTarget[], radius: number): PolygonPath {
  let out = path;
  for (const { frame, style } of targets) {
    const max = cornerRadiusOf(style, frame.maxTrim, frame.halfAngle);
    out = withCorner(out, frame.index, { style, radius: Math.max(0, Math.min(radius, max)) });
  }
  return out;
}

/** Drag a corner widget to set the corner's radius. */
export const editCornerAction: Action & { requires: string[] } = inPlane({
  id: 'editCorner',
  label: 'Corner Radius',
  defaultBinding: { kind: 'drag', target: { kindOf: isCornerWidget } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const dep = ctx.deps.editAnchors;
      const index = cornerIndexOf(ctx.drag?.affordance?.kind ?? '');
      if (!dep?.editingId || index === null) return {};
      const origin = editedPath(dep);
      if (!origin) return {};
      const frames = new Map(cornerFrames(origin).map((f) => [f.index, f]));
      const pressed = frames.get(index);
      if (!pressed) return {};
      const indices = dep.selectedAnchors.has(index) ? [...dep.selectedAnchors] : [index];
      const targets: CornerTarget[] = [];
      for (const i of indices) {
        const frame = frames.get(i);
        if (frame) targets.push({ frame, style: cornerSpecAt(origin, i)?.style ?? DEFAULT_CORNER_STYLE });
      }
      const style = cornerSpecAt(origin, index)?.style ?? DEFAULT_CORNER_STYLE;
      const press = ctx.drag?.start ?? ctx.world;
      let current: PolygonPath = origin;
      let active = false;
      const preview = pathEditPreview(dep, dep.editingId, () => (active ? current : null));
      if (!preview) return {};
      const id = dep.editingId;
      return {
        kind: 'edit-corner',
        onMove(move: InvocationCtx): void {
          const along = (move.world.x - press.x) * pressed.bisector.x
            + (move.world.y - press.y) * pressed.bisector.y;
          const trim = Math.max(0, pressed.trim + along / Math.cos(pressed.halfAngle));
          current = withRadius(origin, targets, cornerRadiusOf(style, trim, pressed.halfAngle));
          active = true;
        },
        onEnd(_end: InvocationCtx, reason: 'commit' | 'cancel'): void {
          active = false;
          if (reason === 'cancel' || current === origin) return;
          dep.applyEdit(id, current, 'Corner radius');
        },
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: () => true,
}, editingLayer);
