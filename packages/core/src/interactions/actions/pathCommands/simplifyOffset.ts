/**
 * Simplify and Offset Path: the two path commands driven by a number. Both
 * are ongoing actions so a slider can preview them live and commit once —
 * `useOngoingAction('simplifyPath').input({ tolerance })`, then `.commit()`.
 */
import { simplifyPath } from '@weasel-js/geom';
import { offsetPath, type OffsetPathOptions } from '@weasel-js/stroke';
import { DEFAULT_MITER_LIMIT } from '@weasel-js/paint';
import { pref, type PrefNumber } from '@weasel-js/prefs';
import type { Op } from 'core/ops/types';
import { livePathEdit } from './livePathEdit';
import { insertAt, pathCopy, reshapeOps, slotOf } from './pathNodes';
import { icon } from '../../../icons.gen';

/** Simplify's tolerance when none is given: world units off the original. */
export const DEFAULT_SIMPLIFY_TOLERANCE = 1;

/** Simplify's params as a form: the slider's range, and the last-operation panel's after a commit. */
export const SIMPLIFY_PATH_PARAMS = pref.group('Simplify', {
  tolerance: {
    kind: 'number', name: 'Tolerance', default: DEFAULT_SIMPLIFY_TOLERANCE, control: 'slider', min: 0.1, max: 20, step: 0.1,
    description: 'How far the refit outline may stray from the original, in world units.',
  } satisfies PrefNumber,
});

/** Offset Path's params as a form: the slider's range, and the last-operation panel's after a commit. */
export const OFFSET_PATH_PARAMS = pref.group('Offset Path', {
  distance: {
    kind: 'number', name: 'Distance', default: 0, control: 'slider', min: -50, max: 50, step: 0.5,
    description: 'How far the outline grows, in world units; below 0 it shrinks.',
  } satisfies PrefNumber,
  join: pref.enum('Corners', 'miter', [{ value: 'miter', label: 'Miter' }, { value: 'round', label: 'Round' }, { value: 'bevel', label: 'Bevel' }], {
    description: 'How the outline turns a corner.', control: 'toggle',
  }),
  miterLimit: pref.number('Miter limit', DEFAULT_MITER_LIMIT, {
    description: 'Past this ratio of a miter corner\'s length to the distance, the corner is beveled.', min: 1, max: 20, step: 0.5,
    showIf: { path: 'join', is: 'miter' },
  }),
});

const JOINS = new Set<unknown>(['miter', 'round', 'bevel']);

/** The corners `params` asks Offset Path for. */
function offsetOptions(params: Readonly<Record<string, unknown>>): OffsetPathOptions {
  const { join, miterLimit } = params;
  return {
    ...(JOINS.has(join) ? { join: join as OffsetPathOptions['join'] } : {}),
    ...(typeof miterLimit === 'number' && miterLimit >= 1 ? { miterLimit } : {}),
  };
}

/**
 * Refit each selected path with as few anchors as keep it
 * within `params.tolerance` of where it was (`simplifyPath`).
 */
export const simplifyPathAction = livePathEdit({
  id: 'simplifyPath',
  label: 'Simplify',
  icon: icon('simplify'),
  param: 'tolerance',
  params: SIMPLIFY_PATH_PARAMS,
  edit: ({ path }, tolerance) => simplifyPath(path, Math.max(tolerance, 0)),
  commit: (_deps, next) => [...next.values()].flatMap(({ node, path }) => reshapeOps(node, path, 'Simplify')),
});

/**
 * Add, beside each selected path, the outline of the region it
 * fills grown by `params.distance` (shrunk by a negative one), with
 * `params.join` corners under `params.miterLimit` (`offsetPath`). A grown outline goes behind its
 * source and a shrunk one in front, so neither hides the other; the new
 * paths are selected.
 */
export const offsetPathAction = livePathEdit({
  id: 'offsetPath',
  label: 'Offset Path',
  icon: icon('offsetPath'),
  param: 'distance',
  params: OFFSET_PATH_PARAMS,
  overlaysSource: true,
  edit: ({ path }, distance, params) => {
    if (distance === 0) return null;
    const out = offsetPath(path, distance, offsetOptions(params));
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
      const copy = pathCopy(scene, node, path);
      if (!copy) continue;
      ops.push(insertAt(copy, at < 0 || distance > 0 ? at : at + 1, 'Offset Path'));
    }
    return ops;
  },
  selectAfter: (ops) => ops.map((op) => (op.args as { node: { id: string } }).node.id),
});
