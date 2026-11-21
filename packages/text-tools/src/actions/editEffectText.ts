/**
 * In path edit on a path an effect hides, the effect is lit and a click on it
 * opens its text, since the effect is what draws that text.
 */
import type { ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction, isBody } from '@weasel-js/routing';
import { effectSourceFor, type NodeId } from '@weasel-js/core';
import type {} from '../actionParamSchema';
import type {} from '../editor/textEditDep';

/** The text source a click at `world` opens, or null. */
function textUnder(deps: ActionDeps | undefined, world: { x: number; y: number } | undefined): string | null {
  const scene = deps?.scene;
  const open = deps?.editAnchors;
  if (!world || !scene || !deps?.textEdit || !open?.editingId) return null;
  const under = deps.nodeAtPoint?.(world);
  if (!under) return null;
  const text = effectSourceFor(scene, under as NodeId, 'items');
  if (text === null || scene.isLocked(text) || open.anchorUnder(world) !== -1) return null;
  return String(text);
}

/** A click on a text-on-path effect's body opens its source text for editing, unless an anchor is under the pointer. */
export const editEffectTextAction = defineAction({
  id: 'editEffectText',
  label: 'Edit text along the path',
  // On the effect's body, so it outranks the untargeted anchor click; an anchor under the pointer gives the click back.
  defaultBinding: [{ spec: { kind: 'click', target: { kindOf: isBody }, mods: {} }, opts: { id: 'editEffectText.click' } }],
  eligible: { capability: 'edits-anchors' },
  requires: ['textEdit', 'nodeAtPoint', 'scene', 'editAnchors'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const hit = textUnder(deps, params?.world);
      if (hit !== null) deps.textEdit?.startEdit(hit, { caret: 'end' });
    },
  },
  enabled: (deps, at) => (textUnder(deps, at) !== null ? true : ActionDisabledReason.NotApplicable),
});
