/**
 * In path edit on a path an effect hides, the effect is lit and a click on it
 * opens its text, since the effect is what draws that text.
 */
import type { ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction, isBody } from '@weasel-js/routing';
import { isTextData } from '@weasel-js/text';
import { anchorUnder, depOf, effectSourceFor, type NodeId } from '@weasel-js/core';
import type {} from '../actionParamSchema';
import type {} from '../editor/textEditDep';

/** The text source a click at `world` opens, with its length, or null. */
function textUnder(deps: ActionDeps | undefined, world: { x: number; y: number } | undefined): { id: string; length: number } | null {
  const scene = deps?.scene;
  if (!world || !scene || !deps?.textEdit || !depOf(deps)) return null;
  const under = deps.nodeAtPoint?.(world);
  if (!under) return null;
  const text = effectSourceFor(scene, under as NodeId, 'items');
  if (text === null || scene.isLocked(text) || anchorUnder(deps, world) !== -1) return null;
  const data = scene.get(text)?.data;
  return { id: String(text), length: isTextData(data) ? data.text.length : 0 };
}

export const editEffectTextAction = defineAction({
  id: 'editEffectText',
  label: 'Edit text along the path',
  // On the effect's body, so it outranks the untargeted anchor click; an anchor under the pointer gives the click back.
  defaultBinding: [{ spec: { kind: 'click', target: { kindOf: isBody }, mods: {} }, opts: { id: 'editEffectText.click' } }],
  eligible: { capability: 'edits-anchors' },
  requires: ['textEdit', 'nodeAtPoint', 'scene', 'editAnchors', 'view', 'kitSettings'],
  invoker: {
    timing: 'immediate',
    run(deps, params) {
      const hit = textUnder(deps, params?.world);
      if (hit) deps.textEdit?.startEdit(hit.id, { caret: hit.length });
    },
  },
  enabled: (deps, at) => (textUnder(deps, at) ? true : ActionDisabledReason.NotApplicable),
});
