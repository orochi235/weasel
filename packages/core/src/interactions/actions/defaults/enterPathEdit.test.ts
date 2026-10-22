import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { pathFromD } from '@weasel-js/geom';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from 'features/pathEffects';
import { enterPathEditAction } from './enterPathEdit';

function run(opts: { selected: string[]; editable: string[]; under: string | null }) {
  const setEditingId = vi.fn();
  const deps = {
    editAnchors: { getEditablePath: (id: string) => (opts.editable.includes(id) ? {} : null), setEditingId },
    selection: { get: () => opts.selected },
    nodeAtPoint: () => opts.under,
  };
  (enterPathEditAction.invoker as ImmediateInvoker).run(deps as never, { worldX: 5, worldY: 5 });
  return setEditingId;
}

describe('enterPathEdit', () => {
  it('opens the editable path under the pointer, not the first selected one', () => {
    expect(run({ selected: ['a', 'b'], editable: ['a', 'b'], under: 'b' })).toHaveBeenCalledWith('b');
  });

  it('falls back to the first selected editable path when none is under the pointer', () => {
    expect(run({ selected: ['r', 'a'], editable: ['a'], under: null })).toHaveBeenCalledWith('a');
    expect(run({ selected: ['r', 'a'], editable: ['a'], under: 'r' })).toHaveBeenCalledWith('a');
  });

  it('stands aside where the double-click names a group above the path under it', () => {
    const hitAt = (named: string | undefined) => () => ({
      bodyTarget: 'unselected-body' as const, bodyKind: 'path', id: 'member',
      ...(named ? { doubleClick: { bodyTarget: 'unselected-body' as const, bodyKind: 'group', id: named } } : {}),
    });
    const enabled = enterPathEditAction.enabled!;
    expect(enabled({ hitAt: hitAt('outer') } as never, { x: 5, y: 5 })).toBe(ActionDisabledReason.NotApplicable);
    expect(enabled({ hitAt: hitAt(undefined) } as never, { x: 5, y: 5 })).toBe(true);
  });

  describe('on a text-along node hiding its sources', () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: withPathEffectsRegistry(),
      initial: [
        { id: asNodeId('t'), kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 50, height: 20 }, data: { text: 'Hi' } },
        { id: asNodeId('p'), kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 50, height: 1 }, data: { path: pathFromD('M0 50 L50 50') } },
        { ...pathEffectNode({ kind: 'textAlong', hideSources: true }, [asNodeId('t'), asNodeId('p')], 'main', PATH_EFFECT_DERIVATIONS), id: asNodeId('fx') },
      ],
    });
    const invoke = (params: { worldX: number; worldY: number } | undefined, under: string | null) => {
      const setEditingId = vi.fn();
      const deps = {
        editAnchors: { getEditablePath: (id: string) => (id === 'p' ? {} : null), setEditingId },
        selection: { get: () => ['fx'] },
        nodeAtPoint: () => under,
        scene,
      };
      (enterPathEditAction.invoker as ImmediateInvoker).run(deps as never, params);
      return setEditingId;
    };

    it('edits its path when entered from the selection', () => {
      expect(invoke(undefined, null)).toHaveBeenCalledWith('p');
    });

    it('leaves a double-click on the effect itself to its text', () => {
      expect(invoke({ worldX: 5, worldY: 5 }, 'fx')).not.toHaveBeenCalled();
    });
  });
});
