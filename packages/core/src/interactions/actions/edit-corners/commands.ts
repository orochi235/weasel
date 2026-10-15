/**
 * Commands on the corners of the anchors selected in path edit: set their
 * style or radius, or step their style through round, chamfer, and inverted.
 */
import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import {
  CORNER_STYLES,
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
import { DEFAULT_CORNER_STYLE, editedPath } from './action';

/** The selected anchors of the edited path that can take a corner. */
function selectedCorners(dep: EditAnchorsDep, path: PolygonPath): CornerFrame[] {
  return cornerFrames(path).filter((f) => dep.selectedAnchors.has(f.index));
}

/** What a corner command changes; a field left out is kept. */
interface CornerChange {
  style?: CornerStyle;
  radius?: number;
}

/**
 * `path` with `change` made to every corner in `frames`. A new style keeps
 * the cut a radius makes, converting the number, and a radius is clamped to
 * the room each corner has.
 */
function changeCorners(path: PolygonPath, frames: readonly CornerFrame[], change: CornerChange): PolygonPath {
  let out = path;
  for (const f of frames) {
    const spec = cornerSpecAt(path, f.index);
    const style = change.style ?? spec?.style ?? DEFAULT_CORNER_STYLE;
    const trim = change.radius !== undefined
      ? cornerTrimOf(style, Math.max(0, change.radius), f.halfAngle)
      : spec ? cornerTrimOf(spec.style, spec.radius, f.halfAngle) : 0;
    out = withCorner(out, f.index, {
      style,
      radius: cornerRadiusOf(style, Math.min(trim, f.maxTrim), f.halfAngle),
    });
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

const isStyle = (v: unknown): v is CornerStyle => CORNER_STYLES.includes(v as CornerStyle);

/**
 * Set the selected corners' style, radius, or both, from the `style` and
 * `radius` params; each is left alone when its param is absent. A UI
 * control's action: it has no default binding.
 */
export const setCornersAction: Action & { requires: string[] } = {
  id: 'setCorners',
  label: 'Set corners',
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const style = isStyle(params?.style) ? params.style : undefined;
      const radius = typeof params?.radius === 'number' && Number.isFinite(params.radius) ? params.radius : undefined;
      if (style === undefined && radius === undefined) return;
      commitChange(deps, 'Set corners', () => ({
        ...(style ? { style } : {}),
        ...(radius !== undefined ? { radius } : {}),
      }));
    },
  } as ImmediateInvoker,
  enabled: cornersSelected,
};

/**
 * Step the selected corners to the next style, keeping their cut. Every one
 * takes the style after the first selected corner's, so a mixed selection
 * comes out alike. A corner with no radius yet keeps the style for the drag
 * that gives it one.
 */
export const cycleCornerStyleAction: Action & { requires: string[] } = {
  id: 'cycleCornerStyle',
  label: 'Corner style',
  group: 'anchors',
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => commitChange(deps, 'Corner style', (frames, path) => {
      const next = nextCornerStyle(cornerSpecAt(path, frames[0].index)?.style ?? DEFAULT_CORNER_STYLE);
      return { style: next };
    }),
  } as ImmediateInvoker,
  enabled: cornersSelected,
};
