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
  pointAlongPath,
  translatePoseViaDescriptor,
  type DerivedDep,
  type PoseDescriptor,
} from '@weasel-js/core';

/** Where along an edge a label sits. */
export interface DiagramLabel {
  /** `'start'`, `'mid'` and `'end'` are 0, 0.5 and 1; a number is that
   *  fraction of the route's length. */
  at: 'start' | 'mid' | 'end' | number;
  /** World units perpendicular to the route, to the **left of the direction of
   *  travel** — above a left-to-right edge. Default 0, which centers the label
   *  on the line. */
  offset?: number;
}

const NAMED = { start: 0, mid: 0.5, end: 1 } as const;

/** The label trait on a node's data, or `null`. */
export function diagramLabelOf(node: { data: unknown }): DiagramLabel | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as { diagram?: unknown }).diagram;
  if (trait === null || typeof trait !== 'object') return null;
  const label = (trait as { label?: unknown }).label;
  if (label === null || typeof label !== 'object') return null;
  return 'at' in label ? (label as DiagramLabel) : null;
}

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

    const t = typeof label.at === 'number' ? label.at : NAMED[label.at] ?? 0.5;
    const station = pointAlongPath(path, t);
    if (station === null) return null;

    const offset = label.offset ?? 0;
    // Left of travel: with y down, that is above an edge running rightward.
    const x = station.point.x + station.tangent.y * offset;
    const y = station.point.y - station.tangent.x * offset;

    const bounds = geometry.getBounds(node.pose);
    return translatePoseViaDescriptor(
      node.pose,
      x - (bounds.x + bounds.width / 2),
      y - (bounds.y + bounds.height / 2),
      geometry,
    );
  };
}

/** Registry key for {@link LABEL_DERIVE_POSE}. */
export const DIAGRAM_LABEL = 'diagram:label';

/** The default label derivation, as one stable function reference so `toJSON`
 *  can find its key. */
export const LABEL_DERIVE_POSE = labelDerivePose<unknown>();
