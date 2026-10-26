/**
 * Resample: the selected paths' anchors spread evenly along them, as an
 * ongoing action so a control can preview it and commit once.
 */
import { resamplePath, type ResamplePathOptions } from '@weasel-js/geom';
import { livePathEdit, reshapeOps } from '@weasel-js/core';
import { icon } from '../icons.gen';

const LABEL = 'Resample';

/** What the `resamplePath` action reads from its params. */
export type ResamplePathParams = {
  /** Anchors in the result. 0 or absent keeps the count the path has. */
  count?: number;
  /** Distance between anchors along the path; overrides `count` when above 0. */
  spacing?: number;
  /** Hold corner anchors where they are. Default `true`. */
  keepCorners?: boolean;
  /** How far the result may stray from the original. Default 0.5. */
  tolerance?: number;
};

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** `params` as `resamplePath` options, with `count` given as `count`. */
function resampleOptions(count: number, params: Readonly<Record<string, unknown>>): ResamplePathOptions {
  const spacing = num(params.spacing);
  const tolerance = num(params.tolerance);
  return {
    ...(spacing !== undefined && spacing > 0 ? { spacing } : count > 0 ? { count } : {}),
    ...(tolerance !== undefined ? { tolerance } : {}),
    keepCorners: params.keepCorners !== false,
  };
}

/**
 * Redistribute each selected path's anchors evenly by arc length
 * (`resamplePath`), to `params.count` anchors or at `params.spacing`, with
 * corners held unless `params.keepCorners` is false, and curves refitted
 * within `params.tolerance` of the original ({@link ResamplePathParams}).
 * Ongoing: `begin` previews it, each update with new params recomputes it,
 * and committing writes one undo entry.
 */
export const resamplePathAction = livePathEdit({
  id: 'resamplePath',
  label: LABEL,
  icon: icon('resamplePath'),
  param: 'count',
  initial: 0,
  edit: ({ path }, count, params) => resamplePath(path, resampleOptions(count, params)),
  commit: (_deps, next) => [...next.values()].flatMap(({ node, path }) => reshapeOps(node.node, path, LABEL)),
});
