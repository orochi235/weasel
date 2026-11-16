/**
 * Fillet in path edit: drag a corner's widget to set its radius.
 *
 * A drag measures how far the pointer moves along the corner's bisector and
 * turns that into a cut along the edges, clamped to the room the neighboring
 * corners leave. Pressing the widget of a selected anchor gives every
 * selected corner the same radius. The release commits one undo step.
 */
import {
  type ActionDeps, ActionDisabledReason, defineAction, isFilletWidget, type OngoingHandle, resolveParams,
} from '@weasel-js/routing';
import { pref } from '@weasel-js/prefs';
import {
  CORNER_KEYWORDS,
  cornerFrames,
  cornerSpecAt,
  withCorner,
  type CornerFrame,
  type CornerKeyword,
  type CornerShape,
  type PolygonPath,
} from '@weasel-js/geom';
import { editingLayer, inPlane, pathOperationTags, type EditAnchorsDep } from '@weasel-js/core';
import { pathEditPreview } from '../pathEdit/editAnchors/preview';
import { icon } from '../icons.gen';
import type {} from '../actionParamSchema';

/** The shape a corner with no spec yet takes. */
export const DEFAULT_FILLET_SHAPE: CornerShape = 'round';

const LABEL = 'Fillet radius';

const KEYWORD_LABELS: Record<CornerKeyword, string> = {
  square: 'Square', squircle: 'Squircle', round: 'Round', bevel: 'Bevel', scoop: 'Scoop', notch: 'Notch',
};

/** The corner-shape keywords as a form's options, for a panel. */
export const FILLET_SHAPE_OPTIONS = CORNER_KEYWORDS.map((value) => ({ value, label: KEYWORD_LABELS[value] }));

/** What `editFillet` reads from its params. */
export type EditFilletParams = {
  /** The shape a corner with no shape yet takes. Default {@link DEFAULT_FILLET_SHAPE}. */
  shape?: CornerKeyword;
};

/** A corner drag's params as a form, for the last-operation panel. */
export const EDIT_FILLET_PARAMS = pref.group(LABEL, {
  shape: pref.enum<CornerKeyword>('Shape for sharp corners', 'round', FILLET_SHAPE_OPTIONS, {
    description: 'The shape a corner that had none takes. A corner that already had a shape keeps it.',
  }),
});

const newShapeOf = (params: Readonly<EditFilletParams> | undefined): CornerShape => {
  const shape = params?.shape;
  return shape !== undefined && CORNER_KEYWORDS.includes(shape) ? shape : DEFAULT_FILLET_SHAPE;
};

/** Flat anchor index of a `fillet:N` affordance kind, or null. */
function cornerIndexOf(kind: string): number | null {
  const m = kind.match(/^fillet:(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

/** The open path, when it is a polygon. */
export function editedPath(dep: EditAnchorsDep): PolygonPath | null {
  const p = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  return p && p.kind === 'polygon' ? p : null;
}

interface CornerTarget {
  frame: CornerFrame;
  shape: CornerShape;
}

/** `path` with `radius` on every target, each clamped to the room it has. */
function withRadius(path: PolygonPath, targets: readonly CornerTarget[], radius: number): PolygonPath {
  let out = path;
  for (const { frame, shape } of targets) {
    out = withCorner(out, frame.index, { shape, radius: Math.max(0, Math.min(radius, frame.maxTrim)) });
  }
  return out;
}

/** Enabled while a path is open. */
function widgetEnabled(deps: ActionDeps | undefined): true | ActionDisabledReason {
  if (!deps?.editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
  return true;
}

/** Drag a fillet widget to set the corner's radius. A corner with no shape yet takes the `shape` param's
 *  ({@link EditFilletParams}), which the last-operation panel changes by replaying the drag. */
export const editFilletAction = inPlane(defineAction({
  id: 'editFillet',
  icon: icon('cornerRadius'),
  label: LABEL,
  tags: pathOperationTags('drag'),
  // Ties the marquee's `empty` and move's `selected-body` on specificity and
  // registers ahead of the marquee; move turns path-edit presses down itself.
  defaultBinding: [{ spec: { kind: 'drag', target: { kindOf: isFilletWidget } }, opts: { id: 'editFillet.drag' } }],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  params: EDIT_FILLET_PARAMS,
  invoker: {
    timing: 'ongoing',
    start(ctx, opts): OngoingHandle<EditFilletParams> {
      const dep = ctx.deps.editAnchors;
      const index = cornerIndexOf(ctx.drag?.affordance?.kind ?? '');
      if (!dep?.editingId || index === null) return {};
      const origin = editedPath(dep);
      if (!origin) return {};
      const frames = new Map(cornerFrames(origin).map((f) => [f.index, f]));
      const pressed = frames.get(index);
      if (!pressed) return {};
      const indices = dep.selectedAnchors.has(index) ? [...dep.selectedAnchors] : [index];
      const targetsFor = (params: Readonly<EditFilletParams> | undefined): CornerTarget[] => {
        const fresh = newShapeOf(params);
        const out: CornerTarget[] = [];
        for (const i of indices) {
          const frame = frames.get(i);
          if (frame) out.push({ frame, shape: cornerSpecAt(origin, i)?.shape ?? fresh });
        }
        return out;
      };
      const press = ctx.drag?.start ?? ctx.world;
      let current: PolygonPath = origin;
      let trim = pressed.trim;
      let active = false;
      const preview = pathEditPreview(dep, dep.editingId, () => (active ? { path: current } : null));
      if (!preview) return {};
      const id = dep.editingId;
      return {
        kind: 'edit-corner',
        onMove(move): void {
          const along = (move.world.x - press.x) * pressed.bisector.x
            + (move.world.y - press.y) * pressed.bisector.y;
          trim = Math.max(0, pressed.trim + along / Math.cos(pressed.halfAngle));
          current = withRadius(origin, targetsFor(resolveParams(opts?.params)), trim);
          active = true;
        },
        onEnd(_end, reason): void {
          active = false;
          if (reason === 'cancel' || current === origin) return;
          dep.applyEdit(id, current, LABEL);
        },
        replay(params): void {
          const again = withRadius(origin, targetsFor(params), trim);
          if (again !== origin) dep.applyEdit(id, again, LABEL);
        },
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: widgetEnabled,
}), editingLayer);
