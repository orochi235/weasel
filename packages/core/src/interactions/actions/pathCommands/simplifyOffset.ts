/**
 * Simplify and Offset Path: the two path commands driven by a number. Both
 * are ongoing actions so a slider can preview them live and commit once —
 * `useOngoingAction('simplifyPath').input({ tolerance })`, then `.commit()`.
 */
import { simplifyPath } from '@weasel-js/geom';
import { offsetPath } from '@weasel-js/stroke';
import type { Op } from 'core/ops/types';
import { livePathEdit } from './livePathEdit';
import { insertAt, pathCopy, reshapeOps, slotOf } from './pathNodes';
import { icon } from '../../../icons.gen';

/** Simplify's tolerance when none is given: world units off the original. */
export const DEFAULT_SIMPLIFY_TOLERANCE = 1;

/**
 * Refit each selected path with as few anchors as keep it
 * within `params.tolerance` of where it was (`simplifyPath`).
 */
export const simplifyPathAction = livePathEdit({
  id: 'simplifyPath',
  label: 'Simplify',
  icon: icon('simplify'),
  param: 'tolerance',
  initial: DEFAULT_SIMPLIFY_TOLERANCE,
  edit: ({ path }, tolerance) => simplifyPath(path, Math.max(tolerance, 0)),
  commit: (_deps, next) => [...next.values()].flatMap(({ node, path }) => reshapeOps(node.node, path, 'Simplify')),
});

/**
 * Add, beside each selected path, the outline of the region it
 * fills grown by `params.distance` (shrunk by a negative one), with
 * `params.join` corners (`offsetPath`). A grown outline goes behind its
 * source and a shrunk one in front, so neither hides the other; the new
 * paths are selected.
 */
export const offsetPathAction = livePathEdit({
  id: 'offsetPath',
  label: 'Offset Path',
  icon: icon('offsetPath'),
  param: 'distance',
  initial: 0,
  overlaysSource: true,
  edit: ({ path }, distance) => {
    if (distance === 0) return null;
    const out = offsetPath(path, distance);
    return out.commands.length > 0 ? out : null;
  },
  commit: (deps, next, distance) => {
    const scene = deps.scene;
    if (!scene) return [];
    // Top slot first, so an insert cannot shift a later one's index.
    const placed = [...next.values()]
      .map((entry) => ({ ...entry, at: slotOf(scene, entry.node.id) }))
      .sort((a, b) => b.at - a.at);
    const ops: Op[] = [];
    for (const { node, path, at } of placed) {
      const copy = pathCopy(scene, node.node, path);
      if (!copy) continue;
      ops.push(insertAt(copy, at < 0 || distance > 0 ? at : at + 1, 'Offset Path'));
    }
    return ops;
  },
  selectAfter: (ops) => ops.map((op) => (op.args as { node: { id: string } }).node.id),
});
