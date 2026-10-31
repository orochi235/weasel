/**
 * Resample: the selected paths' anchors spread evenly along them, as one
 * command whose params the last-operation panel adjusts afterward.
 */
import { resamplePath, type ResamplePathOptions } from '@weasel-js/geom';
import { pref } from '@weasel-js/prefs';
import { type Action, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { commitOps, pathOperationTags, reshapeOps, selectedPathNodes } from '@weasel-js/core';
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

/** Resample's params as a form, for the last-operation panel. */
export const RESAMPLE_PARAMS = pref.group(LABEL, {
  count: pref.number('Anchors', 0, { description: 'How many anchors the result has; 0 keeps the count each path has.', min: 0, max: 200, step: 1 }),
  spacing: pref.number('Spacing', 0, { description: 'Distance between anchors along the path; above 0 it overrides Anchors.', min: 0, max: 200, step: 1 }),
  keepCorners: pref.boolean('Keep corners', true, { description: 'Hold corner anchors where they are.' }),
  tolerance: pref.number('Tolerance', 0.5, {
    description: 'How far the result may stray from the original.', min: 0.05, max: 5, step: 0.05, control: 'slider',
  }),
});

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** `params` as `resamplePath` options. */
function resampleOptions(params: Readonly<Record<string, unknown>>): ResamplePathOptions {
  const count = num(params.count) ?? 0;
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
 * One undo entry.
 */
export const resamplePathAction: Action & { requires: string[] } = {
  id: 'resamplePath',
  label: LABEL,
  icon: icon('resamplePath'),
  tags: pathOperationTags('command'),
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'scene', 'applyOps'],
  params: RESAMPLE_PARAMS,
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const options = resampleOptions(params ?? {});
      const ops = selectedPathNodes(deps).flatMap(({ node, path }) => reshapeOps(node, resamplePath(path, options), LABEL));
      commitOps(deps, ops, LABEL);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => (selectedPathNodes(deps).length > 0 ? true : ActionDisabledReason.SelectionRequired),
};
