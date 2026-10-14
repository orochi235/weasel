/**
 * Dynamic corners in path edit: drag a corner's widget to set its radius,
 * and step the selected corners through round, chamfer, and inverted.
 *
 * A drag measures how far the pointer moves along the corner's bisector and
 * turns that into a cut along the edges, clamped to the room the neighboring
 * corners leave. Pressing the widget of a selected anchor gives every
 * selected corner the same radius. The release commits one undo step.
 */
import type { Action, ImmediateInvoker, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ActionDisabledReason, isCornerWidget } from '@weasel-js/routing';
import {
  cornerFrames,
  cornerRadiusOf,
  cornerSpecAt,
  cornerTrimOf,
  nextCornerStyle,
  withCorner,
  type CornerFrame,
  type CornerStyle,
  type PolygonPath,
} from '@weasel-js/geom';
import type { EditAnchorsDep } from '../depSchema';
import { depOf, requiresAnchorSelection } from '../defaults/anchorEditing';
import { pathEditPreview } from '../edit-anchors/preview';
import { editingLayer, inPlane } from '../planeInput';

/** The style a corner with no spec yet takes. */
const DEFAULT_STYLE: CornerStyle = 'round';

/** Flat anchor index of a `corner:N` affordance kind, or null. */
function cornerIndexOf(kind: string): number | null {
  const m = kind.match(/^corner:(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function editedPath(dep: EditAnchorsDep): PolygonPath | null {
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
        if (frame) targets.push({ frame, style: cornerSpecAt(origin, i)?.style ?? DEFAULT_STYLE });
      }
      const style = cornerSpecAt(origin, index)?.style ?? DEFAULT_STYLE;
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

/** The selected anchors of the edited path that can take a corner. */
function selectedCorners(dep: EditAnchorsDep, path: PolygonPath): CornerFrame[] {
  return cornerFrames(path).filter((f) => dep.selectedAnchors.has(f.index));
}

/**
 * Step the selected corners to the next style, keeping their radii. Every
 * one takes the style after the first selected corner's, so a mixed
 * selection comes out alike. A corner with no radius yet keeps the style for
 * the drag that gives it one.
 */
export const cycleCornerStyleAction: Action & { requires: string[] } = {
  id: 'cycleCornerStyle',
  label: 'Corner style',
  group: 'anchors',
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const dep = depOf(deps);
      const path = dep && editedPath(dep);
      if (!dep || !path) return;
      const frames = selectedCorners(dep, path);
      if (frames.length === 0) return;
      const first = cornerSpecAt(path, frames[0].index);
      const style = nextCornerStyle(first?.style ?? DEFAULT_STYLE);
      let out = path;
      for (const f of frames) {
        const spec = cornerSpecAt(path, f.index);
        // A radius keeps its cut: the trim it makes is converted, not the number.
        const radius = spec
          ? cornerRadiusOf(style, cornerTrimOf(spec.style, spec.radius, f.halfAngle), f.halfAngle)
          : 0;
        out = withCorner(out, f.index, { style, radius });
      }
      dep.applyEdit(dep.editingId, out, 'Corner style');
    },
  } as ImmediateInvoker,
  enabled: (deps) => {
    const selection = requiresAnchorSelection(deps);
    if (selection !== true) return selection;
    const dep = depOf(deps);
    const path = dep && editedPath(dep);
    return dep && path && selectedCorners(dep, path).length > 0
      ? true
      : ActionDisabledReason.NotApplicable;
  },
};
