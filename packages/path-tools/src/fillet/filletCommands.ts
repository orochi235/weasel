/**
 * Commands on the corners of the anchors selected in path edit: set their
 * shape or radius, or step their shape through the `corner-shape` keywords.
 */
import { type ActionDeps, ActionDisabledReason, defineAction } from '@weasel-js/routing';
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
import { ANCHORS_GROUP, pathOperationTags, type EditAnchorsDep } from '@weasel-js/core';
import { openPathEditOf, requiresAnchorSelection } from '../pathEdit/anchorEditing';
import { DEFAULT_FILLET_SHAPE, editedPath } from './editFillet';
import { icon } from '../icons.gen';
import type { SetFilletsParams } from '../actionParamSchema';

/** The share of a corner's room that a shape given to a sharp corner cuts. */
export const DEFAULT_FILLET_TRIM_SHARE = 0.25;

const CYCLE_LABEL = 'Next fillet shape';

/** What `cycleFillet` reads from its params. */
export type CycleFilletParams = {
  /** The share of a sharp corner's room its new shape cuts. Default {@link DEFAULT_FILLET_TRIM_SHARE}. */
  share?: number;
};

/** Next fillet shape's params as a form, for the last-operation panel. */
export const CYCLE_FILLET_PARAMS = pref.group(CYCLE_LABEL, {
  share: pref.number('Size for sharp corners', DEFAULT_FILLET_TRIM_SHARE, {
    description: 'How much of the room a sharp corner has its new shape cuts. A corner that already had a radius keeps it.',
    min: 0.05, max: 1, step: 0.05, control: 'slider', unit: { scale: 0.01, suffix: '%', places: 0 },
  }),
});

const shareOf = (params: Readonly<CycleFilletParams> | undefined): number => {
  const v = params?.share;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(v, 1) : DEFAULT_FILLET_TRIM_SHARE;
};

/** The selected anchors of the edited path that can take a corner. */
function selectedCorners(dep: EditAnchorsDep, path: PolygonPath): CornerFrame[] {
  return cornerFrames(path).filter((f) => dep.selectedAnchors.has(f.index));
}

/** What a corner command changes; a field left out is kept. */
interface CornerChange {
  shape?: CornerShape;
  radius?: number;
  /** The share of its room a sharp corner given a shape cuts. Default {@link DEFAULT_FILLET_TRIM_SHARE}. */
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
    const shape = change.shape ?? spec?.shape ?? DEFAULT_FILLET_SHAPE;
    let radius = Math.max(0, change.radius ?? spec?.radius ?? 0);
    if (change.shape !== undefined && change.radius === undefined && radius <= 0) {
      radius = (change.share ?? DEFAULT_FILLET_TRIM_SHARE) * f.maxTrim;
    }
    out = withCorner(out, f.index, { shape, radius: Math.min(radius, f.maxTrim) });
  }
  return out;
}

function commitChange(deps: ActionDeps | undefined, label: string, change: (frames: CornerFrame[], path: PolygonPath) => CornerChange): void {
  const dep = openPathEditOf(deps);
  const path = dep && editedPath(dep);
  if (!dep || !path) return;
  const frames = selectedCorners(dep, path);
  if (frames.length === 0) return;
  dep.applyEdit(dep.editingId, changeCorners(path, frames, change(frames, path)), label);
}

function cornersSelected(deps: ActionDeps | undefined): true | ActionDisabledReason {
  const selection = requiresAnchorSelection(deps);
  if (selection !== true) return selection;
  const dep = openPathEditOf(deps);
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
export const setFilletsAction = defineAction({
  id: 'setFillets',
  icon: icon('cornerRadius'),
  label: 'Set fillets',
  tags: pathOperationTags('command'),
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const edit = setFilletsEdit(deps, params);
      if (edit) edit.dep.applyEdit(edit.dep.editingId, edit.path, 'Set fillets');
    },
  },
  // An edit that would change nothing is disabled (ruled 2026-11-10): no shape or radius to set, or the ones
  // the corners already have.
  enabled: (deps, _at, _carried, params) => {
    const selected = cornersSelected(deps);
    if (selected !== true) return selected;
    return setFilletsEdit(deps, params) ? true : ActionDisabledReason.NotApplicable;
  },
});

/** The path `setFillets` would commit for `params`, or null when it would change nothing. */
function setFilletsEdit(
  deps: ActionDeps | undefined, params: Readonly<SetFilletsParams> | undefined,
): { dep: EditAnchorsDep; path: PolygonPath } | null {
  const shape = isCornerShape(params?.shape) ? params.shape : undefined;
  const radius = typeof params?.radius === 'number' && Number.isFinite(params.radius) ? params.radius : undefined;
  if (shape === undefined && radius === undefined) return null;
  const dep = openPathEditOf(deps);
  const path = dep && editedPath(dep);
  if (!dep || !path) return null;
  const frames = selectedCorners(dep, path);
  if (frames.length === 0) return null;
  const next = changeCorners(path, frames, { ...(shape !== undefined ? { shape } : {}), ...(radius !== undefined ? { radius } : {}) });
  return frames.some((f) => !sameCorner(cornerSpecAt(path, f.index), cornerSpecAt(next, f.index))) ? { dep, path: next } : null;
}

function sameCorner(a: ReturnType<typeof cornerSpecAt>, b: ReturnType<typeof cornerSpecAt>): boolean {
  return (a?.shape ?? null) === (b?.shape ?? null) && (a?.radius ?? 0) === (b?.radius ?? 0);
}

/**
 * Step the selected corners to the next `corner-shape` keyword, keeping
 * their radius. Every one takes the keyword after the first selected
 * corner's shape, so a mixed selection comes out alike, and a sharp corner
 * gets a radius that shows it: the `share` param of its room
 * ({@link CycleFilletParams}).
 */
export const cycleFilletAction = defineAction({
  id: 'cycleFillet',
  icon: icon('fillet'),
  label: CYCLE_LABEL,
  tags: pathOperationTags('command'),
  group: ANCHORS_GROUP,
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  params: CYCLE_FILLET_PARAMS,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => commitChange(deps, CYCLE_LABEL, (frames, path) => ({
      shape: nextCornerShape(cornerSpecAt(path, frames[0].index)?.shape ?? DEFAULT_FILLET_SHAPE),
      share: shareOf(params),
    })),
  },
  enabled: cornersSelected,
});
