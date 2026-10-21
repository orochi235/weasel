import type { Action, ActionDeps } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { Scene } from 'core/scene/types';
import { commitTransformOps, transformApplyOps } from '../transformFinish';
import { DUPLICATE_OFFSET, duplicateSelection } from '../defaults/duplicate';
import { translateSelection } from '../defaults/nudge';
import { requiresSelection } from '../defaults/requiresSelection';
import { poseDescriptorOf } from '../poseDescriptorDep';
import { resizeSelectionOps } from '../resize/replay';
import { rotateSelectionOps } from '../rotate/replay';
import { lastTransform, recordTransform, type RepeatableTransform } from './memory';
import { icon } from '../../../icons.gen';

const LABEL = 'Transform Again';

/** With nothing recorded yet, a repeat is a plain duplicate. */
const FIRST: RepeatableTransform = { kind: 'duplicate', dx: DUPLICATE_OFFSET, dy: DUPLICATE_OFFSET };

function commit(deps: ActionDeps, ops: Op[]): boolean {
  return commitTransformOps(deps, ops, LABEL);
}

/** Apply `t` to the selection as one undo entry. Returns the ids selected
 *  afterwards, or null when nothing changed. */
function replay(deps: ActionDeps, scene: Scene<unknown, string, unknown>, t: RepeatableTransform): readonly string[] | null {
  const selection = deps.selection!;
  const selected = selection.get() as string[];
  switch (t.kind) {
    case 'duplicate':
      return duplicateSelection(deps, t.dx, t.dy, LABEL);
    case 'translate':
      return translateSelection(
        selection, scene, t.dx, t.dy, transformApplyOps(deps), deps.geometryProjection,
        poseDescriptorOf(deps.poseDescriptor), LABEL,
      ) ? selected : null;
    case 'rotate':
      return commit(deps, rotateSelectionOps(
        scene, selected, deps, t.angle, t.pivot, LABEL,
      )) ? selected : null;
    case 'scale':
      return commit(deps, resizeSelectionOps(scene, selected, t.anchor, t.to, deps, LABEL)) ? selected : null;
  }
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
  group: 'edit',
  defaultBinding: [{ spec: { kind: 'key', key: 'd', mods: { mod: true } }, opts: { id: 'transformAgain.key' } }],
  eligible: { capability: 'transforms-selection' },
  requires: [
    'scene', 'selection', 'applyOps', 'poseDescriptor', 'geometryProjection', 'resizePolicy', 'view',
    'boundsIncludeStroke', 'transformFollowers',
  ],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const scene = deps.scene;
      if (!scene || !deps.selection || deps.selection.get().length === 0) return;
      const t = lastTransform(scene) ?? FIRST;
      const subject = replay(deps, scene, t);
      if (subject) recordTransform(scene, t, subject);
    },
  },
  enabled: requiresSelection,
};
