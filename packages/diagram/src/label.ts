/**
 * A label on an edge: an ordinary leaf node that derives its *pose* from the
 * route it sits on.
 *
 * It reads the edge's resolved path off its dependency rather than routing
 * again, so the label and the arrowhead can never disagree about where the
 * edge went. Everything else about it is a normal scene node — its own size,
 * data, styling, z-order and selection.
 */
import {
  AUTO_POSE_DESCRIPTOR,
  translatePoseViaDescriptor,
  type DerivedDep,
  type PoseDescriptor,
} from '@weasel-js/core';
import { diagramLabelOf } from './labelTrait';
import { labelCenter } from './labels/station';

export { labelCenter };

/** Options for {@link labelDerivePose}. `geometry` defaults to the kit's
 *  `AUTO_POSE_DESCRIPTOR`. */
export interface LabelPoseOptions<TPose> {
  geometry?: PoseDescriptor<TPose>;
}

/**
 * A `derivePose` that stations a label along its dependency's path.
 *
 * Returns `null` — nothing derived, so the node keeps its authored pose —
 * when the node carries no label trait, when the dependency is gone, or when
 * the dependency derives no path. A label that snapped to the origin because
 * its edge was deleted is worse than one that stayed where the author left it.
 */
export function labelDerivePose<TPose>(
  opts: LabelPoseOptions<TPose> = {},
): (node: { pose: TPose; data: unknown }, deps: readonly (DerivedDep<TPose> | undefined)[]) => TPose | null {
  const geometry = opts.geometry ?? (AUTO_POSE_DESCRIPTOR as PoseDescriptor<TPose>);

  return (node, deps) => {
    const label = diagramLabelOf(node);
    if (label === null) return null;
    const path = deps[0]?.path ?? null;
    if (path === null) return null;

    const bounds = geometry.getBounds(node.pose);
    const center = labelCenter(path, label, bounds);
    if (center === null) return null;

    return translatePoseViaDescriptor(
      node.pose,
      center.x - (bounds.x + bounds.width / 2),
      center.y - (bounds.y + bounds.height / 2),
      geometry,
    );
  };
}

/** Registry key for {@link LABEL_DERIVE_POSE}. */
export const DIAGRAM_LABEL = 'diagram:label';

/** The default label derivation, as one stable function reference so `toJSON`
 *  can find its key. */
export const LABEL_DERIVE_POSE = labelDerivePose<unknown>();
