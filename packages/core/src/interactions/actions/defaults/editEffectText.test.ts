/** A click on a text-along effect while its hidden path is in path edit opens the effect's text. */
import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { pathFromD } from '@weasel-js/geom';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from 'domains/pathEffects';
import { editEffectTextAction } from './editEffectText';

function sceneWith(hideSources: boolean) {
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: asNodeId('t'), kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 50, height: 20 }, data: { text: 'Hello' } },
      { id: asNodeId('p'), kind: 'mark', layer: 'main', pose: { x: 0, y: 50, width: 100, height: 1 }, data: { path: pathFromD('M0 50 L100 50') } },
      { ...pathEffectNode({ kind: 'textAlong', hideSources }, [asNodeId('t'), asNodeId('p')], 'main', PATH_EFFECT_DERIVATIONS), id: asNodeId('fx') },
    ],
  });
}

function depsFor(opts: { under: string | null; hideSources?: boolean; editing?: string }) {
  const scene = sceneWith(opts.hideSources ?? true);
  const startEdit = vi.fn();
  const deps = {
    scene,
    textEdit: { startEdit },
    nodeAtPoint: () => opts.under,
    editAnchors: {
      editingId: opts.editing ?? 'p',
      getEditablePath: (id: string) => (id === 'p' ? pathFromD('M0 50 L100 50') : null),
    },
  };
  return { deps, startEdit, scene };
}

const AT = { x: 50, y: 45 };
const click = (deps: object, world = AT) => (editEffectTextAction.invoker as ImmediateInvoker).run(deps as never, { world });

describe('editEffectText', () => {
  it("opens the effect's text, caret at its end, on a click on the effect", () => {
    const { deps, startEdit } = depsFor({ under: 'fx' });
    expect(editEffectTextAction.enabled!(deps as never, AT)).toBe(true);
    click(deps);
    expect(startEdit).toHaveBeenCalledWith('t', { caret: 5 });
  });

  it('stands aside off the effect, on an effect showing its text, and with no path open', () => {
    for (const opts of [{ under: null }, { under: 'p' }, { under: 'fx', hideSources: false }, { under: 'fx', editing: '' }]) {
      const { deps, startEdit } = depsFor(opts);
      expect(editEffectTextAction.enabled!(deps as never, AT)).toBe(ActionDisabledReason.NotApplicable);
      click(deps);
      expect(startEdit).not.toHaveBeenCalled();
    }
  });

  it('gives a click on an anchor of the open path to the anchor', () => {
    const { deps } = depsFor({ under: 'fx' });
    expect(editEffectTextAction.enabled!(deps as never, { x: 100, y: 50 })).toBe(ActionDisabledReason.NotApplicable);
  });

  it('opens no locked text', () => {
    const { deps, scene, startEdit } = depsFor({ under: 'fx' });
    scene.setLocked(asNodeId('t'), true);
    click(deps);
    expect(startEdit).not.toHaveBeenCalled();
  });
});
