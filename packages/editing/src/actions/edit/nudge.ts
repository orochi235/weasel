import { ActionDisabledReason, type Action } from '@weasel-js/routing';
import { requiresContent, operandContent, moveNodesOps, nudgeSpec, NUDGE_LABEL, nudgeDelta, type NudgeDirection, recordTransform } from '@weasel-js/core';
import { NUDGE_GROUP } from '../../actionGroups';
import { commitTransform, transformAnswer } from '../lockedWrites';

/**
 * The nudge descriptor for one direction: bare arrow (magnitude='small') and
 * Shift+arrow (magnitude='big').
 */
function makeNudgeAction(dir: NudgeDirection): Action & { requires: string[] } {
  return {
    id: `nudge.${dir}`,
    label: `Nudge ${NUDGE_LABEL[dir]}`,
    group: NUDGE_GROUP,
    defaultBinding: [
      { spec: nudgeSpec(dir, false), opts: { id: `nudge.${dir}.small`, params: { magnitude: 'small' } } },
      { spec: nudgeSpec(dir, true), opts: { id: `nudge.${dir}.big`, params: { magnitude: 'big' } } },
    ],
    eligible: { capability: 'transforms-selection' },
    requires: ['operands', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'transformFollowers'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const { dx, dy } = nudgeDelta(dir, params?.magnitude);
        const selection = deps.operands;
        const scene = deps.scene;
        if (!selection || !scene) return;
        const ops = moveNodesOps(scene, selection.get() as readonly string[], { dx, dy }, deps, 'Nudge');
        if (commitTransform(deps, scene, ops, 'Nudge')) {
          recordTransform(scene, { kind: 'translate', dx, dy }, operandContent(deps));
        }
      },
    },
    // On while some selected node would move: a step rounding absorbs moves nothing (2026-11-10 ruling).
    enabled: (deps, _at, _carried, params) => {
      const given = requiresContent(1)(deps);
      if (given !== true) return given;
      if (!deps?.scene) return ActionDisabledReason.NotApplicable;
      const { dx, dy } = nudgeDelta(dir, params?.magnitude);
      return transformAnswer(deps, deps.scene, moveNodesOps(deps.scene, operandContent(deps), { dx, dy }, deps, 'Nudge'), 'Nudge');
    },
  };
}

/** Nudge up: the Up arrow, a big step with Shift. */
export const nudgeUpAction    = makeNudgeAction('up');
/** Nudge down: the Down arrow, a big step with Shift. */
export const nudgeDownAction  = makeNudgeAction('down');
/** Nudge left: the Left arrow, a big step with Shift. */
export const nudgeLeftAction  = makeNudgeAction('left');
/** Nudge right: the Right arrow, a big step with Shift. */
export const nudgeRightAction = makeNudgeAction('right');
