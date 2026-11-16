import { ActionDisabledReason, eligibleNow, type Action, type ActionDeps, type ActionUnavailable, BETWEEN_GESTURES } from '@weasel-js/routing';
import type { Scene } from '@weasel-js/core/engine';
import { commitTransformOps, finishTransformOps } from '@weasel-js/core/engine';
import { duplicateAction, duplicateSelection } from '../edit/duplicate';
import { DUPLICATE_OFFSET, requiresContent, requiresSelection, lastTransform, recordTransform, type RepeatableTransform } from '@weasel-js/core';
import { selectionTransformOps } from './transformSelection';
import { icon } from '../../icons.gen';

const LABEL = 'Transform Again';

/** With nothing recorded yet, a repeat is a plain duplicate. */
const FIRST: RepeatableTransform = { kind: 'duplicate', dx: DUPLICATE_OFFSET, dy: DUPLICATE_OFFSET };

type AnyScene = Scene<unknown, string, unknown>;

/** Whether repeating `t` now would change anything: a duplicate where the
 *  mode lets Duplicate run and the selection holds content, a transform
 *  where it builds a batch the followers accept. */
function canRepeat(deps: ActionDeps, scene: AnyScene, t: RepeatableTransform): true | ActionUnavailable {
  if (t.kind === 'duplicate') {
    if (!eligibleNow(duplicateAction, deps.ruleCtx)) return ActionDisabledReason.NotApplicable;
    return requiresContent(1)(deps);
  }
  const ops = selectionTransformOps(deps, scene, [...deps.operands!.get()] as string[], t, LABEL);
  const all = ops.length > 0 ? finishTransformOps(deps, ops, LABEL) : null;
  return all && all.length > 0 ? true : ActionDisabledReason.NotApplicable;
}

/** Apply `t` to the selection as one undo entry. Returns the ids selected
 *  afterwards, or null when nothing changed. */
function replay(deps: ActionDeps, scene: AnyScene, t: RepeatableTransform): readonly string[] | null {
  if (t.kind === 'duplicate') return duplicateSelection(deps, t.dx, t.dy, LABEL);
  const selected = [...deps.operands!.get()] as string[];
  return commitTransformOps(deps, selectionTransformOps(deps, scene, selected, t, LABEL), LABEL) ? selected : null;
}

/**
 * Repeat the last move, rotate, resize, nudge, duplicate, or Alt-drag clone on
 * the current selection, as one undo entry. A repeated duplicate copies the
 * selection — the last copies — again by the same offset, so pressing it over
 * and over makes a step-and-repeat; moving the copies between a duplicate and
 * its repeat changes that offset. With nothing to repeat it duplicates.
 */
export const transformAgainAction: Action & { requires: string[] } = {
  id: 'transformAgain',
  label: LABEL,
  icon: icon('core:transformAgain'),
  group: 'edit',
  defaultBinding: [{ spec: { kind: 'key', key: 'd', mods: { mod: true }, phase: BETWEEN_GESTURES }, opts: { id: 'transformAgain.key' } }],
  eligible: { capability: 'transforms-selection' },
  requires: [
    'scene', 'operands', 'applyOps', 'poseDescriptor', 'geometryProjection', 'resizePolicy', 'view',
    'boundsIncludeStroke', 'drawnBoxes', 'transformFollowers', 'ruleCtx',
  ],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene;
      if (!scene || !deps.operands || deps.operands.get().length === 0) return;
      const t = lastTransform(scene) ?? FIRST;
      if (canRepeat(deps, scene, t) !== true) return;
      const subject = replay(deps, scene, t);
      if (subject) recordTransform(scene, t, subject);
    },
  },
  enabled: (deps) => {
    const selected = requiresSelection(deps);
    if (selected !== true || !deps?.scene) return selected;
    return canRepeat(deps, deps.scene, lastTransform(deps.scene) ?? FIRST);
  },
};
