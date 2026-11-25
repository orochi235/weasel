import { ActionDisabledReason, eligibleNow, type Action, type ActionDeps, type ActionUnavailable, BETWEEN_GESTURES } from '@weasel-js/routing';
import type { Scene } from '@weasel-js/core/engine';
import { duplicateAction, duplicateSelection } from '../edit/duplicate';
import { DUPLICATE_OFFSET, requiresContent, requiresOperands, lastTransform, recordTransform, type RepeatableTransform } from '@weasel-js/core';
import { selectionTransformAnswer, selectionTransformOps } from './transformSelection';
import { icon } from '../../icons.gen';
import { commitTransform } from '../lockedWrites';
import { EDIT_GROUP } from '../../actionGroups';

const LABEL = 'Transform Again';

/** With nothing recorded yet, a repeat is a plain duplicate. */
const FIRST: RepeatableTransform = { kind: 'duplicate', dx: DUPLICATE_OFFSET, dy: DUPLICATE_OFFSET };

type AnyScene = Scene<unknown, string, unknown>;

/** Whether repeating `t` now would change anything: a duplicate where the
 *  mode lets Duplicate run and the selection holds content, a transform
 *  where it builds a batch the followers accept. */
function canRepeat(deps: ActionDeps, t: RepeatableTransform): true | ActionUnavailable {
  if (t.kind === 'duplicate') {
    if (!eligibleNow(duplicateAction, deps.ruleCtx)) return ActionDisabledReason.NotApplicable;
    return requiresContent(1)(deps);
  }
  return selectionTransformAnswer(deps, t, LABEL);
}

/** Apply `t` to the selection as one undo entry. Returns the ids selected
 *  afterwards, or null when nothing changed. */
function replay(deps: ActionDeps, scene: AnyScene, t: RepeatableTransform): readonly string[] | null {
  if (t.kind === 'duplicate') return duplicateSelection(deps, t.dx, t.dy, LABEL);
  const selected = [...deps.operands!.get()] as string[];
  const ops = selectionTransformOps(deps, scene, selected, t, LABEL);
  return commitTransform(deps, scene, ops, LABEL) ? selected : null;
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
  icon: icon('transformAgain'),
  group: EDIT_GROUP,
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
      if (canRepeat(deps, t) !== true) return;
      const subject = replay(deps, scene, t);
      if (subject) recordTransform(scene, t, subject);
    },
  },
  enabled: (deps) => {
    const selected = requiresOperands(deps);
    if (selected !== true) return selected;
    if (!deps?.scene) return ActionDisabledReason.NotApplicable;
    return canRepeat(deps, lastTransform(deps.scene) ?? FIRST);
  },
};
