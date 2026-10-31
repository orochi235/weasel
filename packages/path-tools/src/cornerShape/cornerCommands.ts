/**
 * Commands on the corners of the anchors selected in path edit: set their
 * shape or radius, or step their shape through the `corner-shape` keywords.
 */
import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import {
  cornerFrames,
  cornerSpecAt,
  isCornerShape,
  nextCornerShape,
  withCorner,
  type CornerFrame,
  type CornerShape,
  type PolygonPath,
} from '@weasel-js/geom';
import { pref } from '@weasel-js/prefs';
import { depOf, pathOperationTags, requiresAnchorSelection, type EditAnchorsDep } from '@weasel-js/core';
import { DEFAULT_CORNER_SHAPE, editedPath } from './editCorner';
import { icon } from '../icons.gen';

/** The share of a corner's room that a shape given to a sharp corner cuts. */
export const DEFAULT_CORNER_TRIM_SHARE = 0.25;

const CYCLE_LABEL = 'Next corner shape';

/** What `cycleCornerShape` reads from its params. */
export interface CycleCornerShapeParams {
  /** The share of a sharp corner's room its new shape cuts. Default {@link DEFAULT_CORNER_TRIM_SHARE}. */
  share?: number;
}

/** Next corner shape's params as a form, for the last-operation panel. */
export const CYCLE_CORNER_SHAPE_PARAMS = pref.group(CYCLE_LABEL, {
  share: pref.number('Size for sharp corners', DEFAULT_CORNER_TRIM_SHARE, {
    description: 'How much of the room a sharp corner has its new shape cuts. A corner that already had a radius keeps it.',
    min: 0.05, max: 1, step: 0.05, control: 'slider', unit: { scale: 0.01, suffix: '%', precision: 0 },
  }),
});

const shareOf = (params: Record<string, unknown> | undefined): number => {
  const v = params?.share;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(v, 1) : DEFAULT_CORNER_TRIM_SHARE;
};

/** The selected anchors of the edited path that can take a corner. */
function selectedCorners(dep: EditAnchorsDep, path: PolygonPath): CornerFrame[] {
  return cornerFrames(path).filter((f) => dep.selectedAnchors.has(f.index));
}

/** What a corner command changes; a field left out is kept. */
interface CornerChange {
  shape?: CornerShape;
  radius?: number;
  /** The share of its room a sharp corner given a shape cuts. Default {@link DEFAULT_CORNER_TRIM_SHARE}. */
  share?: number;
}

/**
 * `path` with `change` made to every corner in `frames`, each radius clamped
 * to the room its corner has. A shape given to a sharp corner, with no
 * radius, cuts `change.share` of its room: every shape looks alike at no
 * radius.
 */
function changeCorners(path: PolygonPath, frames: readonly CornerFrame[], change: CornerChange): PolygonPath {
  let out = path;
  for (const f of frames) {
    const spec = cornerSpecAt(path, f.index);
    const shape = change.shape ?? spec?.shape ?? DEFAULT_CORNER_SHAPE;
    let radius = Math.max(0, change.radius ?? spec?.radius ?? 0);
    if (change.shape !== undefined && change.radius === undefined && radius <= 0) {
      radius = (change.share ?? DEFAULT_CORNER_TRIM_SHARE) * f.maxTrim;
    }
    out = withCorner(out, f.index, { shape, radius: Math.min(radius, f.maxTrim) });
  }
  return out;
}

function commitChange(deps: ActionDeps | undefined, label: string, change: (frames: CornerFrame[], path: PolygonPath) => CornerChange): void {
  const dep = depOf(deps);
  const path = dep && editedPath(dep);
  if (!dep || !path) return;
  const frames = selectedCorners(dep, path);
  if (frames.length === 0) return;
  dep.applyEdit(dep.editingId, changeCorners(path, frames, change(frames, path)), label);
}

function cornersSelected(deps: ActionDeps | undefined): true | ActionDisabledReason {
  const selection = requiresAnchorSelection(deps);
  if (selection !== true) return selection;
  const dep = depOf(deps);
  const path = dep && editedPath(dep);
  return dep && path && selectedCorners(dep, path).length > 0 ? true : ActionDisabledReason.NotApplicable;
}

/**
 * Set the selected corners' shape, radius, or both, from the `shape` (a
 * keyword or a finite `superellipse()` parameter) and `radius` params; each
 * is left alone when its param is absent, except that a shape given to a
 * sharp corner also gives it a radius. A UI control's action: it has no
 * default binding.
 */
export const setCornersAction: Action & { requires: string[] } = {
  id: 'setCorners',
  icon: icon('cornerRadius'),
  label: 'Set corners',
  tags: pathOperationTags('command'),
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const shape = isCornerShape(params?.shape) ? params.shape : undefined;
      const radius = typeof params?.radius === 'number' && Number.isFinite(params.radius) ? params.radius : undefined;
      if (shape === undefined && radius === undefined) return;
      commitChange(deps, 'Set corners', () => ({
        ...(shape !== undefined ? { shape } : {}),
        ...(radius !== undefined ? { radius } : {}),
      }));
    },
  } as ImmediateInvoker,
  enabled: cornersSelected,
};

/**
 * Step the selected corners to the next `corner-shape` keyword, keeping
 * their radius. Every one takes the keyword after the first selected
 * corner's shape, so a mixed selection comes out alike, and a sharp corner
 * gets a radius that shows it: the `share` param of its room
 * ({@link CycleCornerShapeParams}).
 */
export const cycleCornerShapeAction: Action & { requires: string[] } = {
  id: 'cycleCornerShape',
  icon: icon('cornerShape'),
  label: CYCLE_LABEL,
  tags: pathOperationTags('command'),
  group: 'anchors',
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  params: CYCLE_CORNER_SHAPE_PARAMS,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => commitChange(deps, CYCLE_LABEL, (frames, path) => ({
      shape: nextCornerShape(cornerSpecAt(path, frames[0].index)?.shape ?? DEFAULT_CORNER_SHAPE),
      share: shareOf(params),
    })),
  } as ImmediateInvoker,
  enabled: cornersSelected,
};
